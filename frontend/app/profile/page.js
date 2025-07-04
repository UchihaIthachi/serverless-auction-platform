import { getSession } from '@auth0/nextjs-auth0';
import { redirect } from 'next/navigation';
import { Typography, Container, Box, Paper, Avatar } from '@mui/material';
import Link from 'next/link';
import Button from '@mui/material/Button';

export default async function ProfilePage() {
  const session = await getSession();
  const user = session?.user;

  if (!user) {
    // Users should be redirected to login by the middleware or a client component handling auth state.
    // However, as a fallback, or for direct access attempts, redirect to login.
    // For App Router, it's better to handle this with middleware for server components,
    // or a client component wrapper that checks useUser and redirects.
    // For now, let's assume middleware will handle this, or we can implement a client-side check.
    // For a purely server component, this redirect is one way:
    redirect('/api/auth/login'); // Or a custom login page
  }

  return (
    <Container>
      <Box sx={{ my: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          User Profile
        </Typography>
        {user && (
          <Paper elevation={3} sx={{ p: 3, mt: 2, minWidth: '300px', textAlign: 'center' }}>
            {user.picture && <Avatar src={user.picture} alt={user.name || 'User Picture'} sx={{ width: 80, height: 80, margin: '0 auto 16px' }} />}
            <Typography variant="h6">{user.name}</Typography>
            <Typography color="textSecondary">{user.email}</Typography>
            {user.email_verified !== undefined && (
              <Typography color={user.email_verified ? 'green' : 'red'} sx={{ mt: 1 }}>
                Email {user.email_verified ? 'Verified' : 'Not Verified'}
              </Typography>
            )}
            {/* Display other user information if needed */}
            <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '10px', marginTop: '10px', overflowX: 'auto' }}>
              {JSON.stringify(user, null, 2)}
            </pre>
          </Paper>
        )}
        <Button component={Link} href="/" variant="outlined" sx={{ mt: 3 }}>
          Back to Home
        </Button>
      </Box>
    </Container>
  );
}
