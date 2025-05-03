# 🛠️ Serverless Auction Platform

A scalable, event-driven Auction Platform built with the [Serverless Framework](https://www.serverless.com/) and deployed on AWS. This project follows a microservices architecture, emphasizing modularity, scalability, and reliability.

---

## 🚀 Tech Stack

* **Language**: Node.js
* **Framework**: Serverless Framework
* **Cloud Provider**: AWS (Lambda, API Gateway, DynamoDB, SQS, SNS)
* **Authentication**: AWS Lambda Authorizer + JWT
* **Messaging**: Amazon SQS
* **Notifications**: Amazon SNS / SES
* **Persistence**: Amazon DynamoDB
* **CI/CD**: GitHub Actions *(planned)*
* **Monitoring**: AWS CloudWatch

---

## 📁 Project Structure

```
serverless-auction-platform/
│
├── auction-service/        # Handles listing, bidding, and auction state transitions
├── auth-service/           # Manages user authentication and authorization via JWT
├── notification-service/   # Sends email/SMS notifications via SES/SNS
└── README.md               # Project documentation
```

---

## 📦 Features

### ✅ Auction Service

* Create, update, and delete auctions
* Start and end auctions with scheduled events
* Accept bids with validation logic
* Trigger notifications for winning bids

### 🔐 Auth Service

* User sign-up and login with email verification
* JWT issuance and validation
* Custom Lambda Authorizer for protected endpoints

### 📢 Notification Service

* Send email/SMS notifications on auction events
* Notify winners and bidders
* Integrated with AWS SES and SNS

---

## 🏗️ Deployment

Ensure the Serverless Framework is installed globally:

```bash
npm install -g serverless
```

Deploy a specific service:

```bash
cd auction-service
sls deploy
```

Repeat the deployment for `auth-service` and `notification-service`.

---

## 🔧 Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/UchihaIthachi/serverless-auction-platform.git
   cd serverless-auction-platform
   ```

2. Configure your AWS credentials:

   ```bash
   aws configure
   ```

3. Install dependencies for each service:

   ```bash
   cd auction-service && npm install
   cd ../auth-service && npm install
   cd ../notification-service && npm install
   ```

---

## 👨‍💻 Author

**Harshana Lakshara**
GitHub: [@UchihaIthachi](https://github.com/UchihaIthachi)

---

## 🪪 License

This project is licensed under the [MIT License](LICENSE).

---


