import { s3, Upload } from '../../../shared/aws';

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
  return result.Location;
}
