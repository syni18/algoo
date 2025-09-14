import {
  createECDH,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

const CURVE = process.env.ECC_CURVE!;
const AES_ALGO = process.env.AES_ALGORITHM_CBC!;

// 1. Receiver generates persistent key pair (do this once, store securely)
export function generateReceiverKeys() {
  const receiverECDH = createECDH(CURVE);
  receiverECDH.generateKeys();

  return {
    publicKey: receiverECDH.getPublicKey("base64"),
    privateKey: receiverECDH.getPrivateKey("base64"), // ⚠️ store securely
  };
}

// 2. Sender encrypts a message using receiver’s public key
export function ECCencryptMessage(message: string, receiverPublicKeyBase64: string) {
  const senderECDH = createECDH(CURVE);
  senderECDH.generateKeys();

  // derive shared secret
  const sharedSecret = senderECDH.computeSecret(
    Buffer.from(receiverPublicKeyBase64, "base64")
  );
  const aesKey = sharedSecret.subarray(0, 32);

  // encrypt with AES
  const iv = randomBytes(16);
  const cipher = createCipheriv(AES_ALGO, aesKey, iv);

  let encrypted = cipher.update(message, "utf8", "base64");
  encrypted += cipher.final("base64");

  return {
    encrypted,
    iv: iv.toString("base64"),
    senderPublicKey: senderECDH.getPublicKey("base64"),
  };
}

// 3. Receiver decrypts using their private key and sender’s public key
export function ECCdecryptMessage(
  encrypted: string,
  ivBase64: string,
  senderPublicKeyBase64: string,
  receiverPrivateKeyBase64: string
) {
  const receiverECDH = createECDH(CURVE);
  receiverECDH.setPrivateKey(Buffer.from(receiverPrivateKeyBase64, "base64"));

  const sharedSecret = receiverECDH.computeSecret(
    Buffer.from(senderPublicKeyBase64, "base64")
  );
  const aesKey = sharedSecret.subarray(0, 32);

  const iv = Buffer.from(ivBase64, "base64");
  const decipher = createDecipheriv(AES_ALGO, aesKey, iv);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}


// --- IGNORE ---
// Step 1: Receiver creates persistent keys (done once)
// const receiverKeys = generateReceiverKeys();
// console.log("Receiver Public Key:", receiverKeys.publicKey);

// // Step 2: Sender encrypts using receiver’s public key
// const { encrypted, iv, senderPublicKey } = ECCencryptMessage(
//   "Hello, ECC secure message!",
//   receiverKeys.publicKey
// );
// console.log("Encrypted:", encrypted);

// // Step 3: Receiver decrypts using their private key + sender’s public key
// const decrypted = ECCdecryptMessage(
//   encrypted,
//   iv,
//   senderPublicKey,
//   receiverKeys.privateKey
// );
// console.log("Decrypted:", decrypted);
// --- IGNORE ---