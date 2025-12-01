import createError from 'http-errors';
import validator from '@middy/validator';
import { ddb } from '../../../shared/aws';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import commonMiddleware from '../lib/commonMiddleware';
import getAuctionsSchema from '../lib/schemas/getAuctionsSchema';

async function getAuctions(event, context) {
  const { status } = event.queryStringParameters;
  let auctions;

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    IndexName: 'statusAndEndDate',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeValues: {
      ':status': status,
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
  };

  try {
    const result = await ddb.send(new QueryCommand(params));

    auctions = result.Items;
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(auctions),
  };
}

export const handler = commonMiddleware(getAuctions)
  .use(validator({ inputSchema: getAuctionsSchema, useDefaults: true }));