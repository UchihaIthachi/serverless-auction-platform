import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';

// This API route is protected and requires authentication.
// It fetches an access token that can be used to call external APIs
// (like your auction backend) on behalf of the logged-in user.
export const GET = withApiAuthRequired(async function accessToken(req) {
  try {
    // When calling getAccessToken, you can specify scopes and audience
    // if your external API requires them and is configured as an Auth0 Resource Server.
    // For example:
    // const { accessToken } = await getAccessToken(req, res, {
    //   scopes: ['read:auctions', 'write:bids'], // Example scopes
    //   audience: process.env.AUTH0_AUDIENCE, // Your API's audience identifier from Auth0
    // });
    // If your auction service doesn't require specific audience/scopes beyond user identity,
    // a default token might suffice, or Auth0 might be configured to return a JWT by default.
    // However, for machine-to-machine or specific API authorization, audience is typical.

    const res = new Response(); // Next.js App Router requires a Response object for getAccessToken
    const { accessToken } = await getAccessToken(req, res, {
        // Add scopes if your auction API expects them for specific operations
        // scopes: ['place:bid']
    });

    // It's important that the Response object `res` used with `getAccessToken`
    // is the one whose headers will be modified by `getAccessToken` (e.g. to set cookies).
    // Since we are just returning the token in the body, we create a new Response for the client.
    return new Response(JSON.stringify({ accessToken }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting access token:', error);
    return new Response(JSON.stringify({ error: error.message, detail: error.cause || 'Internal server error during token retrieval.' }), {
        status: error.status || 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Note on Auth0 Configuration for Access Tokens to External APIs:
// 1. Your Auction Service (backend) should be registered as an "API" in your Auth0 dashboard.
//    This will give it an "API Audience" identifier.
// 2. Your Next.js Frontend Application (registered as an "Application" in Auth0) should be
//    authorized to request tokens for that API Audience. This is often configured under
//    the "APIs" tab in your Auth0 Application settings, or by enabling RBAC and assigning permissions.
// 3. The `audience` parameter in `getAccessToken` should match this API Audience identifier.
//    Store this identifier in an environment variable, e.g., `AUTH0_AUDIENCE`.
// 4. The Auction Service backend then needs to be configured to validate these JWTs,
//    typically by checking the signature against Auth0's public keys and verifying the `aud` (audience)
//    and `iss` (issuer) claims. The `auth-service` in this project likely handles this.
// Without this, the `accessToken` obtained might be an opaque token intended only for Auth0's /userinfo endpoint,
// or a JWT not recognized/trusted by your auction backend.
// For this task, we assume the default accessToken obtained might work or that `AUTH0_AUDIENCE`
// would be configured if a specific JWT for the backend is needed. The provided code for `getAccessToken`
// is a general template. If `placeBid` fails due to an invalid token, Auth0 audience/scope configuration
// is the primary area to investigate.
