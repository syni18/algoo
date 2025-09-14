import { CpuInfo } from '../interfaces.js';
import os from 'os';

import { readFile } from '../utils/readFile.js';
import { runCmd } from '../utils/runCmd.js';

// Function to get comprehensive CPU information
export const getCpuInfo = (): CpuInfo => {
  return {
    cores: getCpuCores(),
    model: getCpuModel(),
    loadAverage: getCpuLoadAverage(),
    arch: getCpuArch(),
    temperature: getCpuTemperature(),
    frequency: getCpuFrequency(),
    usage: getCpuUsage(),
  };
};

// Function to get number of CPU cores
export const getCpuCores = (): number => {
  return os.cpus().length;
};

// Function to get CPU model
export const getCpuModel = (): string => {
  return os.cpus()[0].model;
};

// Function to get CPU load average
export const getCpuLoadAverage = (): number[] => {
  return os.loadavg();
};

// Function to get CPU architecture
export const getCpuArch = (): string => {
  return os.arch();
};

// Function to get CPU temperature
export const getCpuTemperature = (): number | undefined => {
  if (process.platform === 'linux') {
    const temp = readFile('/sys/class/thermal/thermal_zone0/temp');
    return temp ? parseInt(temp) / 1000 : undefined;
  } else if (process.platform === 'darwin') {
    const temp = runCmd('sudo powermetrics -n 1 -s cpu_power | grep "CPU die temperature"');
    return temp ? parseFloat(temp.split(':')[1]) : undefined;
  }
  return undefined;
};

// Function to get CPU frequency
export const getCpuFrequency = (): number | undefined => {
  if (process.platform === 'linux') {
    const freq = readFile('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq');
    return freq ? parseInt(freq) / 1000 : undefined; // Convert to MHz
  }
  return undefined;
};

// Function to get CPU usage
export const getCpuUsage = (): number | undefined => {
  if (process.platform === 'linux') {
    const usage = runCmd("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
    return usage ? parseFloat(usage) : undefined;
  } else if (process.platform === 'darwin') {
    const usage = runCmd("top -l 1 | grep 'CPU usage' | awk '{print $3}' | cut -d'%' -f1");
    return usage ? parseFloat(usage) : undefined;
  } else if (process.platform === 'win32') {
    const usage = runCmd('wmic cpu get loadpercentage /value | find "="');
    return usage ? parseFloat(usage.split('=')[1]) : undefined;
  }
  return undefined;
};
