import argon2 from 'argon2';

const options = {
  type: argon2.argon2id, // Recommended variant mixing Argon2i and Argon2d
  memoryCost: 2 ** 16, // 64 MiB RAM, adjustable based on load
  timeCost: 3, // Number of iterations
  parallelism: 1, // Parallel threads; tune per your environment
};

// Hash password async with options tuned for security and performance
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

// Verify password securely and asynchronously
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // Catch failures such as invalid hash format
  }
}

// Example usage
// (async () => {
//   const pwd = 'StrongP@ssword!';
//   const hash = await hashPassword(pwd);
//   const isValid = await verifyPassword(hash, pwd);
//   console.log({ hash, isValid });
// })();
