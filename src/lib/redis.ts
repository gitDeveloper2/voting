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
    totalVotes: (toolId: string) => `vote:tool:${toolId}:total`,
    userVoted: (userId: string, toolId: string) => `vote:user:${userId}:tool:${toolId}`,
    activeToolsSet: 'vote:toolIds:active',
  };
  
