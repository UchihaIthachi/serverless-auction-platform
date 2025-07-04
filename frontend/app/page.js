'use client';
import React from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Button, Typography, Container, Box } from '@mui/material';
import Link from 'next/link';

export default function HomePage() {
  const { user, error, isLoading } = useUser();

  if (isLoading) return <Typography>Loading...</Typography>;
  if (error) return <Typography>Error: {error.message}</Typography>;

  return (
    <Container>
      <Box sx={{ my: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to the Auction App
        </Typography>
        {user ? (
          <>
            <Typography variant="h6">Hello, {user.name || user.email}!</Typography>
            <img src={user.picture} alt={user.name} style={{ borderRadius: '50%', width: '100px', height: '100px', margin: '20px 0' }} />
            <Button variant="contained" color="secondary" href="/api/auth/logout" sx={{ mt: 2 }}>
              Logout
            </Button>
            <Button variant="outlined" component={Link} href="/profile" sx={{ mt: 2, ml: 2 }}>
              View Profile (Protected)
            </Button>
            <Button variant="outlined" component={Link} href="/auctions" sx={{ mt: 2, ml: 2 }}>
              View Auctions
            </Button>
          </>
        ) : (
          <>
            <Typography sx={{ mb: 2 }}>Please log in to continue.</Typography>
            <Button variant="contained" color="primary" href="/api/auth/login">
              Login
            </Button>
          </>
        )}
      </Box>
    </Container>
  );
}
