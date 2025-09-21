// src/security/sqlDetectorAdvanced.ts
import { NextFunction, Request, Response } from 'express';
// optional helpful parser for durations (npm i ms)

// Optional: types for a metrics client (prom-client) if you want metrics
type MetricsClient = {
  incr?: (name: string, labels?: Record<string, string>) => void;
  gauge?: (name: string, value: number, labels?: Record<string, string>) => void;
  timing?: (name: string, ms: number, labels?: Record<string, string>) => void;
};

// Detection function signature — return score 0..100 and optional reason
export type Detector = (payload: DetectorPayload) => Promise<DetectorResult> | DetectorResult;

export type DetectorPayload = {
  path: string;
  method: string;
  snippet: string; // trimmed JSON of params/query/body
  headers: Record<string, string>;
  ip: string;
  now: number;
};

export type DetectorResult = {
  score: number; // 0..100
  reason?: string;
  meta?: Record<string, any>;
};

// In-memory store interface (for throttling). Swap with Redis for multi-instance
export interface Store {
  incr(key: string, by?: number, ttlMs?: number): Promise<number>;
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttlMs?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// Default in-memory store (simple, not persistent, suitable for single-process)
class MemoryStore implements Store {
  private map = new Map<string, { val: number; expiresAt: number }>();
  async incr(key: string, by = 1, ttlMs = 60_000) {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt < now) {
      this.map.set(key, { val: by, expiresAt: now + ttlMs });
      return by;
    }
    entry.val += by;
    entry.expiresAt = now + ttlMs;
    return entry.val;
  }
  async get(key: string) {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt < now) return null;
    return entry.val;
  }
  async set(key: string, value: number, ttlMs = 60_000) {
    this.map.set(key, { val: value, expiresAt: Date.now() + ttlMs });
  }
  async del(key: string) {
    this.map.delete(key);
  }
}

// Options
export type SQLDetectorOptions = {
  block?: boolean; // if true, block requests over blockThreshold
  alertThreshold?: number; // score >= alertThreshold triggers alert hook
  blockThreshold?: number; // score >= blockThreshold triggers block (if block:true)
  maxSnippetLength?: number; // max chars to inspect from combined payload
  sensitiveKeys?: string[]; // keys to redact from body before inspection
  allowlistPaths?: string[]; // exact path strings (or prefixes) to ignore
  allowlistIPs?: string[]; // IPs to ignore
  denylistIPs?: string[]; // immediate deny for certain IPs
  engineWeights?: Record<string, number>; // relative weights for merge of detector scores
  store?: Store; // for throttling / counting
  throttle?: {
    windowMs: number; // window for counting repeat offenders
    maxHits: number; // if > maxHits in window, auto block temporarily
    blockDurationMs: number; // how long to block for repeat offenders
  };
  metrics?: MetricsClient | null;
  logger?: {
    warn?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  };
  extraDetectors?: Detector[]; // plug custom detectors
  normalizeSnippet?: (raw: string) => string; // optional snip normalization
  bypassHeader?: { name: string; value?: string }; // header to bypass detector for internal calls
  ipKeyPrefix?: string; // prefix in store for ip keys
  // alert hook (async): called with context when an alert fires
  alertHook?: (ctx: AlertContext) => Promise<void> | void;
  // block hook: called when blocking happens
  blockHook?: (ctx: AlertContext) => Promise<void> | void;
};

export type AlertContext = {
  ip: string;
  path: string;
  method: string;
  score: number;
  reason?: string;
  snippet: string;
  detectorResults: DetectorResult[];
  now: number;
  extra?: any;
};

const DEFAULT_OPTIONS: Partial<SQLDetectorOptions> = {
  block: false,
  alertThreshold: 35,
  blockThreshold: 70,
  maxSnippetLength: 4000,
  sensitiveKeys: ['password', 'pwd', 'token', 'accessToken', 'refreshToken', 'authorization'],
  allowlistPaths: ['/health', '/metrics', '/static'],
  allowlistIPs: ['127.0.0.1', '::1'],
  denylistIPs: [],
  engineWeights: { regex: 0.6, tokenEntropy: 0.2, multiStatement: 0.1, custom: 0.1 },
  throttle: { windowMs: 60_000, maxHits: 10, blockDurationMs: 5 * 60_000 },
  ipKeyPrefix: 'sqli:',
};

// --- built-in detectors ---

// 1) regex-based suspicious substring detector (fast)
const REGEX_LIST = [
  /\bUNION\b/i,
  /\bSELECT\b.*\bFROM\b/i,
  /(--|;|\/\*|\*\/)/, // comments or semicolon
  /(\bOR\b\s+1=1\b)/i,
  /information_schema/i,
  /pg_catalog/i,
  /xp_cmdshell/i,
  /load_file\s*\(/i,
  /into\s+outfile/i,
  /sleep\s*\(/i,
  /benchmark\s*\(/i,
];

// returns 0..100
function regexDetector(payload: DetectorPayload): DetectorResult {
  const s = payload.snippet;
  for (const r of REGEX_LIST) {
    if (r.test(s)) {
      // stronger weight if semicolon or union found
      const reason = `regex:${r.toString()}`;
      // base 50 score then increased by snippet length context (clamp)
      const score = Math.min(95, 50 + Math.floor(Math.min(s.length, 2000) / 40));
      return { score, reason };
    }
  }
  return { score: 0, reason: 'regex:none' };
}

// 2) multi-statement / semicolon detector
function multiStatementDetector(payload: DetectorPayload): DetectorResult {
  const s = payload.snippet;
  // simple: if a semicolon appears inside a param/body or `;--` combos
  if (s.includes(';') && /;.+;|;.*(--|\/\*)/.test(s)) {
    return { score: 70, reason: 'multi-statement' };
  }
  // semicolon alone can be benign (e.g. JSON), give smaller score
  if (s.includes(';')) return { score: 30, reason: 'semicolon' };
  return { score: 0 };
}

// 3) token/character entropy detector — detects many punctuation/SQL tokens clustered
function tokenEntropyDetector(payload: DetectorPayload): DetectorResult {
  const s = payload.snippet;
  // compute proportion of non-alphanumeric chars and suspicious tokens density
  const len = Math.max(1, s.length);
  const nonAlpha = (s.match(/[^A-Za-z0-9\s]/g) || []).length;
  const symbolRatio = nonAlpha / len; // 0..1
  let score = 0;
  if (symbolRatio > 0.12) score = Math.min(60, Math.floor((symbolRatio - 0.12) * 600)); // scale up
  // additional boost if typical SQL tokens present
  const tokens = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', '--', '/*', '*/', '0x'];
  let tokenHits = 0;
  for (const t of tokens) if (s.toUpperCase().includes(t)) tokenHits++;
  if (tokenHits >= 2) score = Math.max(score, Math.min(85, score + tokenHits * 6));
  if (score > 0) return { score, reason: 'token-entropy', meta: { symbolRatio, tokenHits } };
  return { score: 0, reason: 'token-entropy:none' };
}

// Helper: redact sensitive keys from parsed body
function redactSensitive(obj: any, keys: string[]) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const lowKeys = new Set(keys.map((k) => k.toLowerCase()));
  function walk(o: any) {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      try {
        if (lowKeys.has(k.toLowerCase())) o[k] = '[REDACTED]';
        else if (typeof o[k] === 'object') walk(o[k]);
      } catch {}
    }
  }
  walk(clone);
  return clone;
}

// default normalization: JSON stringify with stable order (simple)
function defaultNormalize(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed);
  } catch {
    // remove multiple whitespace and trim
    return raw.replace(/\s+/g, ' ').trim();
  }
}

// merge detectors results by weights -> final score 0..100
function mergeResults(results: DetectorResult[], weights: Record<string, number>) {
  // map reasons to names heuristically (reason often begins with 'regex:' etc.)
  let totalWeight = 0;
  let scoreSum = 0;
  for (const r of results) {
    let name = 'custom';
    if (r.reason) {
      if (r.reason.startsWith('regex:') || r.reason === 'regex:none') name = 'regex';
      else if (r.reason.startsWith('token-entropy')) name = 'tokenEntropy';
      else if (r.reason === 'multi-statement' || r.reason === 'semicolon') name = 'multiStatement';
      else name = 'custom';
    }
    const w = weights[name] ?? weights['custom'] ?? 0.1;
    scoreSum += (r.score ?? 0) * w;
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  const normalized = Math.round(scoreSum / totalWeight);
  return Math.max(0, Math.min(100, normalized));
}

// --- middleware factory ---
export function sqlInjectionDetectorAdvanced(rawOpts?: Partial<SQLDetectorOptions>) {
  const opts: SQLDetectorOptions = {
    ...(DEFAULT_OPTIONS as any),
    ...(rawOpts || {}),
  } as SQLDetectorOptions;
  // fill missing values
  opts.store = opts.store ?? new MemoryStore();
  opts.logger = opts.logger ?? console;
  opts.metrics = opts.metrics ?? null;
  opts.engineWeights = opts.engineWeights ?? (DEFAULT_OPTIONS.engineWeights as any);
  opts.maxSnippetLength = opts.maxSnippetLength ?? (DEFAULT_OPTIONS.maxSnippetLength as number);
  opts.sensitiveKeys = opts.sensitiveKeys ?? (DEFAULT_OPTIONS.sensitiveKeys as string[]);
  opts.allowlistPaths = opts.allowlistPaths ?? (DEFAULT_OPTIONS.allowlistPaths as string[]);
  opts.allowlistIPs = opts.allowlistIPs ?? (DEFAULT_OPTIONS.allowlistIPs as string[]);
  opts.denylistIPs = opts.denylistIPs ?? (DEFAULT_OPTIONS.denylistIPs as string[]);
  opts.ipKeyPrefix = opts.ipKeyPrefix ?? (DEFAULT_OPTIONS.ipKeyPrefix as string);
  const throttle = opts.throttle ?? (DEFAULT_OPTIONS.throttle as any);

  // internal helpers
  const isPathAllowlisted = (path: string) => {
    if (!opts.allowlistPaths || opts.allowlistPaths.length === 0) return false;
    for (const p of opts.allowlistPaths) {
      if (p === path) return true;
      // prefix match
      if (p.endsWith('*') && path.startsWith(p.slice(0, -1))) return true;
      if (path.startsWith(p)) return true; // simple prefix allow
    }
    return false;
  };

  const isIPAllowlisted = (ip: string) => opts.allowlistIPs?.includes(ip) ?? false;
  const isIPDenylisted = (ip: string) => opts.denylistIPs?.includes(ip) ?? false;

  // main middleware
  return async function middleware(req: Request, res: Response, next: NextFunction) {
    try {
      const now = Date.now();

      // bypass header for internal calls
      if (opts.bypassHeader) {
        const hv = req.header(opts.bypassHeader.name);
        if (hv && (opts.bypassHeader.value ? hv === opts.bypassHeader.value : true)) {
          opts.logger?.debug?.('[SQLi] bypass header matched, skipping');
          return next();
        }
      }

      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      // immediate allow/deny by IP
      if (isIPAllowlisted(ip)) return next();
      if (isIPDenylisted(ip)) {
        opts.logger?.warn?.('[SQLi] denylisted IP blocked', ip, req.path);
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      // allowlisted paths
      if (isPathAllowlisted(req.path)) return next();

      // build snippet from params/query/body (redact sensitive values)
      const raw = JSON.stringify({
        params: req.params,
        query: req.query,
        body: redactSensitive(req.body, opts.sensitiveKeys ?? []),
      });

      const normalize = opts.normalizeSnippet ?? defaultNormalize;
      const snippet = normalize(raw).slice(0, opts.maxSnippetLength ?? 4000);

      // build payload
      const payload: DetectorPayload = {
        path: req.path,
        method: req.method,
        snippet,
        headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
        ip,
        now,
      };

      // run detectors
      const detectorResults: DetectorResult[] = [];

      // built-ins
      detectorResults.push(regexDetector(payload));
      detectorResults.push(tokenEntropyDetector(payload));
      detectorResults.push(multiStatementDetector(payload));

      // extra detectors
      if (opts.extraDetectors && opts.extraDetectors.length) {
        for (const d of opts.extraDetectors) {
          try {
            const r = await d(payload);
            detectorResults.push(r);
          } catch (e: any) {
            opts.logger?.error?.('[SQLi] custom detector error', e?.message ?? e);
          }
        }
      }

      // combine to final score
      const finalScore = mergeResults(detectorResults, opts.engineWeights ?? {});

      // Metrics: increment counters
      if (opts.metrics?.incr) {
        opts.metrics.incr('sqli_requests_total', { path: req.path, method: req.method });
        if (finalScore >= (opts.alertThreshold ?? 35))
          opts.metrics.incr('sqli_alerts_total', { path: req.path });
        if (finalScore >= (opts.blockThreshold ?? 70))
          opts.metrics.incr('sqli_blocks_total', { path: req.path });
      }

      // If we exceeded alert threshold, call alertHook
      if (finalScore >= (opts.alertThreshold ?? 35)) {
        const ctx: AlertContext = {
          ip,
          path: req.path,
          method: req.method,
          score: finalScore,
          reason: detectorResults.map((r) => r.reason).join(','),
          snippet: snippet.slice(0, 2000),
          detectorResults,
          now,
        };
        try {
          // non-blocking: don't await alertHook fully (but catch)
          Promise.resolve(opts.alertHook?.(ctx)).catch((e) =>
            opts.logger?.error?.('[SQLi] alertHook error', e),
          );
          opts.logger?.warn?.('[SQLi] alert threshold reached', ctx);
        } catch (e: any) {
          opts.logger?.error?.('[SQLi] alert hook failed', e?.message ?? e);
        }
      }

      // Throttle logic (count alerts per IP and optionally block temporarily)
      if (finalScore >= (opts.alertThreshold ?? 35) && throttle) {
        const key = `${opts.ipKeyPrefix ?? 'sqli:'}alerts:${ip}`;
        const hits = await opts.store!.incr(key, 1, throttle.windowMs);
        if (hits >= (throttle.maxHits ?? 10)) {
          const blockKey = `${opts.ipKeyPrefix ?? 'sqli:'}blocked:${ip}`;
          await opts.store!.set(blockKey, 1, throttle.blockDurationMs);
          opts.logger?.warn?.('[SQLi] ip temporarily blocked by throttle', ip, {
            hits,
            blockForMs: throttle.blockDurationMs,
          });
        }
      }

      // If IP is temporarily blocked by throttle, short-circuit
      const blockedKey = `${opts.ipKeyPrefix ?? 'sqli:'}blocked:${ip}`;
      const isBlocked = (await opts.store!.get(blockedKey)) ? true : false;
      if (isBlocked) {
        // call blockHook if set
        const ctx: AlertContext = {
          ip,
          path: req.path,
          method: req.method,
          score: 100,
          snippet: snippet.slice(0, 1000),
          detectorResults,
          now,
        };
        Promise.resolve(opts.blockHook?.(ctx)).catch((e) =>
          opts.logger?.error?.('[SQLi] blockHook error', e),
        );
        if (opts.block) return res.status(403).json({ error: 'Forbidden' });
        // if not blocking (fail-open), just 429
        return res.status(429).json({ error: 'Too many suspicious requests' });
      }

      // If final score exceeds blockThreshold and block mode is enabled -> block
      if (finalScore >= (opts.blockThreshold ?? 70) && opts.block) {
        const ctx: AlertContext = {
          ip,
          path: req.path,
          method: req.method,
          score: finalScore,
          snippet: snippet.slice(0, 1000),
          detectorResults,
          now,
        };
        try {
          await opts.blockHook?.(ctx);
        } catch (e: any) {
          opts.logger?.error?.('[SQLi] blockHook error', e?.message ?? e);
        }
        opts.logger?.warn?.('[SQLi] blocked request', { ip, path: req.path, score: finalScore });
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Attach detection metadata for later logging or request handlers if needed
      (req as any)._sqli = { score: finalScore, detectorResults };

      // pass through
      next();
    } catch (e: any) {
      // Fail open: do not stop normal traffic on detector failure
      try {
        (opts.logger as any)?.error?.('[SQLi] middleware error', e?.message ?? e);
      } catch {}
      next();
    }
  };
}
