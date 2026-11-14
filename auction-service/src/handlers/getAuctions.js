import createError from 'http-errors';
import validator from '@middy/validator';
import { ddb } from '../../../shared/aws';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import commonMiddleware from '../lib/commonMiddleware';
import getAuctionsSchema from '../lib/schemas/getAuctionsSchema';

// The page cursor is DynamoDB's LastEvaluatedKey, base64url-encoded so it is
// opaque to clients and safe in a query string.
export const encodeToken = (key) => Buffer.from(JSON.stringify(key)).toString('base64url');

export function decodeToken(token) {
  try {
    const key = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const ok = key && typeof key === 'object' && ['id', 'status', 'endingAt'].every((k) => typeof key[k] === 'string');
    if (!ok) throw new Error('bad shape');
    return key;
  } catch {
    throw new createError.BadRequest('nextToken is not valid');
  }
}

// Lists auctions by status, soonest-ending first, one page at a time. The
// body stays a plain array (backwards compatible); the cursor for the next
// page comes back in the X-Next-Token header.
async function getAuctions(event) {
  const { status, limit, nextToken } = event.queryStringParameters;
  const ExclusiveStartKey = nextToken ? decodeToken(nextToken) : undefined;
  if (ExclusiveStartKey && ExclusiveStartKey.status !== status) {
    throw new createError.BadRequest('nextToken belongs to a different status');
  }

  let result;
  try {
    result = await ddb.send(new QueryCommand({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      IndexName: 'statusAndEndDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeValues: { ':status': status },
      ExpressionAttributeNames: { '#status': 'status' },
      Limit: limit,
      ExclusiveStartKey,
    }));
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError('Could not list auctions');
  }

  const headers = { 'Access-Control-Expose-Headers': 'X-Next-Token' };
  if (result.LastEvaluatedKey) headers['X-Next-Token'] = encodeToken(result.LastEvaluatedKey);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result.Items || []),
  };
}

export const handler = commonMiddleware(getAuctions)
  .use(validator({ inputSchema: getAuctionsSchema, useDefaults: true }));
