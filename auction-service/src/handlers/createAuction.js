import { v4 as uuid } from 'uuid';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import createError from 'http-errors';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import commonMiddleware, { logger } from '../lib/commonMiddleware'; // Import logger
import createAuctionSchema from '../lib/schemas/createAuctionSchema';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// The actual handler function
async function doCreateAuction(event, context) {
  const { title } = event.body; // event.body is already parsed by http-json-body-parser
  const { email } = event.requestContext.authorizer;
  const now = new Date();
  const endDate = new Date();
  endDate.setHours(now.getHours() + 1); // Auction ends 1 hour from now

  const auction = {
    id: uuid(), // Generate a unique ID for the auction
    title,
    status: 'OPEN',
    createdAt: now.toISOString(),
    endingAt: endDate.toISOString(),
    highestBid: {
      amount: 0, // Initial bid amount
    },
    seller: email, // Email of the user creating the auction (from authorizer)
  };

  try {
    await dynamodb.send(new PutCommand({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      Item: auction,
    }));
    logger.info('Auction created successfully', { auction });
  } catch (error) {
    logger.error('Error creating auction', { errorDetails: error, auctionData: auction });
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 201, // HTTP status code for resource created
    body: JSON.stringify(auction),
  };
}

// Transpile the schema (can be done at cold start or pre-compiled)
// For this setup, doing it at cold start is simpler.
const compiledCreateAuctionSchema = transpileSchema(createAuctionSchema);

export const handler = commonMiddleware(doCreateAuction)
  .use(validator({ eventSchema: compiledCreateAuctionSchema }));