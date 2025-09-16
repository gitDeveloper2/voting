
import { connectToMongo } from '@/lib/mongoose';
import { redis } from '@/lib/redis';
import { Tool } from '@/models/Tool';

export async function flushExpiredVotes() {
  await connectToMongo();

  const now = new Date();
  const overrideMins = Number(process.env.VOTING_FLUSH_AFTER_MINUTES || '0');

  // Get all tools where voting should be over but haven't been flushed
  const tools = await Tool.find({
    votingFlushed: false,
    launchDate: { $exists: true },
  });

  const toFlush = tools.filter((tool) => {
    const durationHrs = tool.votingDurationHours ?? 24;
    const customMs = overrideMins > 0 ? overrideMins * 60_000 : durationHrs * 3_600_000;
    const votingEndsAt = new Date(tool.launchDate.getTime() + customMs);
    return now > votingEndsAt;
  });

  if (toFlush.length === 0) {
    console.log('[Flush] No tools to flush');
    return;
  }

  console.log(`[Flush] Flushing ${toFlush.length} tools...`);

  for (const tool of toFlush) {
    const toolId = tool._id.toString();
    const voteKey = `votes:${toolId}`;

    const rawVotes = await redis.get(voteKey);
    const votes = parseInt(rawVotes || '0', 10);

    await Tool.updateOne(
      { _id: toolId },
      {
        $inc: { 'stats.votes': votes },
        $set: { votingFlushed: true },
      }
    );

    await redis.del(voteKey);

    // Clean up user vote keys if needed (optional)
    // For efficiency: store voted keys in a set or TTL them on write

    console.log(`[Flush] Flushed ${votes} vote(s) for tool ${tool.name}`);
  }

  console.log('[Flush] Done.');
}
