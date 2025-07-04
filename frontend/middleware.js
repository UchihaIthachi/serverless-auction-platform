import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';

export default withMiddlewareAuthRequired();

// Configure which routes the middleware applies to
export const config = {
  matcher: ['/profile/:path*'], // Protects the /profile route and its sub-routes
};
