import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'auth-service-public' });

export async function handler(event, context) {
  logger.addContext(context);
  logger.info('Public endpoint called', { event });

  const response = {
    statusCode: 200,
    headers: {
      /* Required for CORS support to work */
      'Access-Control-Allow-Origin': '*',
      /* Required for cookies, authorization headers with HTTPS */
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: 'Hi ⊂◉‿◉つ from Public API',
    }),
  };

  logger.info('Public endpoint response', { response });
  return response;
}