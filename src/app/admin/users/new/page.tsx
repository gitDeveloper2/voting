import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { UserForm } from '@/components/user-form';

export default async function NewUserPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Create New User</h2>
        <p className="text-muted-foreground">
          Add a new user to the system
        </p>
      </div>
      <UserForm />
    </div>
  );
}
