import { SystemMetricsSnapshot, WorkerMessage } from 'interfaces.js';
import { parentPort } from 'worker_threads';

import logger from '../logger/winston-logger.js';
import * as battery from './battery.js';
import * as cpu from './cpu.js';
import * as disk from './disk.js';
import * as gpu from './gpu.js';
import * as memory from './memory.js';
import * as network from './network.js';
import * as platform from './platform.js';
import * as process from './process.js';
import * as security from './security.js';
import * as sensors from './sensor.js';
import * as services from './services.js';

// Declare message type shape (adjust as needed)

const { getCpuInfo } = cpu;
const { getExtendedMemoryInfo } = memory;
const { getGpuInfo } = gpu;
const { getBatteryInfo } = battery;
const { getSensorInfo } = sensors;
const { getServicesInfo } = services;
const { getSecurityInfo } = security;
const { getDiskInfo } = disk;
const { getNetworkInfo } = network;
const { getSystemInfo } = platform;
const { getProcessInfo } = process;

export function collectExtendedMetrics(): SystemMetricsSnapshot {
  return {
    ts: Date.now(),
    cpu: getCpuInfo(),
    memory: getExtendedMemoryInfo(),
    process: getProcessInfo(),
    disk: getDiskInfo(),
    network: getNetworkInfo(),
    system: getSystemInfo(),
    gpu: getGpuInfo(),
    battery: getBatteryInfo(),
    sensors: getSensorInfo(),
    services: getServicesInfo(),
    security: getSecurityInfo(),
  };
}

// collectExtendedMetrics(); // Initial call to warm up any caches if needed

if (parentPort) {
  parentPort.on('message', (message: WorkerMessage) => {
    logger.debug(`Worker received message: ${JSON.stringify(message)}`);
    if (parentPort) {
      if (message?.type === 'collect-metrics') {
        if (parentPort) {
          try {
            const metrics = collectExtendedMetrics();
            parentPort.postMessage(metrics);
          } catch (err: any) {
            parentPort.postMessage({ error: err.message || 'Error collecting metrics' });
          }
        }
      } else {
        parentPort.postMessage({ error: 'Unknown message type' });
      }
    }
  });
} else {
  logger.warn("This script was not run inside a Worker thread. 'parentPort' is null.");
}
