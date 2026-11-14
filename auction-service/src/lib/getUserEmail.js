import createError from 'http-errors';

// Stages without Auth0: serverless-offline (local) and the stacks deployed into
// LocalStack (localstack, which the serverless-localstack plugin can only
// deploy to localhost). Every other stage requires the authorizer's email.
const NO_AUTH_STAGES = new Set(['local', 'localstack']);

// The signed-in user's email, set by the auth-service authorizer. Only the
// no-auth stages fall back to a test identity, so a missing authorizer can
// never act as a default user on AWS.
export function getUserEmail(event, localFallback) {
  const email = event.requestContext && event.requestContext.authorizer
    && event.requestContext.authorizer.email;

  if (email) return email;
  if (NO_AUTH_STAGES.has(process.env.STAGE)) return localFallback;

  throw new createError.Unauthorized('No user email in the token');
}
