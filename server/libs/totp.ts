import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import { db, tables } from "../database/db";
import { decrypt, encrypt } from "./encryption";

export async function getUserTOTPKey(userId: string): Promise<Uint8Array | null> {
  const result = await db
    .select({ key: tables.totp_credential.key })
    .from(tables.totp_credential)
    .where(eq(tables.totp_credential.user_id, userId))
    .limit(1);

  const row = result[0];
  if (row === undefined || row.key === null) {
    return null;
  }

  const encryptedArray = new Uint8Array(Buffer.from(row.key, "base64"));
  return decrypt(encryptedArray);
}

export async function updateUserTOTPKey(userId: string, key: Uint8Array): Promise<void> {
  const encrypted = encrypt(key);
  await db.transaction(async (tx) => {
    await tx.delete(tables.totp_credential).where(eq(tables.totp_credential.user_id, userId));
    await tx.insert(tables.totp_credential).values({
      user_id: userId,
      key: Buffer.from(encrypted).toString("base64"),
      created_at: new Date(),
      updated_at: new Date(),
    });
  });
}

export async function deleteUserTOTPKey(userId: string): Promise<void> {
  await db.delete(tables.totp_credential).where(eq(tables.totp_credential.user_id, userId));
}
