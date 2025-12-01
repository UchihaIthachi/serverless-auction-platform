Here’s an updated `README.md` with a new **Usage** section and cleaned-up local/dev/test instructions based on everything you’ve done so far.

You can **replace** your current README with this:

````markdown
# 🛠️ Serverless Auction Platform

A **capstone project** built using **AWS**, following a **microservices architecture** with an **event-driven**, **serverless (FaaS)** design. This platform enables scalable, modular, and resilient online auctions using the [Serverless Framework](https://www.serverless.com/) deployed on AWS cloud services.

---

## 🧱 Architecture Overview

- **Architecture Style**: Microservices
- **Execution Model**: Serverless (FaaS - Function as a Service)
- **Design Pattern**: Event-Driven
- **Cloud Platform**: AWS
- **Use Case**: Capstone project demonstrating best practices in cloud-native application development

Each microservice is independently deployable and communicates via AWS-managed messaging and notification services, following the principles of loose coupling and asynchronous processing.

---

## 🚀 Tech Stack

- **Language**: Node.js
- **Framework**: Serverless Framework
- **Cloud Services**:
  - AWS Lambda (FaaS)
  - API Gateway
  - DynamoDB
  - SQS (Simple Queue Service)
  - SNS (Simple Notification Service)
  - SES (Simple Email Service)
  - CloudWatch (Monitoring)
- **Authentication**: JWT + Lambda Authorizer
- **CI/CD**: GitHub Actions _(planned)_

---

## 📁 Project Structure

```bash
serverless-auction-platform/
│
├── auction-service/        # Handles listing, bidding, and auction state transitions
├── auth-service/           # Manages user authentication and authorization via JWT
├── notification-service/   # Sends email notifications via SES/SNS
└── README.md               # Project documentation
```
````

---

## 📦 Features

### ✅ Auction Service

- Create, update, and delete auctions
- Start and end auctions with scheduled events
- Accept bids with validation and conflict handling
- Trigger notifications and events for auction outcomes

### 🔐 Auth Service

- User sign-up and login with email verification
- JWT token generation and validation
- Lambda Authorizer integration for securing API endpoints

### 📢 Notification Service

- Send notifications for auction events
- Inform winning bidders and auction owners
- Uses AWS SES and SNS for delivery

---

## 🏗️ Deployment (AWS)

Ensure the Serverless Framework is installed:

```bash
npm install -g serverless
```

Deploy an individual service:

```bash
cd auction-service
sls deploy
```

Repeat the above for `auth-service` and `notification-service`.

---

## 🔧 Setup Instructions

1. **Clone the repository**

   ```bash
   git clone https://github.com/UchihaIthachi/serverless-auction-platform.git
   cd serverless-auction-platform
   ```

2. **Configure AWS credentials for real AWS deployments**

   ```bash
   aws configure
   ```

3. **Install dependencies**

   Root:

   ```bash
   npm install
   ```

   Per service:

   ```bash
   cd auction-service && npm install
   cd ../auth-service && npm install
   cd ../notification-service && npm install
   ```

---

## ⚙️ Usage (Local Development & Testing)

This section covers **local development** using **LocalStack** and **serverless-offline**, plus **Docker-based smoke/E2E tests** and manual API usage.

> 💡 Requirements: Docker, AWS CLI, Node 18+, Serverless Framework, npm.

---

### 1️⃣ One-time Local Dev Setup

Configure **dummy AWS credentials** for LocalStack (no real keys needed):

```bash
aws configure set aws_access_key_id test
aws configure set aws_secret_access_key test
aws configure set region us-east-1
```

Install dependencies (if not already done):

```bash
# from repo root
npm install

cd auction-service && npm install
cd ../auth-service && npm install
cd ../notification-service && npm install
```

Make sure **Docker Desktop** is running before you start LocalStack or tests.

---

### 2️⃣ Local Development with LocalStack + serverless-offline

#### Step 2.1 – Start LocalStack

From the **repo root**:

```bash
npm run local:up
```

This will:

- Start the LocalStack container
- Bootstrap DynamoDB tables, SQS queue, S3 bucket, and SES identity

Sanity check (optional):

```bash
aws --endpoint-url=http://localhost:4566 dynamodb list-tables
```

You should see `AuctionsTable-local` in the output.

---

#### Step 2.2 – Run services locally (offline APIs)

In **separate terminals**, run:

```bash
# Auth Service (JWT / authorizer)
cd auth-service
npm run offline:auth    # or: npm run start:local / sls offline --stage local

# Auction Service (core auction APIs)
cd ../auction-service
npm run offline:auction # starts HTTP API on http://localhost:3000

# Notification Service (email notifications)
cd ../notification-service
npm run offline:notify  # or: npm run start:local
```

Make sure each service starts successfully and connects to LocalStack (using `AWS_ENDPOINT`, dummy creds, etc.).

---

### 3️⃣ Docker-based Tests (Smoke + E2E)

The project includes a Docker-based test harness that spins up:

- LocalStack
- A tester container that runs:

  - `scripts/test-local.sh` (smoke)
  - `scripts/test-e2e.sh` (end-to-end)

From the **repo root**:

```bash
npm run test:compose
```

This will:

- Build the `serverless-auction-platform-tester` image
- Start LocalStack + tester using `docker-compose.test.yml`
- Run the smoke test and E2E test against your local APIs

✅ **You want to see:**

- `[SMOKE] OK`
- `[E2E] OK`
- Command exits with code `0`

If E2E fails, check the logs for:

- Connectivity issues to `http://host.docker.internal:3000`
- Any application errors from auction-service

---

### 4️⃣ Manual Auction Flow (Local Usage)

Once the **Auction Service** is running on `http://localhost:3000` (via `npm run offline:auction`), you can manually exercise the API.

Use **Git Bash** or **WSL** for these `curl` commands.

#### 4.1 – Create an auction

```bash
curl -X POST http://localhost:3000/auction \
  -H "Content-Type: application/json" \
  -d '{"title": "Vintage Camera"}'
```

The response will include an `id` field. Copy it as `AUCTION_ID`.

---

#### 4.2 – Place a bid

```bash
curl -X PATCH "http://localhost:3000/auction/$AUCTION_ID/bid" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'
```

---

#### 4.3 – Get auction details

```bash
curl "http://localhost:3000/auction/$AUCTION_ID"
```

You should see the auction with the recorded bid and current status.

---

#### 4.4 – Manually trigger `processAuctions` (via LocalStack Lambda)

Normally, `processAuctions` runs on a schedule. To invoke it manually against LocalStack:

```bash
aws --endpoint-url=http://localhost:4566 lambda invoke \
  --function-name auction-service-local-processAuctions \
  --payload '{}' \
  response.json
```

Then check the auction again:

```bash
curl "http://localhost:3000/auction/$AUCTION_ID"
```

You should see the auction status updated (e.g., closed) and any side effects applied.

---

### 5️⃣ Stopping LocalStack and Containers

To stop the LocalStack stack started via `docker-compose` (if defined as such in scripts):

```bash
# from repo root
docker compose down
```

If you have `npm run local:down` wired in `package.json`, you can also use:

```bash
npm run local:down
```

---

## 📡 Event Flow Summary

- **User actions** trigger Lambda functions via API Gateway.
- **Bids** and **auction state changes** emit events to **SQS**.
- **Notifications** are asynchronously processed and sent via **SES/SNS**.
- **CloudWatch** collects logs and metrics across services.

---

## 👨‍💻 Author

**Harshana Lakshara**
GitHub: [@UchihaIthachi](https://github.com/UchihaIthachi)

---

## 🪪 License

This project is licensed under the [MIT License](LICENSE).

```

If you want, I can next turn this into a small PR-style diff (`git diff` format) that you can paste directly into GitHub.
::contentReference[oaicite:0]{index=0}
```
