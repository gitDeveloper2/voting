import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import CreateLaunchClient from './client';

async function getAvailableApps() {
  const { db } = await connectToDatabase();
  
  // Get apps that could be included in launches
  const apps = await db.collection('userapps')
    .find({})
    .sort({ totalVotes: -1 })
    .toArray();

  return apps.map(app => ({
    _id: app._id.toString(),
    name: app.name || `App ${app._id.toString().slice(-6)}`,
    description: app.description || undefined,
    totalVotes: app.totalVotes || 0,
    launchDate: app.launchDate || undefined,
    url: app.url || undefined
  }));
}

export default async function NewLaunchPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const availableApps = await getAvailableApps();

  return <CreateLaunchClient availableApps={availableApps} />;
}
