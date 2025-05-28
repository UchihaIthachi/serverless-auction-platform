import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { logger } from './commonMiddleware';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

export async function setAuctionPictureUrl(id, pictureUrl) {
  logger.info('Setting picture URL for auction', { auctionId: id, pictureUrl });
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set pictureUrl = :pictureUrl',
    ExpressionAttributeValues: {
      ':pictureUrl': pictureUrl,
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.send(new UpdateCommand(params));
  return result.Attributes;
}