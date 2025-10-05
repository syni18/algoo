import { v4 as uuidv4 } from 'uuid';

import { query } from '../../config/postgres';
import { argonHashPassword, argonVerifyPassword } from '../../encryption/HASHING';
import { HttpError } from '../../errors/HttpError';
import { User } from '../../interfaces';
import bloomFilterService from '../../utils/bloomFilter';
import { generateReferralCode } from '../../utils/referalCode';
import { timestampFormatGmt } from '@utils/timestamp-format';

export const checkUsernameExists = async (username: string): Promise<object> => {
  if (!username) {
    throw new HttpError('Invalid username', 401);
  }

  // First check Bloom filter
  if (!bloomFilterService.isUsernamePossiblyTaken(username)) {
    return {
      available: true,
      message: `Username is available`,
    };
  }

  const q = `SELECT 1 FROM users WHERE username = $1 LIMIT 1;`;
  const r = await query(q, [username]);

  return {
    available: (r.rowCount ?? 0) === 0,
    message: `Username is ${(r.rowCount ?? 0) === 0 ? 'available' : 'not available'}`,
  };
};

export const createNewUser = async (
  username: string,
  firstName: string,
  middleName: string,
  lastName: string,
  email: string,
  password: string,
): Promise<User> => {
  // normalize email string
  email = email.trim().toLowerCase();

  const userId = uuidv4();
  const hash = await argonHashPassword(password);
  const referral_code = generateReferralCode(username).trim().toUpperCase();

  const q = `
    INSERT INTO users ( 
      id, username, email, password_hash, 
      first_name, middle_name, last_name,
      referral_code
    ) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
    ON CONFLICT (email) DO NOTHING
    RETURNING id, username, email, first_name, middle_name, last_name;
  `;

  const newUser = await query(q, [
    userId,
    username,
    email,
    hash,
    firstName,
    middleName || null,
    lastName || null,
    referral_code,
  ]);

  if ((newUser.rowCount ?? 0) === 0) {
    // Check which constraint failed
    const checkQ = `SELECT 
      CASE 
        WHEN email = $1 THEN 'email'
        WHEN username = $2 THEN 'username'
      END as conflict
      FROM users 
      WHERE email = $1 OR username = $2 
      LIMIT 1;`;

    const conflict = await query(checkQ, [email, username]);
    const field = conflict.rows[0]?.conflict || 'email or username';
    throw new HttpError(`${field} already exists. Please login.`, 409);
  }

  return newUser.rows[0];
};

export const loginUserByIdentifier = async (
  identifier: string,
  password: string,
  ip: string
): Promise<User> => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

  const sql = isEmail
    ? `SELECT id, login_count, failed_login_attempts, locked_until, password_hash
       FROM users WHERE email = $1 LIMIT 1;`
    : `SELECT id, login_count, failed_login_attempts, locked_until, password_hash
       FROM users WHERE username = $1 LIMIT 1;`;


  const userExist = await query(sql, [identifier]);

  if (userExist.rowCount === 0) {
    throw new HttpError('Invalid credentials.', 401);
  }

  // 1. Check if account is locked
  if (userExist.rows[0].locked_until && new Date(userExist.rows[0].locked_until) > new Date()) {
    throw new HttpError(
      `Account locked until ${timestampFormatGmt(userExist.rows[0].locked_until)}. Try again after some time..`,
      403
    );
  }

  // verify password
  const isMatch = await argonVerifyPassword(userExist.rows[0].password_hash, password);
  if (!isMatch) {
    const newAttempts = userExist.rows[0].failed_login_attempts + 1;
    const lockedUntil = newAttempts >= Number(process.env.FAILED_LOGIN_ATTEMPT_LIMIT!)
      ? new Date(Date.now() + Number(process.env.LOCKED_UNTIL!))
      : null;

    await query(
      `UPDATE users
       SET failed_login_attempts = $2,
           last_login_ip = $3,
           updated_at = NOW(),
           locked_until = $4
       WHERE id = $1;`,
      [userExist.rows[0].id, newAttempts, ip, lockedUntil]
    );

    if (lockedUntil) {
      throw new HttpError(`Account locked due to multiple failed login attempts. Try again after 10 minutes.`, 403);
    }

    throw new HttpError('Invalid credentials.', 401);
  }

  // Update login-related fields
  const updateQ = `UPDATE users 
     SET
        last_login_at = NOW(),
        last_login_ip = $2,
        login_count = $3,
        updated_at = Now(),
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_by = $4
     WHERE id = $1
     RETURNING id, username, email, first_name,middle_name, last_name;`;

  const res = await query(updateQ, [
    userExist.rows[0].id,
    ip,
    userExist.rows[0].login_count + 1,
    userExist.rows[0].id
  ])

  return res.rows[0];
};

export const deleteUserAccount = async (
  id: string,
  username: string,
  email: string,
  password: string,
  delete_reason: string
): Promise<{ success: boolean, message: string }> => {
  email = email.trim().toLowerCase();

  const checkQ = `SELECT id, password_hash 
    FROM users
    WHERE id = $1 
    AND is_deleted = $2
    LIMIT 1;`;

  const userExist = await query(checkQ, [id, false]);
  if (userExist.rowCount === 0) {
    throw new HttpError('Unauthorized Access', 401);
  }

  const isMatch = await argonVerifyPassword(userExist.rows[0].password_hash, password);
  if (!isMatch) {
    throw new HttpError('Unauthorized Access', 401);
  }

  const deleteQ = `UPDATE users
    SET
      is_deleted = $2,
      deleted_by = $3,
      deleted_at = NOW(),
      deletion_reason = $4,
      updated_at = Now(),
      updated_by = $5
    WHERE id = $1;
  `;
  await query(deleteQ, [
    userExist.rows[0].id,
    true,
    userExist.rows[0].id,
    delete_reason,
    userExist.rows[0].id
  ]);

  const sessionQ = `DELETE FROM user_sessions WHERE user_id = $1;`;
  await query(sessionQ, [userExist.rows[0].id]);

  return {
    success: true,
    message: 'account inactive successfully.'
  }
}

export const logoutUserAccount = async (
  id: string
): Promise<{ id: string, success: boolean }> => {
  const logoutQ = `UPDATE users
    SET 
      locked_until = NULL,
      login_count = 0,
      failed_login_attempts = 0,
      updated_by = $1,
      updated_at = NOW()
    WHERE id = $1
      AND login_count != 0
    RETURNING id;`;

  const sessionQ = `UPDATE user_sessions
    SET
      is_active = false,
      last_accessed_at = NOW()
    WHERE user_id = $1
      AND is_active = true;`;

  const [r, _] = await Promise.all([
    query(logoutQ, [id]),
    query(sessionQ, [id])
  ]);

  if(r.rowCount === 0) {
    throw new HttpError('Unauthorized Access', 401);
  }

  return {
    id: r.rows[0].id,
    success: true
  }
}