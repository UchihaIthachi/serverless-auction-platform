import { ddb } from '../../../shared/aws';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

// All OPEN auctions whose end time has passed. A Query returns at most 1 MB per
// call, so keep reading pages until DynamoDB says there are no more.
export async function getEndedAuctions() {
  const now = new Date().toISOString();
  const auctions = [];
  let ExclusiveStartKey;

  do {
    const result = await ddb.send(new QueryCommand({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      IndexName: 'statusAndEndDate',
      KeyConditionExpression: '#status = :status AND endingAt <= :now',
      ExpressionAttributeValues: {
        ':status': 'OPEN',
        ':now': now,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExclusiveStartKey,
    }));

    auctions.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return auctions;
}
