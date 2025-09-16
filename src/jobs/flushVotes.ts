// This file is deprecated - vote flushing is now handled by the launches system
// Use the cron jobs: /api/cron/create-launch and /api/cron/flush-launch

export async function flushExpiredVotes() {
  throw new Error('Vote flushing deprecated. Use the launches system cron jobs instead.');
}
