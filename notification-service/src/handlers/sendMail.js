import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Logger } from '@aws-lambda-powertools/logger';

// Initialize Powertools Logger
const logger = new Logger({ serviceName: 'notification-service' });

// Initialize SES Client
// Prefer AWS_REGION from environment, fallback to 'eu-west-1' if not set for some reason
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });

async function sendMail(event, context) {
  // Add Lambda context to all subsequent logger calls
  logger.addContext(context);

  const record = event.Records[0]; // Assuming batchSize is 1 as per serverless.yml
  logger.info('Processing SQS record', { record });

  let emailDetails;
  try {
    emailDetails = JSON.parse(record.body);
  } catch (error) {
    logger.error('Failed to parse SQS record body', { errorDetails: error, recordBody: record.body });
    // Depending on requirements, might want to let it go to DLQ or handle differently
    throw error; // Re-throw to allow SQS to handle via DLQ if parsing fails
  }

  const { subject, body, recipient } = emailDetails;
  logger.info('Email details parsed', { subject, recipient, bodyPreview: body ? body.substring(0, 100) + '...' : 'N/A' });


  const params = {
    Source: 'ariel@codingly.io', // Sender's email address (must be verified in SES)
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Body: {
        Text: {
          Data: body,
        },
      },
      Subject: {
        Data: subject,
      },
    },
  };

  logger.info('Attempting to send email via SES', { emailParams: { ...params, Message: { ...params.Message, Body: 'REDACTED' } } }); // Redact body for logs

  try {
    const result = await sesClient.send(new SendEmailCommand(params));
    logger.info('Email sent successfully', { result, recipient });
    return result;
  } catch (error) {
    logger.error('Failed to send email via SES', { errorDetails: error, emailParams: { ...params, Message: { ...params.Message, Body: 'REDACTED' } } });
    throw error; // CRITICAL: Re-throw the error to ensure it's handled by SQS (e.g., moved to DLQ after retries)
  }
}

export const handler = sendMail;