import createError from 'http-errors';

// The signed-in user's email, set by the auth-service authorizer.
// Only the local stage (serverless-offline, no authorizer) falls back to a
// test identity, so a missing authorizer can never act as a default user on AWS.
export function getUserEmail(event, localFallback) {
  const email = event.requestContext && event.requestContext.authorizer
    && event.requestContext.authorizer.email;

  if (email) return email;
  if (process.env.STAGE === 'local') return localFallback;

  throw new createError.Unauthorized('No user email in the token');
}
