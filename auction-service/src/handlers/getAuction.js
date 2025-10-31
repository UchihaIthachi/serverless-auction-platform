import commonMiddleware from '../lib/commonMiddleware';
import createError from 'http-errors';
import { ddb } from '../../../shared/aws';

export async function getAuctionById(id) {
  let auction;

  try {
    const result = await ddb.get({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      Key: { id },
    });

    auction = result.Item;
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  if (!auction) {
    throw new createError.NotFound(`Auction with ID "${id}" not found!`);
  }

  return auction;
}

async function getAuction(event, context) {
  const { id } = event.pathParameters;
  const auction = await getAuctionById(id);

  return {
    statusCode: 200,
    body: JSON.stringify(auction),
  };
}

export const handler = commonMiddleware(getAuction);