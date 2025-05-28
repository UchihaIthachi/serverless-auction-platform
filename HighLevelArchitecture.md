# High-Level Architecture

## Introduction

This document outlines the high-level architecture of the Serverless Auction Platform. The platform is built using a **microservices architecture**, with each service implemented as a **serverless function (FaaS)** and designed to be **event-driven**. This approach offers several benefits, including:

*   **Scalability**: Services can scale independently based on demand.
*   **Resilience**: Failure in one service is less likely to impact others.
*   **Maintainability**: Smaller, focused services are easier to develop, test, and deploy.
*   **Cost-Effectiveness**: Pay-per-use model of serverless functions can optimize operational costs.

## Core Services

The platform is composed of three core microservices:

### Auction Service

*   **Purpose**: This service is responsible for managing the entire lifecycle of auctions. This includes creating new auctions, allowing users to view available auctions, processing bids, and handling auction state transitions (e.g., starting, ending, and closing auctions). It also manages auction-related data such as item details, current bids, and auction status.
*   **Key AWS Services**:
    *   **AWS Lambda**: Hosts the business logic for auction management functions.
    *   **API Gateway**: Exposes RESTful endpoints for interacting with the auction service (e.g., creating auctions, placing bids).
    *   **DynamoDB**: Provides persistent storage for auction data, including auction details, bid history, and current status.

### Auth Service

*   **Purpose**: This service handles user authentication and authorization. It is responsible for verifying user identities and ensuring that only authenticated and authorized users can access protected API endpoints. It integrates with Auth0 for managing user credentials and issuing JSON Web Tokens (JWTs).
*   **Key AWS Services**:
    *   **AWS Lambda**: Hosts the logic for custom Lambda authorizers that validate JWTs and control access to other services. It may also handle callbacks or webhooks from Auth0 if needed.
    *   **API Gateway**: Secures API endpoints by integrating with Lambda authorizers.

### Notification Service

*   **Purpose**: This service is responsible for sending notifications to users based on auction events. For example, it notifies sellers when a new bid is placed on their item, informs bidders if they have been outbid, and alerts winners when an auction closes.
*   **Key AWS Services**:
    *   **AWS Lambda**: Hosts the functions that process notification requests and send emails or other forms of messages.
    *   **SQS (Simple Queue Service)**: Decouples the notification service from other services. Events that trigger notifications (e.g., a new bid, auction closure) are placed on an SQS queue, which the Notification Service then processes asynchronously.
    *   **SES (Simple Email Service) / SNS (Simple Notification Service)**: Used for dispatching emails (SES) or potentially SMS/push notifications (SNS) to users.

## Technology Stack

The platform leverages the following core technologies:

*   **Programming Language**: Node.js (primarily for AWS Lambda functions)
*   **Framework**: Serverless Framework (for defining and deploying serverless applications on AWS)
*   **Compute**: AWS Lambda (for running serverless functions)
*   **API Management**: API Gateway (for creating, publishing, maintaining, monitoring, and securing RESTful APIs)
*   **Database**: DynamoDB (a NoSQL database service for persistent storage, well-suited for serverless, scalable applications)
*   **Messaging/Queueing**:
    *   SQS (Simple Queue Service) (for decoupling microservices and enabling asynchronous event processing)
    *   SNS (Simple Notification Service) (for pub/sub messaging and fanning out notifications)
*   **Email Service**: SES (Simple Email Service) (for sending email notifications)
*   **Authentication**: Auth0 (for identity management and JWT-based authentication)
*   **Monitoring**: CloudWatch (for logging, monitoring, and alerting)

## Communication and Event Flow

Users interact with the platform primarily through RESTful APIs exposed by **API Gateway**. These API requests trigger AWS Lambda functions in the respective services.

Communication between services can be both synchronous and asynchronous:

*   **Synchronous Communication**:
    *   Client (e.g., web/mobile app) to API Gateway: HTTP requests.
    *   API Gateway to Lambda functions (e.g., in Auction Service or Auth Service): Direct invocation for request processing.
    *   Lambda Authorizers (Auth Service) are invoked synchronously by API Gateway to validate JWTs before routing requests to protected backend Lambda functions.

*   **Asynchronous Communication**:
    *   **SQS Queues**: Used extensively for decoupling services and handling tasks that don't require an immediate response.
        *   The **Auction Service** might publish events (e.g., "newBidPlaced", "auctionEnded") to an SQS queue.
        *   The **Notification Service** has Lambda functions that poll this SQS queue to process these events and send relevant notifications (e.g., email to the outbid user, email to the auction winner).
        *   The **Auction Service** itself might use SQS for its `processAuctions` handler, which could be triggered by a CloudWatch Event (e.g., on a schedule) to check for auctions that need to be closed. The actual closing logic might then publish further events (like "auctionClosed") to an SQS queue for the Notification Service.

### Conceptual Event Flow: Auction Creation and Bidding leading to Notification

1.  **User Creates Auction**:
    *   User (with a valid JWT) sends a `POST` request to `/auction` via API Gateway.
    *   API Gateway routes the request to the `createAuction` Lambda function in the Auction Service (after JWT validation by Auth Service's Lambda Authorizer).
    *   The `createAuction` Lambda function validates the request and saves the new auction details to DynamoDB.
    *   Optionally, an event "auctionCreated" could be published to an SQS queue if other services need to react to new auctions immediately (though not explicitly required by the Notification Service for this specific event in most basic scenarios).

2.  **User Places Bid**:
    *   User (with a valid JWT) sends a `PATCH` request to `/auction/{id}/bid` via API Gateway.
    *   API Gateway routes it to the `placeBid` Lambda function in the Auction Service (JWT validated).
    *   The `placeBid` Lambda function validates the bid (e.g., amount is higher than current highest bid, auction is still open) and updates the auction item in DynamoDB.
    *   The `placeBid` function then publishes an event, such as `{"eventType": "newBidPlaced", "auctionId": "...", "bidder": "...", "amount": ...}`, to an SQS queue (let's call it `MailQueue` as per the `iam/MailQueueIAM.yml`).

3.  **Notification Processing**:
    *   A Lambda function in the **Notification Service** is configured to poll the `MailQueue`.
    *   Upon receiving the `newBidPlaced` event, this Lambda function:
        *   Retrieves full auction details and previous bidder information if necessary (potentially by querying DynamoDB or using data within the event).
        *   Constructs notification messages (e.g., "You have been outbid!" to the previous highest bidder, "New bid on your item!" to the seller).
        *   Uses **SES** (or SNS) to send these notifications.

## Authentication and Authorization

Authentication and authorization are critical for securing the platform.

*   **Auth0**: Used as the primary identity provider. Users register and log in via Auth0, which then issues a JSON Web Token (JWT) upon successful authentication.
*   **JWTs**: These tokens are sent by the client in the `Authorization` header of API requests to protected endpoints.
*   **Auth Service (Lambda Authorizers)**: The Auth Service provides Lambda functions configured as "authorizers" in API Gateway.
    *   When a request comes to a protected API endpoint, API Gateway automatically invokes the associated Lambda authorizer.
    *   The Lambda authorizer validates the JWT (checks signature, expiration, issuer, etc.).
    *   If the token is valid, the authorizer returns an IAM policy that allows the request to proceed to the backend Lambda function (e.g., in the Auction Service).
    *   If the token is invalid, the authorizer returns a policy that denies access, and API Gateway responds with a `401 Unauthorized` or `403 Forbidden` error.

This mechanism ensures that only authenticated users with valid tokens can access sensitive operations like creating auctions or placing bids.

## Data Management

*   **DynamoDB**: This is the primary persistent data store for the Auction Service.
    *   It stores auction details (title, description, status, start/end times, current highest bid, seller info, picture URL, etc.).
    *   Bid history might also be stored, either as part of the auction item or in a separate table, depending on access patterns and data modeling choices.
*   **Suitability for Serverless**: DynamoDB is well-suited for serverless applications due to its:
    *   **Scalability**: Handles large amounts of data and high traffic volumes, scaling seamlessly.
    *   **Performance**: Provides low-latency access to data.
    *   **Pay-per-use model**: Aligns with the serverless cost model.
    *   **Integration with Lambda**: Easy to access from AWS Lambda functions using the AWS SDK.

Data consistency and integrity are managed at the application level within the Lambda functions that interact with DynamoDB. Transactions or conditional writes can be used for operations requiring atomicity (e.g., updating a bid only if the new amount is higher).

## Diagram

```mermaid
graph TD
    User[User Client] -->|HTTPS Request (JWT)| APIGW[API Gateway]

    subgraph Auth Service
        AuthLambda[Lambda Authorizer]
    end

    subgraph Auction Service
        CreateAuctionLambda[Create Auction Lambda]
        PlaceBidLambda[Place Bid Lambda]
        GetAuctionsLambda[Get Auctions Lambda]
        ProcessAuctionsLambda[Process Auctions Lambda]
        AuctionDB[(DynamoDB: Auctions Table)]
    end

    subgraph Notification Service
        MailQueue([SQS: Mail Queue])
        NotifyLambda[Notify Lambda]
        SES[SES/SNS]
    end

    APIGW -->|Validate JWT| AuthLambda
    AuthLambda -->|Allow/Deny| APIGW

    APIGW -- Create Auction --> CreateAuctionLambda
    CreateAuctionLambda -->|Write/Read| AuctionDB

    APIGW -- Place Bid --> PlaceBidLambda
    PlaceBidLambda -->|Write/Read| AuctionDB
    PlaceBidLambda -->|Event: New Bid| MailQueue

    APIGW -- Get Auctions/Auction --> GetAuctionsLambda
    GetAuctionsLambda -->|Read| AuctionDB

    CloudWatchEvents[CloudWatch Events (Scheduled)] -->|Trigger| ProcessAuctionsLambda
    ProcessAuctionsLambda -->|Read/Write| AuctionDB
    ProcessAuctionsLambda -->|Event: Auction Ended| MailQueue

    MailQueue -->|Polls for Messages| NotifyLambda
    NotifyLambda -->|Send Email| SES
```

**Diagram Legend:**

*   `User`: End-user interacting with the application.
*   `API Gateway`: Manages incoming API requests and routes them.
*   `Lambda Authorizer (Auth Service)`: Validates JWTs.
*   `Auction Service Lambdas`: Handle auction creation, bidding, retrieval, and processing.
*   `DynamoDB`: Stores auction data.
*   `SQS (Mail Queue)`: Decouples Auction Service from Notification Service for events.
*   `Notify Lambda (Notification Service)`: Processes messages from SQS and sends notifications.
*   `SES/SNS`: Email/Notification delivery service.
*   `CloudWatch Events`: Triggers scheduled processes (e.g., closing auctions).

**Flow Highlights:**

1.  User requests (e.g., create auction, place bid) go to API Gateway.
2.  API Gateway uses the Lambda Authorizer (Auth Service) to validate the JWT.
3.  Valid requests are routed to Auction Service Lambdas.
4.  Auction Service Lambdas interact with DynamoDB for data persistence.
5.  Events like "new bid" or "auction ended" are published to the SQS Mail Queue by the Auction Service.
6.  The Notification Service's Lambda polls the SQS queue and uses SES/SNS to send notifications.
7.  CloudWatch Events can trigger scheduled tasks like `ProcessAuctionsLambda` to close auctions.

## Scalability, Resilience, and Maintainability

The chosen serverless and microservices architecture inherently supports these key operational aspects:

*   **Scalability**:
    *   **Independent Scaling**: Each AWS Lambda function and other AWS managed services (API Gateway, DynamoDB, SQS) scale automatically and independently based on the incoming request volume or workload. This means the Auction Service can scale to handle many bid requests without impacting the Notification Service's capacity, and vice-versa.
    *   **Pay-per-use**: Resources are provisioned on demand, aligning costs directly with usage, which is efficient for variable workloads typical of auction platforms.

*   **Resilience**:
    *   **Fault Isolation**: The microservices architecture ensures that a failure in one service (e.g., an issue with the Notification Service) has a limited impact and is less likely to bring down the entire platform. Other services, like auction creation or bidding, can continue to operate.
    *   **Managed Services**: Leveraging AWS managed services like Lambda, SQS, and DynamoDB offloads much of the operational burden for ensuring high availability and fault tolerance, as these services are designed with built-in redundancy.
    *   **Asynchronous Communication**: Using SQS for inter-service communication enhances resilience. If the Notification Service is temporarily unavailable, messages from the Auction Service will queue up in SQS and be processed once the Notification Service recovers, preventing data loss.

*   **Maintainability**:
    *   **Focused Services**: Each microservice has a well-defined scope and responsibility (e.g., Auction Service for auction logic, Notification Service for sending alerts). This makes the codebase for each service smaller, easier to understand, test, and maintain.
    *   **Independent Deployments**: Services can be developed, updated, and deployed independently. This allows for faster iteration cycles and reduces the risk associated with deployments, as changes to one service do not require redeploying the entire application.
    *   **Technology Diversity (Potential)**: While currently using Node.js across services, a microservices approach allows for using different technologies for different services if deemed beneficial in the future, without affecting other parts of the system.

By adopting this architectural style, the Serverless Auction Platform is designed to be robust, adaptable to changing loads, and efficient to manage and evolve over time.
