# Well-Architected review

A self-review against the six pillars of the [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html), with the [Serverless Applications Lens](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html) in mind. Each line names the evidence (a file or a test) or says plainly that it's a gap.

**Context:** the platform runs locally on LocalStack at $0, and has never been deployed to a real AWS account. Everything marked "in code" is written and checked against templates and emulators. Behaviour that only real AWS can show (CloudFront, OIDC, real alarm notifications) is unproven until a first deploy.

## 1. Operational excellence

| Practice | Status | Evidence |
|---|---|---|
| Infrastructure as code | Done | 3 `serverless.yml` stacks; all resources, IAM, alarms in `resources/` |
| One command to deploy, test and remove | Done | `deploy-aws.sh` / `smoke-aws.sh` / `teardown-aws.sh`; `deploy-localstack.sh` for the local equivalent |
| Every change tested before merge | Done | `e2e` workflow: 31 checks on LocalStack on every push and PR |
| Deploys without stored keys, reviewed for prod | In code | `deploy.yml` with OIDC; GitHub environment `prod` with required reviewers ([deploy-oidc.md](deploy-oidc.md)) |
| Runbooks for alerts | Done | [runbook-alarms.md](runbook-alarms.md) |
| Structured logs, traces | **Gap** | `console.error` with context objects only; next: Powertools logger + X-Ray |

## 2. Security

| Practice | Status | Evidence |
|---|---|---|
| Strong identity at the edge | Done | Auth0 RS256 JWT, audience + issuer checked, in a Lambda authorizer |
| No fallback identity in AWS | Done | Test identities only on `local` / `localstack`, which can't deploy to AWS |
| Least privilege per function group | Done | Each statement scoped to one table, queue, bucket, schedule prefix; `iam:PassRole` limited to scheduler.amazonaws.com |
| Private storage | In code | Bucket blocks all public access; CloudFront OAC with a `SourceArn` condition |
| No long-lived credentials | Done | Laptop: IAM Identity Center (SSO). CI: OIDC, role trusted only for this repo's environments |
| Input validation | Done | JSON schemas (middy), JPEG magic bytes, 4 MB limit, validated paging tokens |
| Edge protection | Partly | Gateway throttling. **Gap:** WAF, per-client limits |
| Secrets | Done | Only the Auth0 certificate, which is public; git-ignored, and a GitHub secret in CI |

## 3. Reliability

| Practice | Status | Evidence |
|---|---|---|
| Correct under concurrency | Done | Conditional bid update; a 10-way race test, exactly one winner |
| Idempotent processing | Done | `IF status = OPEN` on the close; the schedule and the sweep can both fire |
| No lost side effects | Done | Transactional outbox: close + emails in one `TransactWriteItems` |
| Retries with isolation | Done | SQS partial batch failures; stream relay with bisect + failure destination |
| Dead letters, alarmed | Done | Mail DLQ (14 days) and relay failure queue, each with an alarm |
| No single scheduled point of failure | Done | Per-auction schedule + 15-minute sweep as a safety net |
| Backpressure | Done | Gateway throttling returns 429 before Lambda |
| Backups | **Gap** | Point-in-time recovery not enabled on the tables (a one-line change, about 20% of storage cost) |
| Multi-region | Not needed | Single region is fine at this scale |

## 4. Performance efficiency

| Practice | Status | Evidence |
|---|---|---|
| Access patterns designed first | Done | One GSI serves the list and the sweep; no Scans ([architecture.md §15](architecture.md#15-access-patterns)) |
| Bounded responses | Done | `getAuctions` pages with `Limit` + cursor |
| Event-driven, not polling | Done | One schedule per auction instead of a cron every minute |
| Content at the edge | In code | CloudFront with `CachingOptimized` for pictures |
| Right-sized functions | Partly | 256 MB everywhere. **Gap:** measure with Lambda Power Tuning after a real deploy |

## 5. Cost optimization

| Practice | Status | Evidence |
|---|---|---|
| Cost known before deploying | Done | [cost.md](cost.md): ≈ $0.85 a month small, $9 at 10×, $100 at 100× |
| Pay per use | Done | On-demand DynamoDB, Lambda, SQS; nothing idles |
| Guardrail before the first deploy | Done | `deploy-aws.sh` refuses to run without an AWS Budget |
| Development at $0 | Done | LocalStack community + serverless-offline, in CI too |
| Biggest remaining lever | **Next** | REST → HTTP API (≈70% off the largest line) |

## 6. Sustainability

| Practice | Status | Evidence |
|---|---|---|
| No always-on compute | Done | Serverless only; the sweep runs 2,880 times a month instead of 43,200 |
| Fewer bytes moved | Done | Cached pictures at the edge; JPEG only, 4 MB limit |
| Data lifecycle | Done | Outbox rows expire after 7 days (TTL); incomplete uploads aborted after 1 day |
| Efficient runtime | Done | Node 22 on Lambda, esbuild bundles |

## Top 3 improvements, in order

1. **HTTP API + JWT authorizer.** It cuts the largest cost line by about 70% and removes the authorizer Lambda.
2. **Point-in-time recovery** on `AuctionsTable`.
3. **Structured logs + X-Ray**, so an alarm leads straight to the failing request.
