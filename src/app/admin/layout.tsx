import { AdminNav } from '@/components/admin-nav';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="md:pl-64">
        <div className="p-6 sm:p-8 max-w-7xl mx-auto min-h-screen">
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
