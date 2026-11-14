// Shared AWS SDK v3 clients.
//
// On AWS, Lambda provides the region and the function's role credentials
// (key, secret and session token) itself, so the clients use the default
// credential chain. Only for local runs (LocalStack / serverless-offline),
// where LOCAL_AWS_ENDPOINT is set, do we point at that endpoint with
// LocalStack's dummy "test" credentials.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client } from "@aws-sdk/client-s3";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Upload } from "@aws-sdk/lib-storage";

const region = process.env.AWS_REGION || "us-east-1";
const endpoint = process.env.LOCAL_AWS_ENDPOINT || undefined;

const config = endpoint
  ? {
      region,
      endpoint,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      forcePathStyle: true, // LocalStack S3 needs path-style URLs
    }
  : { region };

export const isLocal = Boolean(endpoint);

const ddbClient = new DynamoDBClient(config);
export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
export const sqs = new SQSClient(config);
export const s3 = new S3Client(config);
export const ses = new SESClient(config);
export { Upload, SendMessageCommand, SendEmailCommand };
