import { ses, SendEmailCommand } from '../../../shared/aws';

// Sends one email per SQS message. Failed messages are reported back to SQS
// so they are retried, and after 3 tries they move to the dead-letter queue.
export async function sendMail(event) {
  const batchItemFailures = [];

  for (const record of event.Records) {
    try {
      const { subject, body, recipient } = JSON.parse(record.body);
      if (!recipient || !subject || !body) {
        throw new Error('Mail message needs recipient, subject and body');
      }

      await ses.send(new SendEmailCommand({
        Source: process.env.SENDER_EMAIL,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: subject },
          Body: { Text: { Data: body } },
        },
      }));
    } catch (error) {
      console.error('sendMail failed', { messageId: record.messageId, error: error.message });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

export const handler = sendMail;
