import { s3, Upload } from '../../../shared/aws';

// Returns the URL clients should load the picture from. With CloudFront in
// front of the bucket (dev/prod) that is the CDN domain, because the bucket
// itself is private; without it (local runs) it is the S3 object URL.
export async function uploadPictureToS3(key, body) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.AUCTIONS_BUCKET_NAME,
      Key: key,
      Body: body, // already decoded bytes, so no Content-Encoding header
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=300',
    },
  });

  const result = await upload.done();
  const base = process.env.PICTURES_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${encodeURIComponent(key)}` : result.Location;
}
