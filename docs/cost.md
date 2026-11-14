# Cost estimate (AWS, us-east-1)

What this platform **would** cost on AWS, worked out from usage instead of guessed. The project itself runs locally at $0. The point of this page is to know before deploying, and to show where the money goes as traffic grows.

## Assumed monthly traffic ("small")

| Activity | Count / month | Notes |
|---|---|---|
| Auctions created | 1,000 | |
| Bids | 20,000 | 20 per auction |
| Reads (get / list) | 100,000 | |
| Pictures uploaded | 1,000 | about 200 KB each |
| Emails | 2,000 | seller + winner per sold auction |
| `processAuctions` runs | 43,200 | every minute (60 × 24 × 30) |

API requests: 1,000 + 20,000 + 100,000 + 1,000 = **122,000**.

## Cost by service

| Service | Usage | Unit price | Monthly |
|---|---|---|---|
| API Gateway (REST) | 122,000 requests | $3.50 per million | **$0.43** |
| Lambda requests | ≈ 290,000 (API + authorizer + cron + mail) | $0.20 per million; 1 M free every month | $0.00 |
| Lambda compute | ≈ 6,000 GB-s (128–256 MB, ~0.1 s each) | $0.0000166667 per GB-s; 400,000 GB-s free every month | $0.00 |
| DynamoDB writes | ≈ 46,000 WRU (each write also updates the GSI) | $0.625 per million WRU (on-demand) | $0.03 |
| DynamoDB reads | ≈ 215,000 RRU (reads, bid checks, cron queries) | $0.125 per million RRU | $0.03 |
| DynamoDB storage | < 1 GB | 25 GB free | $0.00 |
| SQS | ≈ 2,000 messages + Lambda polling | 1 M requests free every month | $0.00 |
| SES | 2,000 emails | $0.10 per 1,000 | $0.20 |
| S3 | 0.2 GB stored, 100,000 GETs | $0.023 per GB, $0.0004 per 1,000 GETs | $0.05 |
| CloudWatch Logs | ≈ 0.3 GB ingested | $0.50 per GB | $0.15 |
| **Total** | | | **≈ $0.90 / month** |

## How it scales

| Traffic | Monthly | What dominates |
|---|---|---|
| Small (above) | ≈ $0.90 | API Gateway, SES, logs |
| 10× | ≈ $9 | API Gateway ($4.30), SES ($2), logs ($1.50); Lambda just past its free allowance ($0.40) |
| 100× | ≈ $100 | API Gateway ($43), SES ($20), logs ($15), Lambda ($9), DynamoDB ($5), S3 ($5) |

**Biggest lever: switch to API Gateway HTTP APIs.** At $1.00 per million requests instead of $3.50 for REST, that cuts the largest line by about 70%. The JWT authorizer on HTTP APIs can also validate Auth0 tokens directly, which removes the authorizer Lambda and its invocations. The trade-off is that HTTP APIs lack some REST features (usage plans, request validation, gateway responses), which this project would have to give up or replace.

**Second lever: the every-minute cron.** It runs 43,200 times a month whether or not anything is ending. One EventBridge Scheduler entry per auction, firing at `endingAt`, replaces both the polling and the GSI query.

## Assumptions and sources

- Prices are AWS public list prices for us-east-1 as published on each service's pricing page. DynamoDB on-demand prices reflect the 50% reduction effective 1 Nov 2024 ([AWS announcement](https://aws.amazon.com/about-aws/whats-new/2024/11/amazon-dynamo-db-reduces-prices-on-demand-throughput-global-tables/)). Check the current pricing pages before relying on these numbers.
- The Lambda and SQS free allowances are monthly and don't expire. The authorizer is counted on every request (its 5-minute result cache would lower this).
- Not included: data transfer out (pictures served to many viewers would add to it; CloudFront in front of S3 is the fix), and taxes.
