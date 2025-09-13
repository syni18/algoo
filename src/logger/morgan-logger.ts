import chalk from 'chalk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Request } from 'express';
import morgan from 'morgan';

dayjs.extend(utc);

// Custom timestamp in UTC format: YYYY-MM-DDTHH:mm:ssZ
morgan.token('utc-date', () => {
  return dayjs().utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
});

// Determine HTTP or HTTPS
morgan.token('protocol', (req) => {
  const request = req as Request;
  return request.secure ? 'HTTPS' : 'HTTP';
});

// Color-coded status
morgan.token('colored-status', (req, res) => {
  const status = res.statusCode;
  const color =
    status >= 500
      ? 'red'
      : status >= 400
        ? 'yellow'
        : status >= 300
          ? 'cyan'
          : status >= 200
            ? 'green'
            : 'white';
  return chalk[color](status.toString());
});

// Color-coded method
morgan.token('colored-method', (req) => {
  const method = (req as Request).method;
  const color =
    method === 'GET'
      ? 'green'
      : method === 'POST'
        ? 'magenta'
        : method === 'PUT'
          ? 'yellow'
          : method === 'DELETE'
            ? 'red'
            : 'white';
  return chalk[color](method.padEnd(6)); // Pad for alignment
});

const morganLogger = morgan(
  chalk.gray('[::protocol]') +
    ' :utc-date' +
    ' :colored-method' +
    ' :url' +
    ' :colored-status' +
    ' :response-time ms',
);

export default morganLogger;
