import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import cors from '@middy/http-cors';
import createError from 'http-errors';
import { getAuctionById } from './getAuction';
import { getUserEmail } from '../lib/getUserEmail';
import { uploadPictureToS3 } from '../lib/uploadPictureToS3';
import { setAuctionPictureUrl } from '../lib/setAuctionPictureUrl';
import uploadAuctionPictureSchema from '../lib/schemas/uploadAuctionPictureSchema';

const MAX_BYTES = 4 * 1024 * 1024; // Lambda's request limit is 6 MB, base64 adds ~33%

export async function uploadAuctionPicture(event) {
  const { id } = event.pathParameters;
  const email = getUserEmail(event, 'seller@example.com');
  const auction = await getAuctionById(id);

  // Validate auction ownership
  if (auction.seller !== email) {
    throw new createError.Forbidden(`You are not the seller of this auction!`);
  }

  const base64 = event.body.trim().replace(/^data:image\/[\w+.-]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  // Only real JPEGs (they start with FF D8 FF), and not too big.
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new createError.BadRequest('The picture must be a base64-encoded JPEG');
  }
  if (buffer.length > MAX_BYTES) {
    throw new createError.PayloadTooLarge('The picture must be 4 MB or smaller');
  }

  let updatedAuction;

  try {
    const pictureUrl = await uploadPictureToS3(auction.id + '.jpg', buffer);
    updatedAuction = await setAuctionPictureUrl(auction.id, pictureUrl);
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError('Could not save the picture');
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

export const handler = middy(uploadAuctionPicture)
  .use(httpErrorHandler())
  .use(validator({ inputSchema: uploadAuctionPictureSchema }))
  .use(cors());
