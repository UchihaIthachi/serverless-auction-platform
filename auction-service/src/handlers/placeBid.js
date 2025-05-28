import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import createError from 'http-errors';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import { getAuctionById } from './getAuction';
import commonMiddleware, { logger } from '../lib/commonMiddleware'; // Import logger
import placeBidSchema from '../lib/schemas/placeBidSchema';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

async function doPlaceBid(event, context) {
  const { id } = event.pathParameters;
  const { amount } = event.body; // event.body is already parsed
  const { email } = event.requestContext.authorizer;

  logger.info('Placing bid', { auctionId: id, amount, bidderEmail: email });

  const auction = await getAuctionById(id); // getAuctionById already logs

  // Bid identity validation
  if (email === auction.seller) {
    logger.warn('Bid attempt by seller', { auctionId: id, sellerEmail: email });
    throw new createError.Forbidden(`You cannot bid on your own auctions!`);
  }

  // Avoid double bidding
  if (email === auction.highestBid.bidder) {
    logger.warn('Attempt to double bid by current highest bidder', { auctionId: id, bidderEmail: email });
    throw new createError.Forbidden(`You are already the highest bidder`);
  }

  // Auction status validation
  if (auction.status !== 'OPEN') {
    logger.warn('Bid attempt on closed auction', { auctionId: id, auctionStatus: auction.status });
    throw new createError.Forbidden(`You cannot bid on closed auctions!`);
  }

  // Bid amount validation
  if (amount <= auction.highestBid.amount) {
    logger.warn('Bid amount too low', { auctionId: id, bidAmount: amount, currentHighestBid: auction.highestBid.amount });
    throw new createError.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}!`);
  }

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
    ExpressionAttributeValues: {
      ':amount': amount,
      ':bidder': email,
    },
    ReturnValues: 'ALL_NEW', // Returns all attributes of the item after the update
  };

  let updatedAuction;

  try {
    const result = await dynamodb.send(new UpdateCommand(params));
    updatedAuction = result.Attributes;
    logger.info('Bid placed successfully', { auctionId: id, updatedAuction });
  } catch (error) {
    logger.error('Error placing bid', { auctionId: id, amount, bidderEmail: email, errorDetails: error });
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

const compiledPlaceBidSchema = transpileSchema(placeBidSchema);

export const handler = commonMiddleware(doPlaceBid)
  .use(validator({ eventSchema: compiledPlaceBidSchema }));