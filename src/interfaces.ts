import { NextFunction, Request, Response } from 'express';

export interface CPUMetrics {
  cores: number;
  model: string;
  loadAverage: number[];
  arch: string;
  temperature?: number;
  frequency?: number;
  usage?: number;
}

export interface MemoryMetrics {
  total: number;
  free: number;
  used: number;
  available?: number;
  cached?: number;
  buffers?: number;
  swapTotal?: number;
  swapUsed?: number;
}

export interface ProcessMetrics {
  pid: number;
  platform: string;
  nodeVersion: string;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  cwd: string;
  execPath: string;
  env: Record<string, string>;
  threads?: number;
}

export interface DiskMetrics {
  usage?: string | null;
  ioStats?: string | null;
  mountPoints?: string[] | null;
}

export interface NetworkMetrics {
  interfaces?: string | null;
  connections?: string | null;
  bandwidth?: string | null;
}

export interface SystemMetrics {
  platform: string;
  arch: string;
  hostname: string;
  uptime: number;
  release: string;
  version: string;
  kernel?: string;
  users?: string[];
  lastBoot?: number;
}

export interface GPUMetrics {
  info?: string;
  usage?: string;
  memory?: string;
}

export interface BatteryMetrics {
  level?: number;
  status?: string;
}

export interface ServicesMetrics {
  running: string[];
  failed: string[];
}

export interface SecurityMetrics {
  firewall?: boolean;
  antivirus?: string;
  updates?: string | number;
}

export interface ExtendedMetricsSnapshot {
  ts: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  process: ProcessMetrics;
  disk?: DiskMetrics;
  network?: NetworkMetrics;
  system: SystemMetrics;
  gpu?: GPUMetrics;
  battery?: BatteryMetrics;
  services?: ServicesMetrics;
  security?: SecurityMetrics;
}

export interface ServiceMeta {
  status: string;
  service: string;
  version: string;
  environment: string;
  uptime: string;
  timestamp: string;
}

export interface Job {
  id: number;
  message: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeout?: NodeJS.Timeout;
}

export interface WorkerMessage {
  type?: string;
}

export interface BatteryInfo {
  level: number | null; // in percentage
  status: 'charging' | 'discharging' | 'full' | null; // normalized status
}

export interface CpuInfo {
  cores: number;
  model: string;
  loadAverage: number[];
  arch: string;
  temperature?: number;
  frequency?: number; // in MHz
  usage?: number; // in percentage
}

export interface DiskInfo {
  usage?: string | null;
  ioStats?: string | null;
  mountPoints?: string[] | null;
}

export interface GpuInfo {
  info?: string;
  usage?: string;
  memory?: string;
}

export interface MemoryInfo {
  total: number; // in bytes
  free: number; // in bytes
  used: number; // in bytes
  available?: number; // in bytes (Linux only)
  cached?: number; // in bytes (Linux only)
  buffers?: number; // in bytes (Linux only)
  swapTotal?: number; // in bytes (Linux only)
  swapUsed?: number; // in bytes (Linux only)
}

export interface NetworkInfo {
  interfaces?: string | null;
  connections?: string | null;
  bandwidth?: string | null;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
  uptime: number;
  release: string;
  version: string;
  kernel?: string;
  users?: string[];
  lastBoot?: number;
}

export interface ProcessInfo {
  pid: number;
  platform: NodeJS.Platform;
  nodeVersion: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  cwd: string;
  execPath: string;
  env: NodeJS.ProcessEnv;
  threads?: number; // Number of active threads (if available)
}

export interface SecurityInfo {
  firewall: boolean;
  antivirus?: string;
  updates?: string;
}

export interface SensorInfo {
  temperature: Record<string, number>;
  fans: Record<string, number>;
  voltage: Record<string, number>;
}

export interface servicesInfo {
  running: string[];
  failed: string[];
}

export interface SystemMetricsSnapshot {
  ts: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  process: {
    pid: number;
    cpuUsage: NodeJS.CpuUsage;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    threads?: number;
  };
  disk: DiskMetrics;
  network: NetworkMetrics;
  system: SystemMetrics;
  gpu?: GPUMetrics;
  battery?: {
    level: number | null; // Battery percentage
    status: string | null; // Charging/discharging
    timeRemaining?: number; // Time remaining in minutes
  } | null;
  sensors?: {
    temperature: Record<string, number>; // Various temperature sensors
    fans: Record<string, number>; // Fan speeds
    voltage: Record<string, number>; // Voltage readings
  };
  services?: ServicesMetrics;
  security?: SecurityMetrics;
}

// src/routes/route.interface.ts
export interface Route {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  handler: (req: Request, res: Response, next: NextFunction) => any; // <-- fixed
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  validationSchema?: any;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: any }>;
}
