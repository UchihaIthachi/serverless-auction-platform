// shared/aws.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";
import { S3Client } from "@aws-sdk/client-s3";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Upload } from "@aws-sdk/lib-storage";

const region = process.env.AWS_REGION || "us-east-1";
const endpoint = process.env.AWS_ENDPOINT || undefined;
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
};

const ddbClient = new DynamoDBClient({ region, endpoint, credentials });
export const ddb = DynamoDBDocumentClient.from(ddbClient);
export const sqs = new SQSClient({ region, endpoint, credentials });
export const sns = new SNSClient({ region, endpoint, credentials });
export const s3 = new S3Client({ region, endpoint, credentials });
export const ses = new SESClient({ region, endpoint, credentials });
export { Upload, SendMessageCommand, SendEmailCommand };
