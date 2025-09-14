import { createHash } from 'crypto';
import { Readable } from 'stream';
import dotenv from 'dotenv';

dotenv.config();

// Hash small string or buffer directly
export function computeHash(data: string | Buffer, algorithm = process.env.INTEGRITY_ALGORITHM!): string {
  return createHash(algorithm).update(data).digest('hex');
}

// Async hash for large data streams (files, network streams)
export async function computeHashStream(
  stream: Readable,
  algorithm = process.env.INTEGRITY_ALGORITHM!
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Example stateless check for integrity
// const data = 'Important payload';
// const hash = computeHash(data);

// const receivedData = 'Important payload';
// const receivedHash = computeHash(receivedData);

// console.log('Integrity valid:', hash === receivedHash);
