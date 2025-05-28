import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpErrorHandler from '@middy/http-error-handler';
import httpCors from '@middy/http-cors';
import { Logger } from '@aws-lambda-powertools/logger';

// Initialize Powertools Logger
const logger = new Logger({ serviceName: 'auction-service' });

// Custom middleware to enhance logging context
const customLoggerContextMiddleware = () => ({
  before: async (request) => {
    // Add AWS Request ID as a persistent log attribute for all subsequent logs in this invocation
    if (request.context && request.context.awsRequestId) {
      logger.addPersistentLogAttributes({
        awsRequestId: request.context.awsRequestId,
      });
    }
    // Optionally, log the event itself for debugging (can be verbose)
    // logger.debug('Received event:', { event: request.event });
  }
  // No onError needed here as httpErrorHandler is used and configured with the logger
});

export default (handler) => {
  return middy(handler)
    .use(customLoggerContextMiddleware()) // Added custom logger context middleware early
    .use(httpJsonBodyParser())
    .use(httpEventNormalizer())
    .use(httpErrorHandler({
      logger: (error) => {
        // The http-error-handler middleware passes the original error object here.
        // Powertools logger will serialize the error object correctly.
        logger.error('Error handled by http-error-handler', { errorDetails: error });
      }
    }))
    .use(httpCors());
};

// Export the logger instance for use in handlers and other lib files
export { logger };