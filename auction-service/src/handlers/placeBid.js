import createError from 'http-errors';
import validator from '@middy/validator';
import { ddb } from '../../../shared/aws';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getAuctionById } from './getAuction';
import commonMiddleware from '../lib/commonMiddleware';
import { getUserEmail } from '../lib/getUserEmail';
import placeBidSchema from '../lib/schemas/placeBidSchema';

async function placeBid(event) {
  const { id } = event.pathParameters;
  const { amount } = event.body;
  const email = getUserEmail(event, 'bidder@example.com');

  // These checks give clear error messages. The condition on the update below
  // is what makes bidding safe when two bids arrive at the same time.
  const auction = await getAuctionById(id);

  if (email === auction.seller) {
    throw new createError.Forbidden(`You cannot bid on your own auctions!`);
  }
  if (email === auction.highestBid.bidder) {
    throw new createError.Forbidden(`You are already the highest bidder`);
  }
  if (auction.status !== 'OPEN') {
    throw new createError.Forbidden(`You cannot bid on closed auctions!`);
  }
  if (amount <= auction.highestBid.amount) {
    throw new createError.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}!`);
  }

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
    // Re-checked by DynamoDB at write time: still open, not ended, and still
    // the highest bid. A losing concurrent bid fails instead of overwriting.
    ConditionExpression:
      '#status = :open AND endingAt > :now AND highestBid.amount < :amount AND seller <> :bidder',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':amount': amount,
      ':bidder': email,
      ':open': 'OPEN',
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };

  let updatedAuction;

  try {
    const result = await ddb.send(new UpdateCommand(params));
    updatedAuction = result.Attributes;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new createError.Conflict(
        'The auction changed while you were bidding (a higher bid arrived or it ended). Please refresh and try again.'
      );
    }
    console.error(error);
    throw new createError.InternalServerError('Could not place the bid');
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

export const handler = commonMiddleware(placeBid)
  .use(validator({ inputSchema: placeBidSchema }));
