# Architecture

Three Serverless Framework services, communicating only through AWS managed services. All of it runs locally on LocalStack + serverless-offline (`npm run test:e2e`), and on AWS with `scripts/deploy-aws.sh`.

## 1. Components

```mermaid
flowchart LR
  client([Client]) -->|HTTPS + Bearer JWT| apigw[API Gateway<br/>REST API]
  apigw -->|Lambda authorizer| auth[auth-service<br/>auth λ: verify RS256 JWT<br/>audience + issuer]
  apigw --> create[createAuction λ]
  apigw --> get[getAuction / getAuctions λ]
  apigw --> bid[placeBid λ]
  apigw --> pic[uploadAuctionPicture λ]
  create & get & bid --> ddb[(DynamoDB AuctionsTable<br/>PK id · GSI statusAndEndDate)]
  pic --> s3[(S3 auctions bucket<br/>JPEG ≤ 4 MB)]
  pic --> ddb
  cron[EventBridge rule<br/>rate 1 minute] --> proc[processAuctions λ]
  proc -->|query GSI: OPEN and endingAt ≤ now| ddb
  proc -->|conditional close| ddb
  proc -->|2 messages per sold auction| q[[SQS MailQueue]]
  q -->|batch 1, partial failures| mail[notification-service<br/>sendMail λ]
  mail --> ses[SES]
  q -. after 3 failed receives .-> dlq[[SQS MailQueue DLQ]]
```

## 2. Placing a bid safely under concurrency

```mermaid
sequenceDiagram
  autonumber
  participant A as Bidder A
  participant B as Bidder B
  participant L as placeBid λ
  participant D as DynamoDB

  par same moment
    A->>L: PATCH /auction/42/bid {amount: 100}
  and
    B->>L: PATCH /auction/42/bid {amount: 100}
  end
  L->>D: UpdateItem highestBid = 100<br/>IF status = OPEN AND endingAt > now<br/>AND highestBid.amount < 100 AND seller <> bidder
  D-->>L: OK (A's write lands first)
  L-->>A: 200
  L->>D: same conditional UpdateItem for B
  D-->>L: ConditionalCheckFailedException
  L-->>B: 409 / 403 (outbid or auction closed)
```

The check and the write are **one atomic DynamoDB operation**. A read-then-write in Lambda code would let both bids pass the check before either writes. The local e2e test fires 10 identical bids at once: exactly one gets 200.

## 3. Closing auctions

```mermaid
sequenceDiagram
  autonumber
  participant E as EventBridge (every minute)
  participant P as processAuctions λ
  participant D as DynamoDB
  participant Q as SQS MailQueue

  E->>P: scheduled event
  P->>D: Query GSI statusAndEndDate: status = OPEN AND endingAt ≤ now (paginated)
  D-->>P: ended auctions
  loop each auction (Promise.allSettled: one failure doesn't stop the rest)
    P->>D: UpdateItem status = CLOSED IF status = OPEN
    alt first run to close it
      D-->>P: OK
      P->>Q: seller: "sold for $X" / "no bids"
      P->>Q: winner: "you won" (if there was a bid)
    else an overlapping run already closed it
      D-->>P: ConditionalCheckFailed → skip, no duplicate emails
    end
  end
```

## 4. Email delivery, retries and the DLQ

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Queued
  Queued --> InFlight: Lambda polls (batch size 1)
  InFlight --> Sent: SES accepts → message deleted
  Sent --> [*]
  InFlight --> Queued: reported in batchItemFailures,<br/>visible again after the timeout
  Queued --> DLQ: received 3 times without success<br/>(redrive policy, maxReceiveCount 3)
  DLQ --> [*]: kept 14 days for inspection or replay
```

`sendMail` returns `batchItemFailures` with only the failed message IDs, so one bad message doesn't make SQS redeliver the good ones.

## 5. Security

```mermaid
flowchart TB
  t[Bearer JWT from Auth0] --> v{auth λ}
  v -->|RS256 signature, audience, issuer OK| allow[IAM Allow policy<br/>+ context: sub, email]
  v -->|anything else| deny[401]
  allow --> h[handlers use requestContext.authorizer.email<br/>as seller / bidder]
  h --> iam[each service's IAM role:<br/>only its table, queue, bucket]
```

There is no fallback identity on AWS. Only the `local` stage (serverless-offline, no authorizer) uses test emails.
