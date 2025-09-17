import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

export async function requireSession() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireSession();
  if (user.role !== 'admin') {
    throw new Error('Admin privileges required');
  }
  return user;
}

export async function isAdmin() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
