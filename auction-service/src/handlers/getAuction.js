import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import commonMiddleware, { logger } from '../lib/commonMiddleware'; // Import logger
import createError from 'http-errors';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

export async function getAuctionById(id) {
  let auction;
  logger.info('Fetching auction by ID', { auctionId: id });

  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      Key: { id },
    }));

    auction = result.Item;
  } catch (error) {
    logger.error('Error fetching auction by ID', { auctionId: id, errorDetails: error });
    throw new createError.InternalServerError(error);
  }

  if (!auction) {
    logger.warn('Auction not found', { auctionId: id });
    throw new createError.NotFound(`Auction with ID "${id}" not found!`);
  }

  logger.info('Auction fetched successfully', { auctionId: id, auction });
  return auction;
}

async function doGetAuction(event, context) {
  const { id } = event.pathParameters;
  const auction = await getAuctionById(id);
  // Note: Successful fetch is logged within getAuctionById

  return {
    statusCode: 200,
    body: JSON.stringify(auction),
  };
}

export const handler = commonMiddleware(doGetAuction);