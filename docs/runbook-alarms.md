# Alarm runbook

Each alarm sends to the SNS topic `auction-alerts-<stage>`, which emails `ALERT_EMAIL` if it was set at deploy. Commands assume `STAGE=dev` and a signed-in AWS profile. On LocalStack, add `--endpoint-url http://localhost:4566` and use `STAGE=localstack`.

## mail-dlq-not-empty

**Means:** at least one email failed 3 times and is in `MailQueue-$STAGE-dlq`. A customer didn't get a "sold" or "you won" mail.

1. Look at what's there (doesn't delete anything):
   ```bash
   Q=$(aws sqs get-queue-url --queue-name MailQueue-$STAGE-dlq --query QueueUrl --output text)
   aws sqs receive-message --queue-url "$Q" --max-number-of-messages 10 --visibility-timeout 30 --attribute-names All
   ```
2. Find the cause in the logs: `aws logs tail /aws/lambda/notification-service-$STAGE-sendMail --since 1h`. Common causes: a recipient that isn't verified while SES is in the sandbox, the sender identity no longer verified, or a malformed message.
3. Fix the cause, then move the messages back to the main queue:
   ```bash
   aws sqs start-message-move-task --source-arn "$(aws sqs get-queue-attributes --queue-url "$Q" --attribute-names QueueArn --query Attributes.QueueArn --output text)"
   ```
   Without a destination, the move goes back to the queue the messages came from. A malformed message will fail again; delete it instead.

## mail-queue-stuck

**Means:** the oldest message on `MailQueue-$STAGE` is more than 15 minutes old, so emails are being produced but not consumed.

1. Is `sendMail` running? Check `aws lambda get-event-source-mapping` for the queue's mapping (State `Enabled`), and the function's errors and throttles in CloudWatch.
2. Is SES pausing sends? `aws sesv2 get-account` (`SendingEnabled`, `EnforcementStatus`).

## outbox-relay-failures

**Means:** `relayOutbox` gave up on a stream batch after 10 retries. The emails are recorded in `OutboxTable-$STAGE` but were not queued.

1. The failure queue `auction-outbox-relay-failures-$STAGE` holds the stream position and shard of each failed batch, not the emails themselves.
2. The rows are still in the table (7-day TTL). For the affected auction:
   ```bash
   aws dynamodb scan --table-name OutboxTable-$STAGE \
     --filter-expression 'aggregateId = :a' --expression-attribute-values '{":a":{"S":"<auction id>"}}'
   ```
3. Fix the cause (usually an SQS permission or a deleted queue), then resend each `payload` to `MailQueue-$STAGE` with `aws sqs send-message`.

## outbox-relay-lag

**Means:** `relayOutbox`'s iterator age has been over 5 minutes for 5 minutes, so the relay is behind or stuck retrying one batch. Emails are delayed, not lost, and the stream keeps records for 24 hours.

Check `aws logs tail /aws/lambda/auction-service-$STAGE-relayOutbox --since 30m` for the repeating error. If it persists, the batch ends up in the failure queue after 10 retries (see above).
