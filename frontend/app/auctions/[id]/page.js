import React from 'react';
import { getAuctionById } from '@/lib/apiClient';
import AuctionDetailClient from '@/components/AuctionDetailClient'; // Client component for interactions
import { Container, Typography, Box, Button, Alert } from '@mui/material';
import Link from 'next/link';

// This page will be server-rendered for each request.
// The `async` keyword allows us to `await` data fetching directly in the component.
// `params` will contain the dynamic route parameters, e.g., { id: '...' }
export default async function AuctionDetailPage({ params }) {
  const { id } = params;
  let auction = null;
  let error = null;

  try {
    // Fetch auction details on the server for each request
    const fetchedAuction = await getAuctionById(id);
    // The backend API for getAuctionById returns the auction object directly (not nested)
    auction = fetchedAuction;
  } catch (e) {
    console.error(`Failed to fetch auction ${id}:`, e);
    if (e.message && e.message.includes('404')) {
      error = `Auction with ID ${id} not found.`;
    } else {
      error = 'Unable to load auction details at this time. Please try again later.';
    }
    // You might want to log the detailed error 'e' to a server-side logging service
  }

  if (error) {
    return (
      <Container>
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Button component={Link} href="/auctions" variant="outlined">
            Back to Auctions
          </Button>
        </Box>
      </Container>
    );
  }

  if (!auction) {
    // This case should ideally be caught by the 404 error handling above,
    // but as a fallback:
    return (
      <Container>
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Auction not found.
          </Typography>
          <Button component={Link} href="/auctions" variant="outlined">
            Back to Auctions
          </Button>
        </Box>
      </Container>
    );
  }

  // Pass the server-fetched auction data to a client component
  // to handle client-side interactions like placing a bid.
  return <AuctionDetailClient initialAuction={auction} auctionId={id} />;
}

// Note on data structure:
// The `getAuctionById` from `apiClient.js` is expected to return the auction object directly.
// Example structure for an auction object:
// {
//   id: 'string',
//   title: 'string',
//   description: 'string', // Optional
//   status: 'OPEN' | 'CLOSED',
//   createdAt: 'ISOString_date',
//   endingAt: 'ISOString_date',
//   highestBid: {
//     amount: number,
//     bidder: 'string_email_or_id' // Optional
//   },
//   seller: 'string_email_or_id' // Optional
//   pictureUrl: 'string' // Optional
// }
// The actual fields will depend on the backend API schema.
// The AuctionDetailClient component will need to be created to handle display and bidding.
