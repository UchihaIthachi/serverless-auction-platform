
# 🛠️ Serverless Auction Platform

A **capstone project** built using **AWS**, following a **microservices architecture** with an **event-driven**, **serverless (FaaS)** design. This platform enables scalable, modular, and resilient online auctions using the [Serverless Framework](https://www.serverless.com/) deployed on AWS cloud services.

---

## 🧱 Architecture Overview

* **Architecture Style**: Microservices
* **Execution Model**: Serverless (FaaS - Function as a Service)
* **Design Pattern**: Event-Driven
* **Cloud Platform**: AWS
* **Use Case**: Capstone project demonstrating best practices in cloud-native application development

Each microservice is independently deployable and communicates via AWS-managed messaging and notification services, following the principles of loose coupling and asynchronous processing.

---

## 🚀 Tech Stack

* **Language**: Node.js
* **Framework**: Serverless Framework
* **Cloud Services**:

  * AWS Lambda (FaaS)
  * API Gateway
  * DynamoDB
  * SQS (Simple Queue Service)
  * SNS (Simple Notification Service)
  * SES (Simple Email Service)
  * CloudWatch (Monitoring)
* **Authentication**: JWT + Lambda Authorizer
* **CI/CD**: GitHub Actions *(planned)*

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
* Accept bids with validation and conflict handling
* Trigger notifications and events for auction outcomes

### 🔐 Auth Service

* User sign-up and login with email verification
* JWT token generation and validation
* Lambda Authorizer integration for securing API endpoints

### 📢 Notification Service

* Send notifications via email and SMS for auction events
* Inform winning bidders and auction owners
* Uses AWS SES and SNS for delivery

---

## 🏗️ Deployment

Ensure the Serverless Framework is installed:

```bash
npm install -g serverless
```

Deploy individual services:

```bash
cd auction-service
sls deploy
```

Repeat the above for `auth-service` and `notification-service`.

---

## 🔧 Setup Instructions

1. Clone the repository:

   ```bash
   git clone https://github.com/UchihaIthachi/serverless-auction-platform.git
   cd serverless-auction-platform
   ```

2. Configure AWS credentials:

   ```bash
   aws configure
   ```

3. Install dependencies for all services:

   ```bash
   cd auction-service && npm install
   cd ../auth-service && npm install
   cd ../notification-service && npm install
   ```

---

## 📡 Event Flow Summary

* **User actions** trigger Lambda functions through API Gateway.
* **Bids** and **auction state changes** emit events to **SQS queues**.
* **Notifications** are asynchronously processed and sent via **SNS/SES**.
* **CloudWatch** monitors logs and metrics across services.

---

## 👨‍💻 Author

**Harshana Lakshara**
GitHub: [@UchihaIthachi](https://github.com/UchihaIthachi)

---

## 🪪 License

This project is licensed under the [MIT License](LICENSE).

---


