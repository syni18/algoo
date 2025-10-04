import argon2 from 'argon2';
import bcrypt from 'bcrypt';

import { HttpError } from '../errors/HttpError';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

const options = {
  type: argon2.argon2id, // Recommended variant mixing Argon2i and Argon2d
  memoryCost: 2 ** 14, // 16 MiB RAM, adjustable based on load
  timeCost: 2, // Number of iterations
  parallelism: 2, // Parallel threads; tune per your environment
};

// Hash password async with options tuned for security and performance
export async function argonHashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

// Verify password securely and asynchronously
export async function argonVerifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    throw new HttpError('Failed to verify Password', 400);
  }
}

export async function bcryptHashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    // Properly log error in production-grade logger here
    throw new Error('Failed to hash password');
  }
}

export async function verifyPassword(
  hashedPassword: string,
  candidatePassword: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  } catch (error) {
    // Properly log error here
    throw new HttpError('Failed to verify Password', 400);
  }
}
