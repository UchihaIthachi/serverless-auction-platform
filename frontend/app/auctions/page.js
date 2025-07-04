import React from 'react';
import { getAuctions } from '@/lib/apiClient'; // Ensure this path is correct
import { Container, Typography, Grid, Card, CardContent, CardActionArea, Box, Button } from '@mui/material';
import Link from 'next/link';

// This page will be server-rendered for each request.
// The `async` keyword allows us to `await` data fetching directly in the component.
export default async function AuctionsPage() {
  let auctions = [];
  let error = null;

  try {
    // Fetch auctions on the server for each request
    const fetchedAuctions = await getAuctions();
    // The backend API returns an object with an 'auctions' property which is an array
    auctions = fetchedAuctions?.auctions || [];
  } catch (e) {
    console.error('Failed to fetch auctions:', e);
    error = 'Unable to load auctions at this time. Please try again later.';
    // You might want to log the detailed error 'e' to a server-side logging service
  }

  if (error) {
    return (
      <Container>
        <Box sx={{ my: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error}
          </Typography>
          <Button component={Link} href="/" variant="outlined" sx={{ mt: 2 }}>
            Back to Home
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
        Current Auctions
      </Typography>
      {auctions.length === 0 ? (
        <Typography align="center">No auctions available at the moment. Check back later!</Typography>
      ) : (
        <Grid container spacing={3}>
          {auctions.map((auction) => (
            <Grid item xs={12} sm={6} md={4} key={auction.id}>
              <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardActionArea component={Link} href={`/auctions/${auction.id}`} sx={{ flexGrow: 1 }}>
                  <CardContent>
                    <Typography gutterBottom variant="h6" component="div">
                      {auction.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Status: {auction.status}
                    </Typography>
                    <Typography variant="body1" color="primary" sx={{ mt: 1 }}>
                      Highest Bid: ${auction.highestBid?.amount || 0}
                    </Typography>
                    {/* You can add more details here if available, e.g., auction.endingAt */}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button component={Link} href="/" variant="outlined">
          Back to Home
        </Button>
      </Box>
    </Container>
  );
}

// Note: For server components in Next.js App Router, you don't use getServerSideProps.
// Making the component `async` and awaiting fetches directly achieves SSR per request.
// Error handling should be robust. If getAuctions can throw, a try-catch is essential.
// The actual auction detail page /auctions/[id] is not created in this task.
// Ensure the backend structure for `auction.highestBid.amount` and `auction.status` matches what's used.
// The example `getAuctions` in `apiClient.js` might need adjustment if the API response
// for `/auctions` is directly an array rather than an object like `{ auctions: [] }`.
// Based on typical API design, getAuctions might return an array directly or an object like { data: [] } or { items: [] }.
// The code `auctions = fetchedAuctions?.auctions || [];` assumes it's `{ auctions: [...] }`. Adjust if necessary.
// For example, if `getAuctions()` returns the array directly: `auctions = fetchedAuctions || [];`
// If it's an object like `{ "body": "{\"auctions\":[...]}" }` (double stringified JSON), it needs more parsing.
// Assuming `getAuctions` from `apiClient.js` correctly parses the JSON and returns the expected structure.
// The current `apiClient.js` `handleResponse` should correctly parse JSON once.
// If the API at `NEXT_PUBLIC_API_BASE_URL/auctions` returns `{"auctions": [...]}` then `fetchedAuctions.auctions` is correct.
// If it returns `[...]` directly, then it should be `auctions = fetchedAuctions || []`.
// Let's assume the API returns an object with an 'auctions' key containing the array as per common patterns.
// If not, this page might not display auctions correctly or might error.
// The `apiClient.js` `getAuctions` is calling `/auctions`. The lambda `getAuctions.js` in `auction-service`
// returns `{ statusCode: 200, body: JSON.stringify({ auctions }) }`.
// So, `apiClient.js` `handleResponse` will parse this body once. `fetchedAuctions` will be `{ auctions: [...] }`.
// Thus, `fetchedAuctions.auctions` is the correct way to access the array.
