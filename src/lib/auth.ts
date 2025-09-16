import { jwtDecrypt } from 'jose';

const keyHex = process.env.JWT_SECRET!; // 64-char hex string (from openssl rand -hex 32)
const key = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtDecrypt(token, key);
    return payload;
  } catch (err) {
    console.error('[verifyJWT] Failed to decrypt JWT:', err);
    return null;
  }
}
