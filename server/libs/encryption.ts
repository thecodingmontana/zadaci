import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv } from "node:crypto";
import { DynamicBuffer } from "@oslojs/binary";
import { decodeBase64 } from "@oslojs/encoding";

const REQUIRED_KEY_LENGTH = 16;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const MIN_ENCRYPTED_LENGTH = IV_LENGTH + AUTH_TAG_LENGTH + 1;

function validateKey(key: Uint8Array): void {
  if (key.length !== REQUIRED_KEY_LENGTH) {
    throw new Error(
      `Encryption key must be exactly ${REQUIRED_KEY_LENGTH} bytes (got ${key.length} bytes)`,
    );
  }
}

function getEncryptionKey(): Uint8Array {
  const rawKey = decodeBase64(process.env.ENCRYPTION_KEY ?? "");
  validateKey(rawKey);
  return rawKey;
}

function bufferToUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function encrypt(data: Uint8Array): Uint8Array {
  const key = getEncryptionKey();
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);

  const cipher = createCipheriv("aes-128-gcm", key, iv);

  const encrypted = new DynamicBuffer(data.length + IV_LENGTH + AUTH_TAG_LENGTH);
  encrypted.write(iv);
  encrypted.write(bufferToUint8Array(cipher.update(data)));
  encrypted.write(bufferToUint8Array(cipher.final()));
  encrypted.write(bufferToUint8Array(cipher.getAuthTag()));

  const result = encrypted.bytes();
  return Buffer.isBuffer(result) ? bufferToUint8Array(result) : result;
}

export function decrypt(encrypted: Uint8Array): Uint8Array {
  const key = getEncryptionKey();

  if (encrypted.byteLength < MIN_ENCRYPTED_LENGTH) {
    throw new Error(`Encrypted data too short: ${encrypted.byteLength} bytes`);
  }

  try {
    const iv = encrypted.subarray(0, IV_LENGTH);
    const authTag = encrypted.subarray(encrypted.byteLength - AUTH_TAG_LENGTH);
    const encryptedData = encrypted.subarray(IV_LENGTH, encrypted.byteLength - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv("aes-128-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = new DynamicBuffer(encryptedData.length);
    decrypted.write(bufferToUint8Array(decipher.update(encryptedData)));
    decrypted.write(bufferToUint8Array(decipher.final()));

    const result = decrypted.bytes();
    return Buffer.isBuffer(result) ? bufferToUint8Array(result) : result;
  } catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Decryption failed: ${error.message}`);
    }
    throw error;
  }
}

export function encryptString(data: string): Uint8Array {
  return encrypt(new TextEncoder().encode(data));
}

export function decryptToString(data: Uint8Array): string {
  return new TextDecoder().decode(decrypt(data));
}
