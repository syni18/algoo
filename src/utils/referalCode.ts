import { createHash } from 'crypto';

// Define Base62 alphabet
const ALPHABET = process.env.ALPHABET!;
const REFERAL_SALT = process.env.REFERAL_SALT!;
const REFERAL_LEN = Number(process.env.REFERAL_CODE_LEN!);

export const base62EncodeBytes = (bytes: Buffer, length: number): string => {
  let num = BigInt('0x' + bytes.toString('hex'));
  let code = '';
  for (let i = 0; i < length; i++) {
    code = ALPHABET[Number(num % BigInt(62))] + code;
    num /= BigInt(62);
  }
  return code;
};

export const generateReferralCode = (username: string): string => {
  const hash = createHash('sha256')
    .update(username + REFERAL_SALT)
    .digest();
  return base62EncodeBytes(hash.slice(0, 6), REFERAL_LEN); // 6 bytes → up to 8 chars
};

// Example usage
// const username = "sahil_2";
// const referralCode = generateReferralCode(username);

// console.log(referralCode);
