import { ddb } from '../../../shared/aws';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { closeAuction } from '../lib/closeAuction';

// Target of the per-auction EventBridge Scheduler entry: { "auctionId": "..." }.
// Safe to run more than once, or after the sweep already closed it: closeAuction
// only succeeds while the auction is still OPEN.
async function closeAuctionById(event) {
  const id = event && event.auctionId;
  if (!id) throw new Error('auctionId missing from the schedule input');

  const { Item: auction } = await ddb.send(new GetCommand({
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
  }));

  if (!auction) return { id, closed: false, reason: 'not found' };
  if (auction.status !== 'OPEN') return { id, closed: false, reason: 'already closed' };
  if (new Date(auction.endingAt) > new Date()) return { id, closed: false, reason: 'not ended yet' };

  const closed = await closeAuction(auction);
  return { id, closed, reason: closed ? 'closed' : 'already closed' };
}

export const handler = closeAuctionById;
