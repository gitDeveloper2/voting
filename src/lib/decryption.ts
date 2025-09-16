import crypto from 'crypto';

type VotingTokenPayload = {
  sub: string;
  role?: string;
  pro?: boolean;
  [key: string]: any;
};

const algorithm = 'aes-256-gcm';
const ivLength = 12;

const secretKey = crypto.createHash('sha256')
  .update(process.env.NEXTAUTH_SECRET!)
  .digest();

export function decryptVotingToken(token: string): VotingTokenPayload {
  try {
    const data = Buffer.from(token, 'base64');

    console.log('🔓 Decryption started...');
    console.log('🔑 Raw token length (base64 decoded):', data.length);
    console.log('🧩 Token hex preview:', data.toString('hex').slice(0, 100) + '...');

    if (data.length < ivLength + 16 + 1) {
      throw new Error('Token too short to contain IV + AuthTag + Ciphertext');
    }

    const iv = data.subarray(0, ivLength);
    const authTag = data.subarray(ivLength, ivLength + 16);
    const encrypted = data.subarray(ivLength + 16);

    console.log('🧊 IV:', iv.toString('hex'));
    console.log('🔒 Auth Tag:', authTag.toString('hex'));
    console.log('📦 Encrypted payload length:', encrypted.length);

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const result = JSON.parse(decrypted.toString('utf8'));

    console.log('✅ Decryption successful:', result);
    return result as VotingTokenPayload;
  } catch (err) {
    console.error('❌ Decryption failed:', err);
    throw err;
  }
}
