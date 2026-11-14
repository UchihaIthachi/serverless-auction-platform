import { SchedulerClient, CreateScheduleCommand } from '@aws-sdk/client-scheduler';

const endpoint = process.env.LOCAL_AWS_ENDPOINT || undefined;
const scheduler = new SchedulerClient(endpoint
  ? { region: process.env.AWS_REGION || 'us-east-1', endpoint, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }
  : { region: process.env.AWS_REGION || 'us-east-1' });

export const scheduleName = (auctionId) => `auction-${auctionId}`;

// "2026-11-15T10:42:07.123Z" -> "at(2026-11-15T10:42:08)": at() takes whole
// seconds, so round up to never fire before the auction has ended.
export function atExpression(endingAt) {
  const t = new Date(Math.ceil(new Date(endingAt).getTime() / 1000) * 1000);
  return `at(${t.toISOString().slice(0, 19)})`;
}

// One-time EventBridge Scheduler entry that closes this auction when it ends,
// then deletes itself. Replaces polling every minute. Best effort: if this
// fails the auction is still closed by the slower sweep (processAuctions).
export async function scheduleClose(auction) {
  if (process.env.SCHEDULER_ENABLED !== 'true') return { scheduled: false, reason: 'disabled' };
  try {
    await scheduler.send(new CreateScheduleCommand({
      Name: scheduleName(auction.id),
      GroupName: process.env.SCHEDULE_GROUP || 'default',
      ScheduleExpression: atExpression(auction.endingAt),
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: process.env.SCHEDULER_TARGET_ARN,
        RoleArn: process.env.SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({ auctionId: auction.id }),
        RetryPolicy: { MaximumRetryAttempts: 3, MaximumEventAgeInSeconds: 3600 },
      },
    }));
    return { scheduled: true };
  } catch (error) {
    console.error('scheduleClose failed; the sweep will close it', { id: auction.id, error: error.message });
    return { scheduled: false, reason: error.name };
  }
}
