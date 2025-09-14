import { 
    randomBytes, 
    createCipheriv, 
    createDecipheriv, 
    DecipherGCM 
} from 'crypto';

const ALGORITHM = process.env.AES_ALGORITHM_GCM!; // Ensure GCM mode for getAuthTag
const KEY = randomBytes(32); // Securely generate and manage this in production

// Standard is 12 or 16 bytes; depends on security needs
// const AUTH_TAG_LENGTH = Number(process.env.AES_AUTH_TAG_LENGTH!);  

export function AESencrypt(text: string): object {
    const iv = randomBytes(12); // GCM requires 12-byte (96-bit) IV for best performance
    const cipher = createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = (cipher as any).getAuthTag();

    return {
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        encrypted
    }
}

export function AESdecrypt(payload: object): string {
    const { iv, tag, encrypted } = payload as { iv: string; tag: string; encrypted: string };
    const ivBuffer = Buffer.from(iv, 'hex');
    const tagBuffer = Buffer.from(tag, 'hex');
    const decipher = createDecipheriv(ALGORITHM, KEY, ivBuffer) as DecipherGCM;
    decipher.setAuthTag(tagBuffer);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}