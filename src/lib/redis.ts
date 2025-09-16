import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!);

redis.on('connect', () => {
  console.log('[Redis] Connecting...');
});

redis.on('ready', () => {
  console.log('[Redis] Connected and ready ✅');
});

redis.on('error', (err) => {
  console.error('[Redis] Error ❌', err);
});

redis.on('close', () => {
  console.warn('[Redis] Connection closed');
});

redis.on('reconnecting', () => {
  console.log('[Redis] Reconnecting...');
});

redis.on('end', () => {
  console.warn('[Redis] Connection ended');
});

export const voteKeys = {
  votes: (appId: string) => `votes:${appId}`,
  userVote: (userId: string, appId: string) => `user:${userId}:vote:${appId}`,
  launchApps: 'launch:today:apps'
};
