'use client'; // This is a client component

import React, { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { placeBid as placeBidAPICall, getAuctionById } from '@/lib/apiClient';
import {
  Container, Typography, Box, TextField, Button, Paper, Grid, CircularProgress,
  Snackbar, Alert, Chip, Avatar
} from '@mui/material';
import { useRouter } from 'next/navigation'; // For potential re-fetch/refresh
import Link from 'next/link';

// Helper to format dates (optional)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
};

export default function AuctionDetailClient({ initialAuction, auctionId }) {
  const { user, isLoading: isUserLoading } = useUser();
  const router = useRouter();

  const [auction, setAuction] = useState(initialAuction);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Update auction state if initialAuction changes (e.g., due to parent re-fetch)
  useEffect(() => {
    setAuction(initialAuction);
  }, [initialAuction]);

  const handleBidSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      setError('Please log in to place a bid.');
      return;
    }
    if (!bidAmount || parseFloat(bidAmount) <= (auction.highestBid?.amount || 0)) {
      setError(`Your bid must be higher than the current highest bid of $${auction.highestBid?.amount || 0}.`);
      return;
    }

    setIsSubmittingBid(true);
    setError(null);
    setSuccess(null);

    try {
      // Fetch access token - this is a placeholder implementation.
      // In a real app, you'd have a robust way to get this, often involving a Next.js API route
      // that uses getAccessToken server-side.
      const tokenResponse = await fetch('/api/get-access-token'); // Assumes you created this API route
      if (!tokenResponse.ok) {
        const errData = await tokenResponse.json();
        throw new Error(errData.error || 'Failed to get access token.');
      }
      const { accessToken } = await tokenResponse.json();

      if (!accessToken) {
        throw new Error('Access token not available.');
      }

      const updatedAuction = await placeBidAPICall(auctionId, parseFloat(bidAmount), accessToken);
      setAuction(updatedAuction); // Update local state with the new auction details
      setSuccess('Bid placed successfully! The auction details have been updated.');
      setBidAmount(''); // Clear bid input
      // router.refresh(); // Optionally, uncomment to re-run server-side data fetching for the page
    } catch (e) {
      console.error('Bid submission error:', e);
      setError(e.message || 'Failed to place bid. Please try again.');
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const fetchLatestAuctionData = async () => {
    try {
        const latestAuction = await getAuctionById(auctionId);
        setAuction(latestAuction);
    } catch (e) {
        console.error("Error fetching latest auction data", e);
        setError("Could not refresh auction data. Please try refreshing the page.")
    }
  };


  if (!auction) {
    // Should have been caught by server page, but as a fallback
    return <Typography>Auction data is not available.</Typography>;
  }

  const canPlaceBid = auction.status === 'OPEN' && user;

  return (
    <Container sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {auction.pictureUrl && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <img
                    src={auction.pictureUrl}
                    alt={auction.title}
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '4px' }}
                />
              </Box>
            )}
          </Grid>
          <Grid item xs={12} md={auction.pictureUrl ? 6 : 12}>
            <Typography variant="h4" component="h1" gutterBottom>
              {auction.title}
            </Typography>
            <Chip
              label={auction.status || 'UNKNOWN'}
              color={auction.status === 'OPEN' ? 'success' : 'default'}
              sx={{ mb: 2 }}
            />
            {auction.description && (
              <Typography variant="body1" sx={{ mb: 2 }}>
                {auction.description}
              </Typography>
            )}
            <Typography variant="h6" sx={{ mb: 1 }}>
              Current Highest Bid: ${auction.highestBid?.amount || 0}
            </Typography>
            {auction.highestBid?.bidder && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                By: {auction.highestBid.bidder}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Seller: {auction.seller || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created: {formatDate(auction.createdAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ends: {formatDate(auction.endingAt)}
            </Typography>
          </Grid>
        </Grid>

        {auction.status === 'OPEN' && (
          <Box sx={{ mt: 4, p: 2, border: '1px solid #eee', borderRadius: '4px' }}>
            <Typography variant="h6" gutterBottom>
              Place Your Bid
            </Typography>
            {isUserLoading ? (
              <CircularProgress />
            ) : user ? (
              <form onSubmit={handleBidSubmit}>
                <TextField
                  fullWidth
                  label="Bid Amount"
                  type="number"
                  variant="outlined"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                  }}
                  sx={{ mb: 2 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmittingBid || !bidAmount}
                  fullWidth
                >
                  {isSubmittingBid ? <CircularProgress size={24} /> : 'Place Bid'}
                </Button>
              </form>
            ) : (
              <Alert severity="info">
                Please <Link href={`/api/auth/login?returnTo=/auctions/${auctionId}`} passHref legacyBehavior>
                    <Button component="a" color="primary">login</Button>
                </Link> to place a bid.
              </Alert>
            )}
          </Box>
        )}
         {auction.status !== 'OPEN' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
                This auction is not open for bidding.
            </Alert>
        )}
      </Paper>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button component={Link} href="/auctions" variant="outlined">
          Back to All Auctions
        </Button>
         <Button onClick={fetchLatestAuctionData} variant="outlined" sx={{ ml: 2 }} disabled={isSubmittingBid}>
            Refresh Auction Data
        </Button>
      </Box>

      {error && (
        <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      )}
      {success && (
        <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
            {success}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
}
