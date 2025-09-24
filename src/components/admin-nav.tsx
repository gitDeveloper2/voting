'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  AppBar,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as LayoutDashboard,
  People as Users,
  Rocket,
  HowToVote as Vote,
  BarChart as BarChart3,
  Settings,
  Logout as LogOut,
  Menu,
  Close as X
} from '@mui/icons-material';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Launches', href: '/admin/launches', icon: Rocket },
  { name: 'Voting', href: '/admin/voting', icon: Vote },
  { name: 'Apps', href: '/admin/apps', icon: Vote },
  { name: 'Config', href: '/admin/config', icon: Settings },
  { name: 'Audit', href: '/admin/audit', icon: BarChart3 },
];

export function AdminNav() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  const drawerWidth = 256;

  return (
    <>
      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Voting API Admin
            </Typography>
            <IconButton
              color="inherit"
              edge="end"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        <SidebarContent pathname={pathname} onSignOut={handleSignOut} />
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <SidebarContent pathname={pathname} onSignOut={handleSignOut} />
      </Drawer>
    </>
  );
}

function SidebarContent({ pathname, onSignOut }: { pathname: string; onSignOut: () => void }) {
  const theme = useTheme();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          Voting API
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List sx={{ px: 2, py: 1 }}>
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  sx={{
                    borderRadius: 2,
                    py: 1.5,
                    px: 2,
                    backgroundColor: isActive ? 'primary.main' : 'transparent',
                    color: isActive ? 'primary.contrastText' : 'text.primary',
                    '&:hover': {
                      backgroundColor: isActive 
                        ? 'primary.dark' 
                        : theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive ? 'primary.contrastText' : 'text.secondary',
                      minWidth: 40,
                    }}
                  >
                    <item.icon />
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Sign Out */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', p: 2 }}>
        <Button
          variant="text"
          onClick={onSignOut}
          startIcon={<LogOut />}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            color: 'text.secondary',
            py: 1.5,
            px: 2,
            borderRadius: 2,
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
            },
          }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );
}
