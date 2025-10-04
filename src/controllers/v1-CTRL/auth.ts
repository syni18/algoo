import { Request, Response } from 'express';

import { checkUsernameExists, createNewUser } from '../../services/v1-SVC/auth';
import { createAuthForUser } from '../../utils/createAuthSession';
import { sendResponse } from '../../utils/sendResponse';

export const usernameExists = async (req: Request, res: Response) => {
  const username = req.params.username?.trim();

  const r = await checkUsernameExists(username);
  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: r || null,
    message: 'Username validation successful',
  });
};
export const loginUser = async (req: Request, res: Response) => {
  // Login logic here
};

export const createUser = async (req: Request, res: Response) => {
  // Registration logic here
  const ip = req.ip!;
  const userAgent = req.headers['user-agent'] || null;
  const { username, firstName, middleName, lastName, email, password } = req.body;
  const r = await createNewUser(username, firstName, middleName, lastName, email, password);

  // token + session
  const auth = await createAuthForUser(r.id, r.email, r.username, ip, userAgent);

  // Set secure HTTP-only cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict' as const,
    path: '/',
  };

  res.cookie('accessToken', auth.accessToken, {
    ...cookieOptions,
    maxAge: auth.accessTokenExpiresAt - Date.now(),
  });

  res.cookie('refreshToken', auth.refreshToken, {
    ...cookieOptions,
    maxAge: auth.refreshTokenExpiresAt - Date.now(),
  });

  res.cookie('sessionId', auth.sessionId, {
    ...cookieOptions,
    maxAge: Number(process.env.SESSION_EXPIRE_SECONDS!),
  });

  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: {
      ...r,
      sessionId: auth.user_session,
    },
    message: 'Account Created Successfully.',
  });
};
