import { LaunchDocument } from './launches';

export async function fetchLaunches(): Promise<LaunchDocument[]> {
  const response = await fetch('/api/admin/launches');
  if (!response.ok) {
    throw new Error('Failed to fetch launches');
  }
  return response.json();
}

export async function flushLaunch(launchDate: string): Promise<LaunchDocument> {
  const response = await fetch(`/api/admin/launches/${launchDate}/flush`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to flush launch');
  }
  
  return response.json();
}

export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'flushing':
      return 'bg-yellow-100 text-yellow-800';
    case 'flushed':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
