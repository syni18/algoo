import chalk from 'chalk';
import { Request } from 'express';
import morgan from 'morgan';
import { timestampFormatGmt } from '../utils/timestamp-format.js';

// Custom tokens
morgan.token('gmt-date', () => timestampFormatGmt(new Date()));

morgan.token('protocol', (req) => {
  const request = req as Request;
  return request.secure ? 'HTTPS' : 'HTTP';
});

morgan.token('colored-status', (req, res) => {
  const status = res.statusCode;
  const color =
    status >= 500 ? 'red' :
    status >= 400 ? 'yellow' :
    status >= 300 ? 'cyan' :
    status >= 200 ? 'green' : 'white';
  return chalk[color](status.toString());
});

morgan.token('colored-method', (req) => {
  const method = (req as Request).method;
  const color =
    method === 'GET' ? 'green' :
    method === 'POST' ? 'magenta' :
    method === 'PUT' ? 'yellow' :
    method === 'DELETE' ? 'red' : 'white';
  return chalk[color](method.padEnd(4));
});

export const morganLogger = morgan((tokens, req, res) => {
  const protocol = chalk.gray(`[${tokens.protocol(req, res)}]`);
  const date = tokens['gmt-date'](req, res);
  const method = tokens['colored-method'](req, res);
  const url = tokens.url(req, res);
  const status = tokens['colored-status'](req, res);
  
  const responseTimeRaw = tokens['response-time'](req, res);
  const responseTimeMs = Number(responseTimeRaw);
  const isSlowApi = responseTimeMs > Number(process.env.SLOW_API_THRESHOLD_MS!);
  // const responseTimeColor = isSlowApi ? 'red' : 'green';
  const responseTimeColored =(`${responseTimeMs} ms`);
  const slowIndicator = isSlowApi ? chalk.red(' [SLOW]') : '';

  return `${protocol} ${date} ${method} [${url}] ${status} ${responseTimeColored}${slowIndicator}`;
});

export default morganLogger;