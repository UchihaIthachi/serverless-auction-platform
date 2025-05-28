import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import createError from 'http-errors';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import commonMiddleware, { logger } from '../lib/commonMiddleware'; // Import logger
import getAuctionsSchema from '../lib/schemas/getAuctionsSchema';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

async function doGetAuctions(event, context) {
  const { status } = event.queryStringParameters; // Defaults handled by validator
  let auctions;
  logger.info('Fetching auctions by status', { status });

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    IndexName: 'statusAndEndDate', // Querying the GSI
    KeyConditionExpression: '#status = :status', // Using placeholder for 'status' attribute name
    ExpressionAttributeValues: {
      ':status': status, // Value for the status condition
    },
    ExpressionAttributeNames: {
      '#status': 'status', // Mapping placeholder to actual attribute name 'status'
    },
  };

  try {
    const result = await dynamodb.send(new QueryCommand(params));
    auctions = result.Items;
    logger.info(`Successfully fetched ${auctions.length} auctions with status ${status}.`);
  } catch (error) {
    logger.error('Error fetching auctions by status', { status, errorDetails: error });
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(auctions),
  };
}

// Transpile the schema. `useDefaults: 'empty'` is part of default ajvOptions in transpileSchema,
// which should cover the default for `status`.
const compiledGetAuctionsSchema = transpileSchema(getAuctionsSchema);

export const handler = commonMiddleware(doGetAuctions)
  .use(validator({ eventSchema: compiledGetAuctionsSchema }));