import { ddb, sqs, SendMessageCommand } from '../../../shared/aws';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

function queueMail(recipient, subject, body) {
  return sqs.send(new SendMessageCommand({
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({ subject, recipient, body }),
  }));
}

// Closes one auction and queues the emails. Returns false if it was already
// closed (for example by an overlapping scheduled run), so emails go out once.
export async function closeAuction(auction) {
  try {
    await ddb.send(new UpdateCommand({
      TableName: process.env.AUCTIONS_TABLE_NAME,
      Key: { id: auction.id },
      UpdateExpression: 'set #status = :closed, closedAt = :now',
      ConditionExpression: '#status = :open',
      ExpressionAttributeValues: {
        ':closed': 'CLOSED',
        ':open': 'OPEN',
        ':now': new Date().toISOString(),
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    }));
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') return false;
    throw error;
  }

  const { title, seller, highestBid } = auction;
  const { amount, bidder } = highestBid;

  if (!bidder || amount === 0) {
    await queueMail(seller, 'No bids on your auction item :(',
      `Oh no! Your item "${title}" didn't get any bids. Better luck next time!`);
    return true;
  }

  await Promise.all([
    queueMail(seller, 'Your item has been sold!',
      `Woohoo! Your item "${title}" has been sold for $${amount}.`),
    queueMail(bidder, 'You won an auction!',
      `What a great deal! You got yourself a "${title}" for $${amount}.`),
  ]);
  return true;
}
