// apiClient.js

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/dev'; // Default for local dev if not set

/**
 * How to get the Auth0 Access Token for authenticated requests:
 *
 * **Client-Side (in a React Component):**
 *
 * import { useUser } from '@auth0/nextjs-auth0/client';
 *
 * function MyComponent() {
 *   const { user, error, isLoading } = useUser();
 *   // ...
 *   const getSomeData = async () => {
 *     if (!user) return; // or handle unauthenticated state
 *
 *     try {
 *       // Option 1: If you need to call an external API (like this apiClient) from the client-side
 *       // directly, you might need to configure Auth0 to issue JWTs as access tokens,
 *       // or use an intermediate Next.js API route to get the token.
 *       // For SPA-like direct calls with a JWT, ensure your Auth0 app is configured for it.
 *       // A common way is to get an access token for a specific API (audience) you've defined in Auth0.
 *
 *       // If you have an access token (e.g., from a custom hook that calls getAccessToken),
 *       // you'd pass it to the functions below.
 *       // const { getAccessTokenSilently } = useAuth0(); // from auth0-react, if using that directly
 *       // const token = await getAccessTokenSilently({ audience: 'YOUR_API_IDENTIFIER' });
 *
 *       // **Using @auth0/nextjs-auth0/client for an Access Token to call external APIs:**
 *       // The `user` object from `useUser` primarily contains identity information.
 *       // To get an access token for an external API, you typically need to make a request
 *       // to a Next.js API route that can then use `getSession` and `getAccessToken` (server-side)
 *       // to retrieve or mint a token.
 *
 *       // Example: Call a Next.js API route which then calls the external API
 *       // const response = await fetch('/api/my-app-api/some-data');
 *       // const data = await response.json();
 *
 *       // **Alternative for @auth0/nextjs-auth0 (if you need to pass token from client directly):**
 *       // Create a Next.js API route that returns an access token:
 *       // pages/api/get-access-token.js
 *       // import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
 *       // export default withApiAuthRequired(async function accessToken(req, res) {
 *       //   try {
 *       //     const { accessToken } = await getAccessToken(req, res, {
 *       //       scopes: ['read:auctions'] // example scopes
 *       //     });
 *       //     res.status(200).json({ accessToken });
 *       //   } catch (error) {
 *       //     res.status(error.status || 500).json({ error: error.message });
 *       //   }
 *       // });
 *       // Then, from client-side:
 *       // const tokenResponse = await fetch('/api/get-access-token');
 *       // const { accessToken } = await tokenResponse.json();
 *       // await createAuction({ title: 'New Item' }, accessToken);
 *
 *     } catch (e) {
 *       console.error("Error fetching token or data", e);
 *     }
 *   };
 * }
 *
 * **Server-Side (in a Next.js API Route or getServerSideProps/Route Handler):**
 *
 * import { getSession, getAccessToken } from '@auth0/nextjs-auth0';
 *
 * // For App Router Route Handlers (e.g., app/api/some-route/route.js)
 * export async function POST(req) {
 *   const session = await getSession(req);
 *   if (!session || !session.user) {
 *     return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
 *   }
 *   try {
 *     const { accessToken } = await getAccessToken(req, new Response(), {
 *       // scopes: ['read:auctions', 'write:auctions'] // specify scopes needed for your API
 *       // audience: 'YOUR_API_IDENTIFIER' // specify your API audience if configured in Auth0
 *     });
 *     // Now you have the accessToken, you can use it to call your external API
 *     // For example, when `apiClient.js` is used by a server-side Next.js API route:
 *     // const newAuction = await createAuction(await req.json(), accessToken);
 *     // return new Response(JSON.stringify(newAuction), { status: 201 });
 *   } catch (error) {
 *     console.error("Error getting access token or calling API", error);
 *     return new Response(JSON.stringify({ error: error.message }), { status: error.status || 500 });
 *   }
 * }
 */

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.text(); // Try to get more info
    console.error('API Error:', response.status, errorData);
    throw new Error(`API request failed with status ${response.status}: ${errorData || response.statusText}`);
  }
  // Check if response is JSON before parsing
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return response.text(); // Or handle as needed if non-JSON is expected for some endpoints
  }
};

export async function getAuctions() {
  const response = await fetch(`${API_BASE_URL}/auctions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
  return handleResponse(response);
}

export async function getAuctionById(id) {
  const response = await fetch(`${API_BASE_URL}/auction/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
  return handleResponse(response);
}

export async function placeBid(id, amount, token) {
  if (!token) {
    throw new Error('Authentication token is required to place a bid.');
  }
  const response = await fetch(`${API_BASE_URL}/auction/${id}/bid`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }), // Assuming the API expects { "amount": someValue }
  });
  return handleResponse(response);
}

export async function createAuction(auctionData, token) {
  if (!token) {
    throw new Error('Authentication token is required to create an auction.');
  }
  const response = await fetch(`${API_BASE_URL}/auction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(auctionData),
  });
  return handleResponse(response);
}
