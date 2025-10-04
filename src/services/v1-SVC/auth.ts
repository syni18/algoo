import { v4 as uuidv4 } from 'uuid';

import { query } from '../../config/postgres';
import { argonHashPassword } from '../../encryption/HASHING';
import { HttpError } from '../../errors/HttpError';
import { User } from '../../interfaces';
import bloomFilterService from '../../utils/bloomFilter';
import { generateReferralCode } from '../../utils/referalCode';

export const checkUsernameExists = async (username: string): Promise<object> => {
  if (!username) {
    throw new HttpError('Invalid username', 400);
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
    throw new HttpError(`User with this ${field} already exists. Please login.`, 400);
  }

  return newUser.rows[0];
};
