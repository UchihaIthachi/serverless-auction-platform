# Prerequisites

## Overview

This document lists all the necessary tools, accounts, and configurations required to successfully deploy and run the serverless auction platform. Please ensure all prerequisites are met before proceeding with the deployment.

## Core Tools

The following command-line interface (CLI) tools and runtime environments are essential for deploying and managing the platform.

*   **Node.js**:
    *   A recent LTS (Long Term Support) version is recommended. This project's Lambda functions are configured for the **Node.js 18.x** runtime.
    *   Download and install Node.js from [https://nodejs.org/](https://nodejs.org/).
*   **npm (Node Package Manager)**:
    *   npm is included with Node.js installations.
    *   It is used for managing project dependencies (both for the services and for deployment tools like the Serverless Framework) and running scripts defined in `package.json` files.
*   **AWS CLI (Command Line Interface)**:
    *   The AWS CLI is necessary for configuring your local AWS credentials profile and for interacting with AWS services directly from your terminal.
    *   It's recommended to install the latest version.
    *   Installation guide: [https://aws.amazon.com/cli/](https://aws.amazon.com/cli/).
*   **Serverless Framework CLI**:
    *   This framework is used for defining and deploying the serverless application (Lambda functions, API Gateway endpoints, event sources, etc.) to AWS.
    *   Install globally via npm:
        ```bash
        npm install -g serverless
        ```
    *   For more information, visit the Serverless Framework website: [https://www.serverless.com/](https://www.serverless.com/).
*   **Git**:
    *   Git is required for cloning the repository to your local machine.
    *   Download and install Git from [https://git-scm.com/](https://git-scm.com/).

## AWS Account

*   An active AWS (Amazon Web Services) account is required to deploy and host the platform.
*   The account will be used to provision and manage all necessary cloud resources, including but not limited to:
    *   AWS Lambda (for serverless functions)
    *   API Gateway (for HTTP request handling)
    *   DynamoDB (for NoSQL database storage)
    *   SQS (Simple Queue Service for message queuing)
    *   S3 (Simple Storage Service for storing auction images)
    *   SES (Simple Email Service for notifications)
*   The AWS user or role performing the deployment will need sufficient IAM (Identity and Access Management) permissions to create, update, and manage these resources.

## AWS Configuration

*   You must configure your AWS credentials locally to allow the AWS CLI and the Serverless Framework to interact with your AWS account.
*   This is typically done by running the `aws configure` command and providing your AWS Access Key ID, Secret Access Key, default region, and default output format.
    ```bash
    aws configure
    ```
*   It is recommended to use IAM user credentials with permissions that are sufficient for deployment. While administrative access might be used for initial setup, always consider the principle of least privilege for ongoing operations and security.

## Auth0 Account (for Auth Service)

*   An Auth0 account is necessary if you intend to deploy the `auth-service` and utilize the JWT-based authentication mechanism provided in this platform.
*   Auth0 is used for user identity management (sign-up, login) and issuing JSON Web Tokens (JWTs) that are validated by the `auth-service`.
*   Detailed setup instructions for configuring Auth0 and integrating it with the `auth-service` will be covered in a separate `AUTH_SETUP.md` document (Note: actual filename for Auth0 setup guide might differ, refer to project documentation).

## Service-Specific Dependencies

*   Each microservice (`auction-service`, `auth-service`, `notification-service`) has its own Node.js dependencies. These are listed in the `package.json` file located within each service's respective directory.
*   These dependencies are installed by navigating into each service's directory and running the `npm install` command. This is a standard part of the setup process after cloning the repository.
    ```bash
    cd auction-service
    npm install
    cd ../auth-service
    npm install
    cd ../notification-service
    npm install
    ```

Make sure all these prerequisites are in place before you start the deployment process to ensure a smooth setup.
