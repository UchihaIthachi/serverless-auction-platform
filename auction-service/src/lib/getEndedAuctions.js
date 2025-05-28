import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { logger } from './commonMiddleware';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

export async function getEndedAuctions() {
  const now = new Date();
  logger.info('Fetching ended auctions', { currentTime: now.toISOString() });

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    IndexName: 'statusAndEndDate',
    KeyConditionExpression: '#status = :status AND endingAt <= :now',
    ExpressionAttributeValues: {
      ':status': 'OPEN',
      ':now': now.toISOString(),
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
  };

  const result = await dynamodb.send(new QueryCommand(params));
  return result.Items;
}