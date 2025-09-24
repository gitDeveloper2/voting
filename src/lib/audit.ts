import { connectToDatabase } from '@/lib/mongodb';

export type AuditEventType = 'cron' | 'revalidation' | 'maintenance' | 'other';

export interface AuditLog {
  _id?: string;
  type: AuditEventType;
  name?: string; // e.g., daily-launch-cycle, flush-launch
  path?: string; // for revalidation path
  route?: string; // API route path
  requestId?: string;
  status: 'success' | 'error' | 'info' | 'start' | 'end';
  message?: string;
  payload?: any;
  error?: { message: string; stack?: string } | null;
  createdAt: Date;
}

export async function logAudit(entry: Omit<AuditLog, 'createdAt'>): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    // Ensure we do not provide a string _id when inserting, to satisfy OptionalId<Document>
    // Strip _id if present and let MongoDB generate it
    const { _id: _ignored, ...doc } = entry as any;
    await db.collection('audit_logs').insertOne({ ...doc, createdAt: new Date() } as any);
  } catch (err) {
    // Do not throw from logging
    console.warn('[Audit] Failed to write audit log', err);
  }
}

export async function getAuditLogs(options?: { type?: AuditEventType; limit?: number }) {
  const { db } = await connectToDatabase();
  const query: any = {};
  if (options?.type) query.type = options.type;
  const limit = options?.limit ?? 50;
  const docs = await db
    .collection('audit_logs')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d: any) => ({ ...d, _id: d._id?.toString(), createdAt: d.createdAt?.toISOString() }));
}
