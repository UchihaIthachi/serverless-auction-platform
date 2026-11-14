import { randomUUID } from "crypto";
import createError from "http-errors";
import validator from "@middy/validator";
import { ddb } from "../../../shared/aws";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import commonMiddleware from "../lib/commonMiddleware";
import { getUserEmail } from "../lib/getUserEmail";
import { scheduleClose } from "../lib/scheduleClose";
import createAuctionSchema from "../lib/schemas/createAuctionSchema";

const MAX_DAYS = 30;

async function createAuction(event) {
  const { title, endingAt } = event.body;
  const email = getUserEmail(event, "seller@example.com");
  const now = new Date();

  // Default: one hour from now. A given end date must be in the future and
  // at most 30 days away.
  const endDate = endingAt ? new Date(endingAt) : new Date(now.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(endDate.getTime()) || endDate <= now) {
    throw new createError.BadRequest("endingAt must be a date in the future");
  }
  if (endDate - now > MAX_DAYS * 24 * 60 * 60 * 1000) {
    throw new createError.BadRequest(`endingAt must be within ${MAX_DAYS} days`);
  }

  const auction = {
    id: randomUUID(),
    title: title.trim(),
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
        ConditionExpression: "attribute_not_exists(id)",
      })
    );
  } catch (error) {
    console.error(error);
    throw new createError.InternalServerError("Could not create the auction");
  }

  // Close exactly when it ends (EventBridge Scheduler). Best effort: the
  // auction is saved either way, and the sweep closes it if this fails.
  await scheduleClose(auction);

  return {
    statusCode: 201,
    body: JSON.stringify(auction),
  };
}

export const handler = commonMiddleware(createAuction).use(
  validator({ inputSchema: createAuctionSchema })
);
