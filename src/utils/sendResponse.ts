import { Response } from 'express';

interface SendResponseProps<T> {
  res: Response;
  statusCode: number;
  success: boolean;
  message: string;
  data?: T | null;
  meta?: Record<string, any>;
}

export const sendResponse = <T>({
  res,
  statusCode,
  success,
  message,
  data = null,
  meta = {},
}: SendResponseProps<T>) => {
  return res.status(statusCode).json({
    status: success ? 'success' : 'failure', // ✅ clearer contract
    statusCode, // ✅ easy debugging
    message,
    data,
    meta,
  });
};
