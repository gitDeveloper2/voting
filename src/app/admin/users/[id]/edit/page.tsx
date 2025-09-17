import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { UserForm } from '@/components/user-form';

export default async function EditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'admin') {
    redirect('/login');
  }

  if (!ObjectId.isValid(params.id)) {
    notFound();
  }

  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(params.id) },
    { projection: { password: 0 } }
  );

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit User</h2>
        <p className="text-muted-foreground">
          Update user details
        </p>
      </div>
      <UserForm 
        initialData={{
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        }} 
        isEditing 
      />
    </div>
  );
}
