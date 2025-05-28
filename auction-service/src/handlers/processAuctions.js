import createError from 'http-errors';
import { getEndedAuctions } from '../lib/getEndedAuctions';
import { closeAuction } from '../lib/closeAuction';
import { logger } from '../lib/commonMiddleware'; // Import the shared logger

async function processAuctions(event, context) {
  logger.info('Starting processAuctions');
  try {
    const auctionsToClose = await getEndedAuctions(); // This lib function will be updated to use logger
    logger.info(`Found ${auctionsToClose.length} auctions to close.`);

    const closePromises = auctionsToClose.map(auction => closeAuction(auction)); // This lib function will also use logger
    await Promise.all(closePromises);

    logger.info(`Successfully processed ${closePromises.length} auctions for closing.`);
    return { closed: closePromises.length };
  } catch (error) {
    logger.error('Error in processAuctions handler', { errorDetails: error });
    throw new createError.InternalServerError(error); // Let API Gateway handle the final response
  }
}

export const handler = processAuctions;