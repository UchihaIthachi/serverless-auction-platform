# High-Level Architecture

## Introduction

This document outlines the high-level architecture of the Serverless Auction Platform. The platform is built using a **microservices architecture**. Backend services are implemented as **serverless functions (FaaS)** operating within a custom **AWS Virtual Private Cloud (VPC)** for enhanced security. The frontend is a **Next.js application hosted on Vercel**. This overall approach offers several benefits, including:

*   **Scalability**: Services can scale independently based on demand.
*   **Resilience**: Failure in one service is less likely to impact others.
*   **Maintainability**: Smaller, focused services are easier to develop, test, and deploy.
*   **Cost-Effectiveness**: Pay-per-use model of serverless functions can optimize operational costs.
*   **Enhanced Security**: VPC provides network isolation for backend resources.

## Core Services

The platform is composed of three core microservices:

### Auction Service

*   **Purpose**: This service is responsible for managing the entire lifecycle of auctions. This includes creating new auctions, allowing users to view available auctions, processing bids, and handling auction state transitions (e.g., starting, ending, and closing auctions). It also manages auction-related data such as item details, current bids, and auction status.
*   **Key AWS Services**:
    *   **AWS Lambda**: Hosts the business logic for auction management functions. Lambda functions operate within a private VPC, accessing other AWS services like DynamoDB, SQS, and S3 securely via VPC Endpoints.
    *   **API Gateway**: Exposes RESTful endpoints for interacting with the auction service (e.g., creating auctions, placing bids).
    *   **DynamoDB**: Provides persistent storage for auction data, including auction details, bid history, and current status. Accessed via a VPC Endpoint.
    *   **S3**: Used for storing auction item pictures. Accessed via a VPC Endpoint.

### Auth Service

*   **Purpose**: This service handles user authentication and authorization. It is responsible for verifying user identities and ensuring that only authenticated and authorized users can access protected API endpoints. It integrates with Auth0 for managing user credentials and issuing JSON Web Tokens (JWTs).
*   **Key AWS Services**:
    *   **AWS Lambda**: Hosts the logic for custom Lambda authorizers that validate JWTs and control access to other services. Lambda functions operate within a private VPC.
    *   **API Gateway**: Secures API endpoints by integrating with Lambda authorizers.

### Notification Service

*   **Purpose**: This service is responsible for sending notifications to users based on auction events. For example, it notifies sellers when a new bid is placed on their item, informs bidders if they have been outbid, and alerts winners when an auction closes.
*   **Key AWS Services**:
    *   **AWS Lambda**: Hosts the functions that process notification requests and send emails or other forms of messages. Lambda functions operate within a private VPC, accessing other AWS services like SQS securely via VPC Endpoints.
    *   **SQS (Simple Queue Service)**: Decouples the notification service from other services. Events that trigger notifications (e.g., a new bid, auction closure) are placed on an SQS queue, which the Notification Service then processes asynchronously. Accessed via a VPC Endpoint.
    *   **SES (Simple Email Service) / SNS (Simple Notification Service)**: Used for dispatching emails (SES) or potentially SMS/push notifications (SNS). Access to these services from Lambda within the VPC is typically via a NAT Gateway.

## Technology Stack

The platform leverages the following core technologies:

*   **Programming Language**: Node.js (primarily for AWS Lambda functions)
*   **Framework**: Serverless Framework (for defining and deploying serverless applications on AWS)
*   **Frontend Framework**: Next.js (for the user-facing application)
*   **Frontend Hosting**: Vercel (for hosting and CI/CD of the Next.js frontend)
*   **Compute**: AWS Lambda (for running serverless functions within a VPC)
*   **API Management**: API Gateway (for creating, publishing, maintaining, monitoring, and securing RESTful APIs)
*   **Database**: DynamoDB (a NoSQL database service for persistent storage, accessed via VPC Endpoint)
*   **Storage**: S3 (for object storage, e.g., auction images, accessed via VPC Endpoint)
*   **Messaging/Queueing**:
    *   SQS (Simple Queue Service) (for decoupling microservices, accessed via VPC Endpoint)
    *   SNS (Simple Notification Service) (for pub/sub messaging and fanning out notifications)
*   **Email Service**: SES (Simple Email Service) (for sending email notifications)
*   **Authentication**: Auth0 (for identity management and JWT-based authentication)
*   **Monitoring**: CloudWatch (for logging, monitoring, and alerting, logs accessed via VPC Endpoint)
*   **Infrastructure as Code**: Terraform (for VPC and foundational AWS infrastructure management)
*   **Networking**: AWS VPC (Virtual Private Cloud), including Subnets, NAT Gateway, Security Groups, and VPC Endpoints (S3, DynamoDB, SQS, CloudWatch Logs, STS).

## Communication and Event Flow

Users interact with the platform primarily through the **Next.js frontend application hosted on Vercel**, which communicates with RESTful APIs exposed by **API Gateway**. API Gateway, while public-facing, invokes Lambda functions now running inside the custom VPC.

Communication between services can be both synchronous and asynchronous:

*   **Synchronous Communication**:
    *   **Next.js frontend on Vercel** to API Gateway: HTTP requests.
    *   API Gateway to Lambda functions (e.g., in Auction Service or Auth Service): Direct invocation into the VPC for request processing.
    *   Lambda Authorizers (Auth Service) are invoked synchronously by API Gateway to validate JWTs before routing requests to protected backend Lambda functions within the VPC.

*   **Asynchronous Communication**:
    *   **SQS Queues**: Used extensively for decoupling services and handling tasks that don't require an immediate response.
        *   The **Auction Service** might publish events (e.g., "newBidPlaced", "auctionEnded") to an SQS queue.
        *   The **Notification Service** has Lambda functions that poll this SQS queue (via its VPC Endpoint) to process these events and send relevant notifications.
        *   The **Auction Service** itself might use SQS for its `processAuctions` handler.

### Conceptual Event Flow: Auction Creation and Bidding leading to Notification

1.  **User Creates Auction (via Next.js Frontend on Vercel)**:
    *   User sends a `POST` request from the Next.js app to `/auction` via API Gateway.
    *   API Gateway routes the request to the `createAuction` Lambda function (in a private subnet within the VPC) in the Auction Service (after JWT validation by Auth Service's Lambda Authorizer).
    *   The `createAuction` Lambda function validates the request and saves the new auction details to DynamoDB (via VPC Endpoint).

2.  **User Places Bid (via Next.js Frontend on Vercel)**:
    *   User sends a `PATCH` request from the Next.js app to `/auction/{id}/bid` via API Gateway.
    *   API Gateway routes it to the `placeBid` Lambda function (in VPC) in the Auction Service (JWT validated).
    *   The `placeBid` Lambda function validates the bid and updates the auction item in DynamoDB (via VPC Endpoint).
    *   The `placeBid` function then publishes an event to an SQS queue (via VPC Endpoint).

3.  **Notification Processing**:
    *   A Lambda function (in VPC) in the **Notification Service** polls the SQS queue (via VPC Endpoint).
    *   Upon receiving an event, this Lambda function constructs notification messages.
    *   Uses **SES** (via NAT Gateway for internet access) to send these notifications.

## Authentication and Authorization

Authentication and authorization are critical for securing the platform.

*   **Auth0**: Used as the primary identity provider. Users register and log in via Auth0 through the Next.js frontend, which then issues a JSON Web Token (JWT) upon successful authentication.
*   **JWTs**: These tokens are sent by the Next.js frontend in the `Authorization` header of API requests to protected endpoints.
*   **Auth Service (Lambda Authorizers)**: The Auth Service provides Lambda functions (in VPC) configured as "authorizers" in API Gateway.
    *   When a request comes to a protected API endpoint, API Gateway automatically invokes the associated Lambda authorizer.
    *   The Lambda authorizer validates the JWT.
    *   If the token is valid, the authorizer returns an IAM policy that allows the request to proceed to the backend Lambda function (e.g., in the Auction Service within the VPC).
    *   If the token is invalid, API Gateway responds with a `401 Unauthorized` or `403 Forbidden` error.

This mechanism ensures that only authenticated users with valid tokens can access sensitive operations.

## Data Management

*   **DynamoDB**: Primary persistent data store for the Auction Service, accessed via a VPC Gateway Endpoint.
*   **S3**: Used for storing auction item pictures, accessed via a VPC Gateway Endpoint.
*   **Suitability for Serverless**: DynamoDB and S3 are well-suited for serverless applications due to their scalability, performance, pay-per-use model, and ease of integration with Lambda.

Data consistency and integrity are managed at the application level within the Lambda functions.

## Diagram

```mermaid
graph TD
    User[Next.js Frontend on Vercel] -- "HTTPS Request (JWT)" --> APIGW[API Gateway (Public)]

    subgraph AWS Cloud
        subgraph VPC [AWS VPC]
            direction LR
            subgraph PublicSubnets [Public Subnets]
                direction TB
                NGW[NAT Gateway]
            end

            subgraph PrivateSubnets [Private Subnets]
                direction TB
                subgraph AuthServiceVPC [Auth Service]
                    AuthLambda[Lambda Authorizer]
                end
                subgraph AuctionServiceVPC [Auction Service]
                    CreateAuctionLambda[Create Auction Lambda]
                    PlaceBidLambda[Place Bid Lambda]
                    GetAuctionsLambda[Get Auctions Lambda]
                    ProcessAuctionsLambda[Process Auctions Lambda]
                end
                subgraph NotificationServiceVPC [Notification Service]
                    NotifyLambda[Notify Lambda]
                end
            end

            subgraph VPCEndpoints [VPC Endpoints]
                direction TB
                DynamoDBEndpoint[DynamoDB GW Endpoint]
                S3Endpoint[S3 GW Endpoint]
                SQSEndpoint[SQS IF Endpoint]
                LogsEndpoint[CW Logs IF Endpoint]
                STSEndpoint[STS IF Endpoint]
            end

            PrivateSubnets -- "Route via NGW for Internet" --> NGW
            NGW -- "To Internet (e.g., SES)" --> Internet[(Internet)]

            AuthLambda -- "Access via VPC Endpoints" --> LogsEndpoint
            CreateAuctionLambda -- "Access via VPC Endpoints" --> DynamoDBEndpoint
            PlaceBidLambda -- "Access via VPC Endpoints" --> DynamoDBEndpoint
            GetAuctionsLambda -- "Access via VPC Endpoints" --> DynamoDBEndpoint
            ProcessAuctionsLambda -- "Access via VPC Endpoints" --> DynamoDBEndpoint
            CreateAuctionLambda -- "Access via VPC Endpoints" --> S3Endpoint
            PlaceBidLambda -- "Publishes to SQS via Endpoint" --> SQSEndpoint
            ProcessAuctionsLambda -- "Publishes to SQS via Endpoint" --> SQSEndpoint
            NotifyLambda -- "Polls SQS via Endpoint" --> SQSEndpoint
            NotifyLambda -- "Access via VPC Endpoints" --> LogsEndpoint

        end


        subgraph AWSServices [AWS Services (Outside VPC but accessed privately)]
            DynamoDB[(DynamoDB)]
            S3[(S3 Buckets)]
            SQS([SQS Queues])
            CloudWatchLogs[(CloudWatch Logs)]
            STS[(AWS STS)]
            SES[(SES/SNS)]
        end

        DynamoDBEndpoint -- "PrivateLink" --> DynamoDB
        S3Endpoint -- "PrivateLink" --> S3
        SQSEndpoint -- "PrivateLink" --> SQS
        LogsEndpoint -- "PrivateLink" --> CloudWatchLogs
        STSEndpoint -- "PrivateLink" --> STS
        Internet -- "Public Access" --> SES
    end

    APIGW -- "Validate JWT" --> AuthLambda
    AuthLambda -- "Allow/Deny" --> APIGW

    APIGW -- "Invoke Lambda in Private Subnet" --> CreateAuctionLambda
    APIGW -- "Invoke Lambda in Private Subnet" --> PlaceBidLambda
    APIGW -- "Invoke Lambda in Private Subnet" --> GetAuctionsLambda

    CloudWatchEvents[CloudWatch Events (Scheduled)] -- "Trigger" --> ProcessAuctionsLambda


```

**Diagram Legend:**

*   `Next.js Frontend on Vercel`: User-facing application.
*   `API Gateway (Public)`: Manages incoming API requests and routes them to Lambdas within the VPC.
*   `AWS VPC`: Custom Virtual Private Cloud hosting backend resources.
    *   `Public Subnets`: Contain resources like the NAT Gateway.
    *   `Private Subnets`: Host Lambda functions for all services (Auction, Auth, Notification).
    *   `NAT Gateway (NGW)`: Allows Lambdas in private subnets to access the internet (e.g., for SES).
    *   `VPC Endpoints`: Enable private access to AWS services (DynamoDB, S3, SQS, CloudWatch Logs, STS) without traversing the public internet.
*   `Lambda Functions (Auth, Auction, Notification)`: Reside in private subnets.
*   `AWS Services (DynamoDB, S3, SQS, CloudWatch Logs, STS, SES)`: Core AWS services used by the application.
*   `CloudWatch Events`: Triggers scheduled processes.

**Flow Highlights:**

1.  User interacts with the Next.js frontend on Vercel.
2.  Frontend sends requests (with JWT) to the public API Gateway.
3.  API Gateway uses the Lambda Authorizer (Auth Service, in VPC) to validate the JWT.
4.  Valid requests are routed by API Gateway to backend Lambda functions (Auction, Notification) running in private subnets within the VPC.
5.  Lambda functions interact with DynamoDB, S3, and SQS primarily through VPC Endpoints.
6.  For external services not covered by VPC Endpoints (like SES), Lambda functions in private subnets route traffic through the NAT Gateway.
7.  Events like "new bid" are published to SQS (via Endpoint). The Notification Service's Lambda polls SQS (via Endpoint) and uses SES (via NAT Gateway) to send notifications.

## Scalability, Resilience, and Maintainability

The chosen serverless and microservices architecture, now enhanced with a VPC, supports these key operational aspects:

*   **Scalability**:
    *   **Independent Scaling**: Each AWS Lambda function and other AWS managed services (API Gateway, DynamoDB, SQS) scale automatically and independently.
    *   **Pay-per-use**: Efficient for variable workloads.

*   **Resilience**:
    *   **Fault Isolation**: Microservices architecture limits the blast radius of failures.
    *   **Managed Services**: AWS managed services provide built-in redundancy.
    *   **Asynchronous Communication**: SQS enhances resilience for inter-service communication.

*   **Maintainability**:
    *   **Focused Services**: Smaller, easier-to-manage codebases.
    *   **Independent Deployments**: Faster iteration and reduced deployment risk.

*   **Security**:
    *   **Network Isolation**: The custom VPC significantly enhances security by providing network isolation for backend Lambda functions. Lambdas are not directly exposed to the public internet.
    *   **Controlled Access**: VPC Endpoints ensure that access to critical AWS services like DynamoDB, S3, and SQS occurs over the AWS private network, further reducing exposure.
    *   **Reduced Attack Surface**: By placing Lambdas in private subnets and using API Gateway as the controlled entry point, the attack surface for backend compute resources is minimized.
    *   **Secure Outbound Traffic**: The NAT Gateway provides a controlled point for any necessary outbound internet access from Lambdas, which can be monitored or restricted if needed.

By adopting this architectural style, the Serverless Auction Platform is designed to be robust, secure, adaptable to changing loads, and efficient to manage and evolve over time.
```
