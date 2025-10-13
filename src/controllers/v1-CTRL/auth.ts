import { Request, Response } from 'express';

import { 
  checkUsernameExists, 
  createNewUser, 
  loginUserByIdentifier, 
  deleteUserAccount, 
  logoutUserAccount, 
  requestPasswordReset 
} from '../../services/v1-SVC/auth';
import { createAuthForUser } from '../../utils/createAuthSession';
import { sendResponse } from '../../utils/sendResponse';
import { redisClient } from '@config/redis';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const,
  path: '/',
};

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
  const ip = req.ip!;
  const userAgent = req.headers['user-agent'] || null;
  const { identifier, password } = req.body;
  const r = await loginUserByIdentifier(identifier, password, ip);

  const auth = await createAuthForUser(r.id, r.email, r.username, ip, userAgent);

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
    message: 'Account Login Successfully.',
  });

};

export const createUser = async (req: Request, res: Response) => {
  // Registration logic here
  const ip = req.ip!;
  const userAgent = req.headers['user-agent'] || null;
  const { username, firstName, middleName, lastName, email, password } = req.body;
  const r = await createNewUser(username, firstName, middleName, lastName, email, password);

  // token + session
  const auth = await createAuthForUser(r.id, r.email, r.username, ip, userAgent);

  // set http cookies 
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

export const deleteUser = async (req: Request, res: Response) => {
  const sessionId = req.cookies.sessionId;
  const { id, username, email, password, delete_reason } = req.body;
  const r = await deleteUserAccount(id, username, email, password, delete_reason);

  if(r.success){
    res.clearCookie('accessToken',{
      ...cookieOptions
    });
    res.clearCookie('refreshToken', {
      ...cookieOptions
    });
    res.clearCookie('sessionId', {
      ...cookieOptions
    })

    await redisClient.del(`sess:${sessionId}`);
  }

  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: null,
    message: 'Account delete Successfully.'
  })
}

export const logoutUser = async (req: Request, res: Response) => {
  const { id } = req.body;
  const sessionId = req.cookies.sessionId;

  const r = await logoutUserAccount(id);

  if(r.success){
    res.clearCookie('accessToken',{
      ...cookieOptions
    });
    res.clearCookie('refreshToken', {
      ...cookieOptions
    });
    res.clearCookie('sessionId', {
      ...cookieOptions
    })

    await redisClient.del(`sess:${sessionId}`);
  }

  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: null,
    message: 'User Logout Successfully.'
  })
}

export const forgetUser = async (req: Request, res: Response) => {
  const { identifier } = req.body;
  const r = await requestPasswordReset(identifier);

  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: r,
    message: 'A password reset link has been sent to the registered email address.',
  });
}