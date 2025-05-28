import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'auth-service-private' });

export async function handler(event, context) {
  logger.addContext(context);
  // The event here will include claims from the authorizer in event.requestContext.authorizer
  logger.info('Private endpoint called', { event });

  const response = {
    statusCode: 200,
    headers: {
        /* Required for CORS support to work */
      'Access-Control-Allow-Origin': '*',
        /* Required for cookies, authorization headers with HTTPS */
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: 'Hi ⊂◉‿◉つ from Private API. Your JWT claims are in the event.requestContext.authorizer.',
      event, // For debugging, shows the full event passed to the Lambda
      // context // Context can be verbose, logged via addContext already
    }),
  };

  logger.info('Private endpoint response', { response });
  return response;
}
