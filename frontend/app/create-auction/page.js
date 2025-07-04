'use client'; // This is a client component

import React, { useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { createAuction as createAuctionAPICall } from '@/lib/apiClient';
import {
  Container, Typography, Box, TextField, Button, Paper, CircularProgress,
  Snackbar, Alert
} from '@mui/material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateAuctionPage() {
  const { user, error: userError, isLoading: isUserLoading } = useUser();
  const router = useRouter();

  const [title, setTitle] = useState('');
  // Add more fields here if your backend and apiClient.createAuction support them
  // const [description, setDescription] = useState('');
  // const [startingPrice, setStartingPrice] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }

    // Basic validation for other fields if added
    // if (startingPrice && parseFloat(startingPrice) <= 0) {
    //   setFormError('Starting price must be a positive number.');
    //   return;
    // }

    setIsSubmitting(true);

    try {
      const tokenResponse = await fetch('/api/get-access-token');
      if (!tokenResponse.ok) {
        const errData = await tokenResponse.json();
        throw new Error(errData.error || 'Failed to get access token.');
      }
      const { accessToken } = await tokenResponse.json();

      if (!accessToken) {
        throw new Error('Access token not available.');
      }

      const auctionData = { title };
      // if (description) auctionData.description = description;
      // if (startingPrice) auctionData.startingPrice = parseFloat(startingPrice);

      // The backend for createAuction returns the created auction object, which includes its new ID.
      const newAuction = await createAuctionAPICall(auctionData, accessToken);

      setSuccessMessage('Auction created successfully! Redirecting...');
      setTitle(''); // Clear form
      // setDescription('');
      // setStartingPrice('');

      // Redirect to the new auction's detail page or auctions list
      if (newAuction && newAuction.id) {
        router.push(`/auctions/${newAuction.id}`);
      } else {
        // Fallback if ID is not in response, though it should be
        router.push('/auctions');
      }

    } catch (e) {
      console.error('Auction creation error:', e);
      setFormError(e.message || 'Failed to create auction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography>Loading user information...</Typography>
      </Container>
    );
  }

  if (userError) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Alert severity="error">Error loading user: {userError.message}</Alert>
        <Link href="/" passHref>
          <Button variant="outlined" sx={{ mt: 2 }}>Go to Homepage</Button>
        </Link>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          You need to be logged in to create an auction.
        </Alert>
        <Link href="/api/auth/login?returnTo=/create-auction" passHref legacyBehavior>
            <Button component="a" variant="contained" color="primary">Login</Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Create New Auction
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            label="Auction Title"
            variant="outlined"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            margin="normal"
            error={!!(formError && formError.includes('Title'))} // More specific error highlighting if needed
          />
          {/*
          // Example for description:
          <TextField
            fullWidth
            label="Description (Optional)"
            variant="outlined"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
          />
          // Example for starting price:
          <TextField
            fullWidth
            label="Starting Price (Optional)"
            type="number"
            variant="outlined"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            margin="normal"
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
            }}
          />
          */}

          {formError && (
            <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
              {formError}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSubmitting}
            fullWidth
            sx={{ mt: 3 }}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Create Auction'}
          </Button>
        </Box>
      </Paper>

      {successMessage && (
        <Snackbar
          open={!!successMessage}
          autoHideDuration={6000} // Longer for redirect message
          onClose={() => setSuccessMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSuccessMessage(null)} severity="success" sx={{ width: '100%' }}>
            {successMessage}
          </Alert>
        </Snackbar>
      )}
       <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button component={Link} href="/" variant="outlined">
             Back to Home
            </Button>
        </Box>
    </Container>
  );
}
