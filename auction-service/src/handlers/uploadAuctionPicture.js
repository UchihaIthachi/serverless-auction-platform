import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import cors from '@middy/http-cors';
import createError from 'http-errors';
import { getAuctionById } from './getAuction'; // This internally uses logger now
import { logger } from '../lib/commonMiddleware'; // Import the shared logger
import { uploadPictureToS3 } from '../lib/uploadPictureToS3';
import { setAuctionPictureUrl } from '../lib/setAuctionPictureUrl';
import uploadAuctionPictureSchema from '../lib/schemas/uploadAuctionPictureSchema';

// Renamed handler function
export async function doUploadAuctionPicture(event) {
  const { id } = event.pathParameters;
  const { email } = event.requestContext.authorizer;

  logger.info('Uploading picture for auction', { auctionId: id, uploaderEmail: email });

  const auction = await getAuctionById(id); // getAuctionById already logs

  // Validate auction ownership
  if (auction.seller !== email) {
    logger.warn('Forbidden attempt to upload picture by non-seller', { auctionId: id, uploaderEmail: email, sellerEmail: auction.seller });
    throw new createError.Forbidden(`You are not the seller of this auction!`);
  }

  // The event.body is expected to be the raw base64 string based on the schema.
  // No JSON parsing is applied before this for this specific handler.
  const base64 = event.body.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  let updatedAuction;

  try {
    logger.info('Attempting to upload picture to S3 and update auction record', { auctionId: id });
    const pictureUrl = await uploadPictureToS3(auction.id + '.jpg', buffer); // uploadPictureToS3 will have its own logs
    updatedAuction = await setAuctionPictureUrl(auction.id, pictureUrl); // setAuctionPictureUrl will have its own logs
    logger.info('Picture uploaded and auction updated successfully', { auctionId: id, pictureUrl });
  } catch (error) {
    logger.error('Error uploading picture or updating auction', { auctionId: id, errorDetails: error });
    throw new createError.InternalServerError(error); // httpErrorHandler will catch this
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  };
}

const compiledUploadAuctionPictureSchema = transpileSchema(uploadAuctionPictureSchema);

export const handler = middy(doUploadAuctionPicture)
  .use(httpErrorHandler({ // Use the imported Powertools logger for httpErrorHandler
    logger: (error) => {
      logger.error('Error handled by http-error-handler in uploadAuctionPicture', { errorDetails: error });
    }
  }))
  .use(validator({ eventSchema: compiledUploadAuctionPictureSchema }))
  .use(cors()); // Assuming default CORS options are fine
