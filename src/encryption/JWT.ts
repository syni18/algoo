import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import ms from 'ms'; // npm install ms

// -------------------- Config --------------------
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets are not defined in environment variables');
}

// Fix: Properly type the expiration values as StringValue
const ACCESS_TOKEN_EXPIRES_IN: ms.StringValue = process.env.JWT_ACCESS_EXPIRES! as ms.StringValue;
const REFRESH_TOKEN_EXPIRES_IN: ms.StringValue = process.env.JWT_REFRESH_EXPIRES! as ms.StringValue;

// Example: support multiple secrets for rotation (kid → secret map)
const JWT_SECRETS: Record<string, string> = {
  'v1-access': JWT_ACCESS_SECRET,
  'v1-refresh': JWT_REFRESH_SECRET,
};

// -------------------- Interfaces --------------------
export interface TokenPayload {
  userId: number;
  email?: string;
  roles?: string[];
  [key: string]: any; // flexible for extra claims
}

export interface DecodedToken extends JwtPayload {
  userId: number;
  email?: string;
  roles?: string[];
}

// -------------------- Utils --------------------

/**
 * Generate Access & Refresh tokens for user
 */
export function generateTokens(payload: TokenPayload) {
  const accessOptions: SignOptions = {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN, // Now properly typed as StringValue
    header: {
      kid: 'v1-access',
      alg: 'HS256', // Fix: Add required algorithm
    },
  };

  const refreshOptions: SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN, // Now properly typed as StringValue
    header: {
      kid: 'v1-refresh',
      alg: 'HS256', // Fix: Add required algorithm
    },
  };

  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET!, accessOptions);
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET!, refreshOptions);

  // Fix: Now properly typed variables work with ms()
  const accessExpiresMs = ms(ACCESS_TOKEN_EXPIRES_IN);
  const refreshExpiresMs = ms(REFRESH_TOKEN_EXPIRES_IN);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: Date.now() + accessExpiresMs,
    refreshTokenExpiresAt: Date.now() + refreshExpiresMs,
  };
}

/**
 * Verify token with correct secret (based on kid)
 */
export function verifyJWT<T extends JwtPayload = DecodedToken>(
  token: string,
  type: 'access' | 'refresh' = 'access',
): T | null {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') return null;

    const kid = decoded.header.kid as string;
    const secret = JWT_SECRETS[kid];
    if (!secret) return null;

    return jwt.verify(token, secret) as T;
  } catch {
    return null;
  }
}

/**
 * Decode token without verification (⚠️ only for debugging/logging)
 */
export function decodeJWT<T extends JwtPayload = DecodedToken>(token: string): T | null {
  try {
    return jwt.decode(token) as T;
  } catch {
    return null;
  }
}

/**
 * Refresh Access Token using Refresh Token
 */
export function refreshAccessToken(refreshToken: string) {
  const decoded = verifyJWT(refreshToken, 'refresh');
  if (!decoded) return null;

  const { userId, email, roles } = decoded;
  return generateTokens({ userId, email, roles });
}
