import { ddb } from '../../../shared/aws';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

export async function setAuctionPictureUrl(id, pictureUrl) {
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression: 'set pictureUrl = :pictureUrl',
    ExpressionAttributeValues: {
      ':pictureUrl': pictureUrl,
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await ddb.send(new UpdateCommand(params));
  return result.Attributes;
}