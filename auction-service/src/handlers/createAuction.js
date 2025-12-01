import { v4 as uuid } from "uuid";
import createError from "http-errors";
import validator from "@middy/validator";
import { ddb } from "../../../shared/aws";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import commonMiddleware from "../lib/commonMiddleware";
import createAuctionSchema from "../lib/schemas/createAuctionSchema";

async function createAuction(event, context) {
  const { title, endingAt } = event.body;
  const { email } = event.requestContext.authorizer || {
    email: "seller@example.com",
  };
  const now = new Date();
  let endDate;

  if (endingAt) {
    endDate = new Date(endingAt);
  } else {
    endDate = new Date();
    endDate.setHours(now.getHours() + 1);
  }

  const auction = {
    id: uuid(),
    title,
    status: "OPEN",
    createdAt: now.toISOString(),
    endingAt: endDate.toISOString(),
    highestBid: {
      amount: 0,
    },
    seller: email,
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: process.env.AUCTIONS_TABLE_NAME,
        Item: auction,
      })
    );
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 201,
    body: JSON.stringify(auction),
  };
}

export const handler = commonMiddleware(createAuction).use(
  validator({ inputSchema: createAuctionSchema })
);
