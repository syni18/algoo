import { Request, Response } from 'express';

import { getSystemHealth } from '../../services/v1-SVC/health';
import { getMeta } from '../../utils/packageInfo';
import { sendResponse } from '../../utils/sendResponse';

export const getHealth = async (req: Request, res: Response) => {
  const { format } = req.query;
  const meta = getMeta();

  const r = await getSystemHealth(format as string, meta);

  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: r || null,
    message: 'Health check successful',
    meta: meta,
  });
};
