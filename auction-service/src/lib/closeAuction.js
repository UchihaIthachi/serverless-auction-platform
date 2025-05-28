import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { logger } from './commonMiddleware';

const dynamoDBClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoDBClient);
const sqsClient = new SQSClient({});

export async function closeAuction(auction) {
  logger.info('Attempting to close auction', { auctionId: auction.id });
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id: auction.id },
    UpdateExpression: 'set #status = :status',
    ExpressionAttributeValues: {
      ':status': 'CLOSED',
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
  };

  try {
    await dynamodb.send(new UpdateCommand(params));
    logger.info('Auction status successfully updated to CLOSED in DynamoDB', { auctionId: auction.id });
  } catch (error) {
    logger.error('Error updating auction status to CLOSED in DynamoDB', { auctionId: auction.id, errorDetails: error });
    throw error; // Re-throw to allow processAuctions to handle it, or decide on error handling strategy
  }

  const { title, seller, highestBid } = auction;
  const { amount, bidder } = highestBid;

  try {
    if (amount === 0) {
      logger.info('No bids received for auction. Sending notification to seller.', { auctionId: auction.id, sellerEmail: seller });
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: 'No bids on your auction item :(',
          recipient: seller,
          body: `Oh no! Your item "${title}" didn't get any bids. Better luck next time!`,
        }),
      }));
      logger.info('No-bid notification sent successfully to seller.', { auctionId: auction.id, recipient: seller });
      return; // End execution as no bidder to notify
    }

    // Auction was sold
    logger.info(`Auction sold for $${amount} to ${bidder}. Preparing notifications.`, { auctionId: auction.id, sellerEmail: seller, bidderEmail: bidder, amount });

    const notifySellerPromise = sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.MAIL_QUEUE_URL,
      MessageBody: JSON.stringify({
        subject: 'Your item has been sold!',
        recipient: seller,
        body: `Woohoo! Your item "${title}" has been sold for $${amount}.`, // Corrected typo "itme" to "item"
      }),
    }));

    const notifyBidderPromise = sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.MAIL_QUEUE_URL,
      MessageBody: JSON.stringify({
        subject: 'You won an auction!',
        recipient: bidder,
        body: `What a great deal! You got yourself a "${title}" for $${amount}.`,
      }),
    }));

    await Promise.all([notifySellerPromise, notifyBidderPromise]);
    logger.info('Sale and win notifications sent successfully to seller and bidder.', { auctionId: auction.id, seller, bidder });

  } catch (error) {
    logger.error('Error sending SQS notifications for closed auction (sale or no-bid scenario).', { auctionId: auction.id, errorDetails: error });
    // Decide if this error should halt further processing or just be logged.
    // Re-throwing to make it visible at processAuctions level.
    throw error;
  }
}