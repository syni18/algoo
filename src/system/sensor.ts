import { SensorInfo } from 'interfaces.js';
import { runCmd } from '../utils/runCmd.js';


// Sensor Information
export const getSensorInfo = (): SensorInfo | undefined => {
  const sensors: SensorInfo = { temperature: {}, fans: {}, voltage: {} };

  if (process.platform === 'linux') {
    const sensorData = runCmd('sensors 2>/dev/null');
    if (sensorData) {
      const lines = sensorData.split('\n');
      lines.forEach(line => {
        if (line.includes('°C')) {
          const [name, value] = line.split(':');
          const temp = parseFloat(value.match(/(\d+\.\d+)°C/)?.[1] || '0');
          if (temp > 0) sensors.temperature[name.trim()] = temp;
        }
        if (line.includes('RPM')) {
          const [name, value] = line.split(':');
          const rpm = parseInt(value.match(/(\d+)\s*RPM/)?.[1] || '0');
          if (rpm > 0) sensors.fans[name.trim()] = rpm;
        }
      });
    }
  }

  return Object.keys(sensors.temperature).length > 0 ? sensors : undefined;
};
