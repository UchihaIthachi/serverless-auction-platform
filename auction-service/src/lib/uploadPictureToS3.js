import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from './commonMiddleware';

const s3Client = new S3Client({});

export async function uploadPictureToS3(key, body) {
  const bucketName = process.env.AUCTIONS_BUCKET_NAME;
  const region = process.env.AWS_REGION; // Standard environment variable in Lambda

  if (!bucketName || !region) {
    throw new Error('AUCTIONS_BUCKET_NAME and AWS_REGION environment variables must be set.');
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentEncoding: 'base64', // Assuming the body is a base64 encoded string, which is typical for image uploads via API
    ContentType: 'image/jpeg', // Ensure this matches the actual image type
  }));

  // Construct the S3 object URL
  // Note: For specific regions like us-east-1, the region might not be needed in the hostname for older buckets,
  // but including it is generally safer and works for newer bucket/region combinations.
  // Path-style URLs (`s3.${region}.amazonaws.com/${bucketName}/${key}`) are an alternative if virtual-hosted style causes issues.
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}