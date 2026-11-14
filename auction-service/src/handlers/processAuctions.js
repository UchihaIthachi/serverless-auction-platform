import { getEndedAuctions } from '../lib/getEndedAuctions';
import { closeAuction } from '../lib/closeAuction';

// Runs every minute. One auction failing doesn't stop the others. If the close
// itself fails, the auction stays OPEN and the next run tries again; failures
// are logged either way.
async function processAuctions() {
  const auctionsToClose = await getEndedAuctions();
  const results = await Promise.allSettled(auctionsToClose.map((auction) => closeAuction(auction)));

  const failed = results
    .map((r, i) => ({ r, id: auctionsToClose[i].id }))
    .filter(({ r }) => r.status === 'rejected');
  failed.forEach(({ r, id }) => console.error('closeAuction failed', id, r.reason));

  const closed = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return { found: auctionsToClose.length, closed, failed: failed.length };
}

export const handler = processAuctions;
