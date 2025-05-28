
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

## 📋 Prerequisites

Before you begin, ensure you have met all the requirements outlined in our [**PREREQUISITES.md**](PREREQUISITES.md) guide. This includes setting up your AWS environment, Node.js, the Serverless Framework, and other necessary tools.

---

## 📁 Project Structure

```
serverless-auction-platform/
│
├── auction-service/        # Handles listing, bidding, and auction state transitions
├── auth-service/           # Manages user authentication and authorization via JWT
├── notification-service/   # Sends email/SMS notifications via SES/SNS
├── README.md               # This file: Project overview and main documentation
├── PREREQUISITES.md        # Details on environment setup and tools needed
├── AUTH.md                 # Guide for configuring Auth0 for the auth-service
├── USAGE.md                # API usage guide
└── HighLevelArchitecture.md # System architecture overview
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

## 🔧 Setup Instructions

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/UchihaIthachi/serverless-auction-platform.git
    cd serverless-auction-platform
    ```

2.  **Ensure Prerequisites are Met**:
    *   Make sure you have reviewed and completed all steps in [**PREREQUISITES.md**](PREREQUISITES.md). This includes configuring your AWS credentials.

3.  **Configure Auth0 for `auth-service`**:
    *   The `auth-service` requires integration with Auth0 for user authentication. Follow the detailed steps in our [**AUTH.md**](AUTH.md) guide to set up your Auth0 application and API.
    *   **Crucial**: You must configure the necessary environment variables (`JWKS_URI`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`) in `auth-service/serverless.yml` as described in `AUTH.md` **before** attempting to deploy the `auth-service`.

4.  **Install Dependencies for All Services**:
    *   Navigate into each service directory and install Node.js dependencies:
        ```bash
        cd auction-service && npm install && cd ..
        cd auth-service && npm install && cd ..
        cd notification-service && npm install && cd ..
        ```

---

## 🏗️ Deployment

After completing all setup steps, including Auth0 configuration for the `auth-service` and installing all dependencies:

1.  **Install Serverless Framework CLI** (if not already done, see [PREREQUISITES.md](PREREQUISITES.md)):
    ```bash
    npm install -g serverless
    ```

2.  **Deploy Each Service**:
    *   **Important**: It's recommended to deploy the `auth-service` first, as its resources (like the Lambda authorizer ARN) are referenced by other services (e.g., `auction-service`) using CloudFormation cross-stack references (e.g., `#{AWS::AccountId}:function:auth-service-${self:provider.stage}-auth`).
    *   Deploy services individually by navigating to their directories:

        ```bash
        cd auth-service
        sls deploy
        cd ..

        cd auction-service
        sls deploy
        cd ..

        cd notification-service
        sls deploy
        cd ..
        ```
    *   Take note of any outputs from the `sls deploy` command, such as API Gateway endpoints.

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


