import { randomUUID } from 'crypto';
import { ddb } from '../../../shared/aws';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

const OUTBOX_TTL_DAYS = 7;

// The emails an auction's close produces: one to the seller, and one to the
// winner if there was a bid.
export function closingEmails({ title, seller, highestBid }) {
  const { amount, bidder } = highestBid || {};
  if (!bidder || !amount) {
    return [{
      recipient: seller,
      subject: 'No bids on your auction item :(',
      body: `Oh no! Your item "${title}" didn't get any bids. Better luck next time!`,
    }];
  }
  return [
    { recipient: seller, subject: 'Your item has been sold!', body: `Woohoo! Your item "${title}" has been sold for $${amount}.` },
    { recipient: bidder, subject: 'You won an auction!', body: `What a great deal! You got yourself a "${title}" for $${amount}.` },
  ];
}

// Transactional outbox: the status change and the emails it causes are written
// in ONE DynamoDB transaction. Either the auction is CLOSED and its emails are
// recorded in the outbox table, or neither happened. A crash between "close"
// and "send to SQS" can no longer lose an email. The OutboxTable stream then
// triggers relayOutbox, which puts each email on the mail queue.
//
// Returns false if the auction was already closed (an overlapping run, or the
// per-auction schedule and the sweep both firing), so emails go out once.
export async function closeAuction(auction) {
  const now = new Date();
  const expiresAt = Math.floor(now.getTime() / 1000) + OUTBOX_TTL_DAYS * 24 * 3600;

  const outboxPuts = closingEmails(auction).map((mail) => ({
    Put: {
      TableName: process.env.OUTBOX_TABLE_NAME,
      Item: {
        id: randomUUID(),
        type: 'MAIL',
        aggregateId: auction.id,
        payload: mail,
        createdAt: now.toISOString(),
        expiresAt, // DynamoDB TTL removes relayed rows after a week
      },
    },
  }));

  try {
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: process.env.AUCTIONS_TABLE_NAME,
            Key: { id: auction.id },
            UpdateExpression: 'set #status = :closed, closedAt = :now',
            ConditionExpression: '#status = :open',
            ExpressionAttributeValues: { ':closed': 'CLOSED', ':open': 'OPEN', ':now': now.toISOString() },
            ExpressionAttributeNames: { '#status': 'status' },
          },
        },
        ...outboxPuts,
      ],
    }));
  } catch (error) {
    // In a transaction a failed condition shows up as a cancellation whose first
    // reason (the Update) is ConditionalCheckFailed.
    const reasons = error.CancellationReasons || [];
    if (error.name === 'TransactionCanceledException' && reasons[0] && reasons[0].Code === 'ConditionalCheckFailed') {
      return false;
    }
    throw error;
  }
  return true;
}
