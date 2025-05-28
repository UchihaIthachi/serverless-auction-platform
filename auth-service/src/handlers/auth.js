import jwt from 'jsonwebtoken';
import JwksRsa from 'jwks-rsa';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'auth-service' });

const jwksClient = new JwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: process.env.JWKS_URI,
});

// Function to retrieve signing key from JWKS
function getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error('Error getting signing key from JWKS', { errorDetails: err, headerKid: header.kid });
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// By default, API Gateway authorizations are cached (TTL) for 300 seconds.
// This policy will authorize all requests to the same API Gateway instance where the
// request is coming from, thus being efficient and optimising costs.
const generatePolicy = (principalId, methodArn) => {
  const apiGatewayWildcard = methodArn.split('/', 2).join('/') + '/*';
  logger.debug('Generating policy', { principalId, apiGatewayWildcard });
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

export async function handler(event, context) {
  // Add Lambda context to all subsequent logger calls
  logger.addContext(context);
  logger.info('Authorizer_Input_event', { event });


  if (!event.authorizationToken) {
    logger.warn('Unauthorized: No authorizationToken provided.');
    throw 'Unauthorized'; // API Gateway maps this to 401
  }

  const token = event.authorizationToken.replace('Bearer ', '');
  logger.debug('Received token', { token }); // Be careful logging tokens unless necessary for debugging

  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getSigningKey, {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: process.env.AUTH0_ISSUER,
        algorithms: ['RS256'] // Specify algorithm, usually RS256 for Auth0 JWKS
      }, (error, decodedToken) => {
        if (error) {
          logger.error('JWT verification error', { errorDetails: error });
          return reject(error); // This will be caught by the outer try/catch
        }
        resolve(decodedToken);
      });
    });

    logger.info('Token validated successfully', { principalId: decoded.sub, claims: decoded });
    const policy = generatePolicy(decoded.sub, event.methodArn);

    // Return the policy and the decoded claims as context for the backend Lambda
    return {
      ...policy,
      context: decoded
    };
  } catch (error) {
    // Error is already logged by jwt.verify callback or getSigningKey
    // If not, an additional logger.error('Authorization error', { errorDetails: error }); could be placed here.
    // For example, if the Promise wrapper itself throws an error not caught by logger.error inside.
    logger.error('Authorization failed', { errorDetails: error.message ? error.message : error });
    throw 'Unauthorized'; // API Gateway maps this to 401
  }
}
