import jwt from 'jsonwebtoken';

// By default, API Gateway authorizations are cached (TTL) for 300 seconds.
// This policy will authorize all requests to the same API Gateway instance where the
// request is coming from, thus being efficient and optimising costs.
const generatePolicy = (principalId, methodArn) => {
  const apiGatewayWildcard = methodArn.split('/', 2).join('/') + '/*';

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: apiGatewayWildcard,
        },
      ],
    },
  };
};

// Only accept RS256 tokens issued by our Auth0 tenant for our API. Outside the
// local stage the audience and issuer must be configured.
function verifyOptions() {
  const options = { algorithms: ['RS256'] };
  const { AUTH0_AUDIENCE, AUTH0_ISSUER, STAGE } = process.env;

  if (AUTH0_AUDIENCE) options.audience = AUTH0_AUDIENCE;
  if (AUTH0_ISSUER) options.issuer = AUTH0_ISSUER;

  if (STAGE !== 'local' && (!options.audience || !options.issuer)) {
    throw new Error('AUTH0_AUDIENCE and AUTH0_ISSUER must be set');
  }
  return options;
}

export async function handler(event) {
  if (!event.authorizationToken) {
    throw 'Unauthorized';
  }

  const token = event.authorizationToken.replace(/^Bearer\s+/i, '');

  try {
    const claims = jwt.verify(token, process.env.AUTH0_PUBLIC_KEY, verifyOptions());
    const policy = generatePolicy(claims.sub, event.methodArn);

    // API Gateway only accepts strings, numbers and booleans in the
    // authorizer context, so pass just what the services use.
    const context = { sub: String(claims.sub) };
    if (typeof claims.email === 'string') context.email = claims.email;

    return { ...policy, context };
  } catch (error) {
    console.log('auth failed:', error.message);
    throw 'Unauthorized';
  }
}
