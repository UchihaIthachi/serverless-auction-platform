import { unmarshall } from '@aws-sdk/util-dynamodb';
import { sqs, SendMessageCommand } from '../../../shared/aws';

// Triggered by the OutboxTable's DynamoDB stream. Every new outbox row becomes
// one message on the mail queue. Rows failing to send are reported back, so
// Lambda retries from that record (records in a shard stay in order). Only
// INSERTs matter: TTL deletions also appear on the stream and are skipped.
//
// Delivery is at-least-once: if a send succeeds but the batch is retried, the
// same email can be queued twice. The outbox id travels as a message attribute
// so a consumer can deduplicate if that ever matters.
export async function relayOutbox(event) {
  const batchItemFailures = [];

  for (const record of event.Records || []) {
    if (record.eventName !== 'INSERT') continue;
    try {
      const row = unmarshall(record.dynamodb.NewImage);
      if (row.type !== 'MAIL') continue;
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify(row.payload),
        MessageAttributes: {
          outboxId: { DataType: 'String', StringValue: row.id },
          auctionId: { DataType: 'String', StringValue: row.aggregateId },
        },
      }));
    } catch (error) {
      console.error('relayOutbox failed', { sequence: record.dynamodb && record.dynamodb.SequenceNumber, error: error.message });
      // For stream sources the identifier is the sequence number; Lambda
      // restarts the batch from the lowest one reported.
      batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
      break;
    }
  }

  return { batchItemFailures };
}

export const handler = relayOutbox;
