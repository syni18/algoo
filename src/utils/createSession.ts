import { v4 as uuidv4 } from 'uuid';

import { redisClient } from '../config/redis';

const SESSION_EXPIRE_SECONDS: number = parseInt(process.env.SESSION_EXPIRE_SECONDS!); // 7 days in seconds

export async function createSession(userId: number): Promise<string> {
  const sessionId = uuidv4();
  await redisClient.set(`sess:${sessionId}`, userId.toString(), 'EX', SESSION_EXPIRE_SECONDS);
  return sessionId;
}

export async function getUserIdFromSession(sessionId: string): Promise<number | null> {
  const userIdStr = await redisClient.get(`sess:${sessionId}`);
  return userIdStr ? parseInt(userIdStr, 10) : null;
}
