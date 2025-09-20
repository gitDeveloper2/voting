import { AdminNav } from '@/components/admin-nav';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Box } from '@mui/material';

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
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AdminNav />
      {/* Main content with proper sidebar spacing */}
      <Box
        sx={{
          ml: { xs: 0, md: '256px' }, // 256px matches the drawer width
          transition: 'margin 0.3s ease-in-out',
          minHeight: '100vh',
        }}
      >
        <Box sx={{ p: { xs: 3, sm: 4 }, maxWidth: '1200px', mx: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
