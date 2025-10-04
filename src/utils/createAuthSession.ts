import { v4 as uuidv4 } from 'uuid';

import { query } from '../config/postgres';
import { generateTokens } from '../encryption/JWT';
import { HttpError } from '../errors/HttpError';
import { createSession } from './createSession';
import { timestampFormatGmt } from './timestamp-format';

export const createAuthForUser = async (
  id: number,
  email: string,
  username: string,
  ip: string,
  userAgent: string | null,
) => {
  // Generate access and refresh tokens
  const [tokens, sessionId] = await Promise.all([
    generateTokens({ userId: id, email: email, username }),
    createSession(id),
  ]);

  const user_session_id = uuidv4();
  const q = `
    INSERT INTO user_sessions (
      id, user_id, session_token, ip_address, user_agent, 
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `;

  const r = await query(q, [
    user_session_id,
    id,
    sessionId,
    ip,
    userAgent,
    timestampFormatGmt(tokens.refreshTokenExpiresAt),
  ]);

  if ((r.rowCount ?? 0) === 0) {
    throw new HttpError('Unable to create User session.', 400);
  }

  return {
    ...tokens,
    sessionId,
    user_session: r.rows[0],
  };
};
