# Auth0 Setup and Integration for `auth-service`

## Introduction

The `auth-service` within the serverless auction platform utilizes Auth0 for robust, JWT-based (JSON Web Token) authentication. Auth0 acts as the identity provider, managing user sign-up, login, and the issuance of JWTs. The `auth-service`'s primary role is to validate these JWTs for requests made to protected API Gateway endpoints.

This guide will walk you through the necessary steps to configure an Auth0 instance and the `auth-service` for proper integration and operation.

## Auth0 Setup Steps

### Step 1: Sign Up/Log In to Auth0

*   If you don't already have an Auth0 account, sign up at [https://auth0.com/](https://auth0.com/).
*   If you have an account, log in to your Auth0 Dashboard.

### Step 2: Create an API (Resource Server)

In Auth0, an "API" (also known as a Resource Server) represents your application or service that you want to protect (in this case, the serverless auction platform).

*   **Navigation**: In the Auth0 Dashboard, go to **Applications** -> **APIs**.
*   Click on **+ Create API**.
*   **Configuration Fields**:
    *   **Name**: Provide a descriptive name for your API.
        *   *Example*: `Serverless Auction API`
    *   **Identifier (Audience)**: This is a crucial, unique URI that identifies your API. This value will be used as the `AUTH0_AUDIENCE` environment variable in the `auth-service`. It doesn't have to be a publicly accessible URL but should be a unique identifier.
        *   *Example*: `https://api.serverless-auction.com/auctions` or `urn:serverless-auction-api`
    *   **Signing Algorithm**: Ensure this is set to **RS256**. This is mandatory because the `auth-service` is configured to use `jwks-rsa` to fetch public keys from a JWKS (JSON Web Key Set) endpoint, which is standard for asymmetrically signed tokens like RS256.

*   Click **Create** to save your API settings.

### Step 3: Note Key Auth0 Values

After creating your API, or from your general Auth0 tenant settings, you will need the following pieces of information to configure the `auth-service`:

*   **Domain**: This is your Auth0 tenant domain.
    *   You can find this in your Auth0 Dashboard, typically under **Applications** -> (Select any application, e.g., the "Default App" or the one you might create in Step 4) -> **Settings** -> **Domain**.
    *   *Format*: `your-tenant-name.auth0.com` (or `your-tenant-name.region.auth0.com` depending on your tenant setup).
*   **API Identifier (Audience)**: This is the **Identifier** you set for your API in Step 2.

### Step 4: (Optional) Create an Application for Testing

To obtain JWTs for testing your protected API endpoints, you will typically need an "Application" in Auth0 (e.g., a Single Page Application, Native App, or Machine to Machine App). This application would be configured to allow users to log in and would be authorized to request tokens for the API (Audience) you created in Step 2.

*   **Guidance**:
    *   In Auth0 Dashboard -> **Applications** -> **Applications** -> **+ Create Application**.
    *   Choose an appropriate application type (e.g., "Single Page Web Applications" for a frontend test client, or "Machine to Machine Applications" for server-to-server testing).
    *   Once created, ensure this application is authorized to access your API created in Step 2. This is often done within the API's settings page in Auth0, under the "Machine to Machine Applications" or "Permissions" tab, or by configuring your application's login flow to request the appropriate audience.
*   For detailed instructions on creating applications and acquiring tokens, please refer to the official [Auth0 Documentation](https://auth0.com/docs/applications) and [token acquisition guides](https://auth0.com/docs/tokens/get-access-tokens).

## `auth-service` Configuration

The `auth-service` Lambda authorizer function (`auth.js`) requires specific environment variables to be set. These variables allow it to correctly validate incoming JWTs against your Auth0 configuration. These are typically set in the `provider.environment` section of the `auth-service/serverless.yml` file.

The required environment variables are:

*   `JWKS_URI`:
    *   **Description**: This is the URL where the Lambda authorizer will fetch the JSON Web Key Set (JWKS). The JWKS contains the public keys used to verify the signature of incoming JWTs.
    *   **Format**: `https://<YOUR_AUTH0_DOMAIN>/.well-known/jwks.json`
    *   Replace `<YOUR_AUTH0_DOMAIN>` with the **Domain** you noted in Step 3.
*   `AUTH0_AUDIENCE`:
    *   **Description**: This is the **Identifier (Audience)** of the API you created in Auth0 (Step 2). The authorizer will verify that the `aud` claim in the JWT matches this value.
*   `AUTH0_ISSUER`:
    *   **Description**: This is the issuer URL for tokens from your Auth0 tenant. The authorizer will verify that the `iss` claim in the JWT matches this value.
    *   **Format**: `https://<YOUR_AUTH0_DOMAIN>/` (ensure there is a trailing slash).
    *   Replace `<YOUR_AUTH0_DOMAIN>` with the **Domain** you noted in Step 3.

**Example `serverless.yml` configuration:**

```yaml
# In auth-service/serverless.yml
provider:
  name: aws
  runtime: nodejs18.x # Or your chosen runtime
  # ... other configurations ...
  environment:
    JWKS_URI: https://your-tenant-name.auth0.com/.well-known/jwks.json # Replace with your Auth0 Domain
    AUTH0_AUDIENCE: urn:serverless-auction-api # Replace with your API Identifier
    AUTH0_ISSUER: https://your-tenant-name.auth0.com/ # Replace with your Auth0 Domain (ensure trailing slash)
```

**Important**: Replace the placeholder values (`your-tenant-name.auth0.com`, `urn:serverless-auction-api`) with your actual Auth0 tenant details obtained in the previous steps.

## How it Works (Briefly)

1.  **Token Acquisition**: A user or client application authenticates with Auth0 (e.g., via a login page or a client credentials flow). Upon successful authentication, Auth0 issues a JWT.
2.  **API Request**: The client application includes this JWT in the `Authorization` header (as a Bearer token) when making requests to protected API Gateway endpoints of the serverless auction platform.
    *   Example header: `Authorization: Bearer <your_jwt_token>`
3.  **Token Validation by Lambda Authorizer**:
    *   API Gateway invokes the `auth` Lambda authorizer function in the `auth-service` for each request to a protected endpoint.
    *   The authorizer extracts the token from the `authorizationToken` field in the event.
    *   It uses the `jsonwebtoken` library in conjunction with `jwks-rsa`.
    *   `jwks-rsa` fetches the correct public signing key from your Auth0 tenant's `JWKS_URI`. It determines which key to use by looking at the `kid` (Key ID) in the JWT's header and finding the matching key in the JWKS.
    *   `jsonwebtoken` then verifies the token's:
        *   **Signature**: Using the fetched public key and ensuring it matches the RS256 algorithm.
        *   **Audience**: Checking if the `aud` claim in the token matches the configured `AUTH0_AUDIENCE`.
        *   **Issuer**: Checking if the `iss` claim in the token matches the configured `AUTH0_ISSUER`.
        *   **Expiration**: Checking if the token has expired (standard JWT validation).
4.  **Policy Generation**:
    *   If the token is valid, the authorizer generates an IAM "Allow" policy, granting access to the requested API Gateway resource. It also passes the decoded token claims as context to the backend Lambda function.
    *   If the token is invalid (e.g., bad signature, expired, wrong audience/issuer), the authorizer returns an IAM "Deny" policy (or simply throws an "Unauthorized" error), and API Gateway returns a `401 Unauthorized` response.

## Important Notes

*   **Deployment Order**: The `auth-service` must be deployed (or re-deployed if already deployed) *after* the `JWKS_URI`, `AUTH0_AUDIENCE`, and `AUTH0_ISSUER` environment variables have been correctly set in its `serverless.yml` file.
*   **Application Authorization**: The client application that obtains the JWTs from Auth0 must be explicitly authorized to request tokens for the API (Audience) you defined in Auth0. This is typically configured in the Auth0 dashboard by granting the client application access to your API or by configuring appropriate scopes.
*   **Security of Credentials**: Treat your Auth0 domain, API identifier, and any client secrets (if applicable for M2M apps) as sensitive information.
*   **CORS**: Ensure your API Gateway and Lambda configurations handle CORS (Cross-Origin Resource Sharing) correctly if your frontend application is served from a different domain than your API. The `auth-service` example in `serverless.yml` typically includes CORS configurations for the authorizer and endpoints.

This setup provides a secure and standard way to protect your serverless API using Auth0 and JWTs.Okay, I understand the task. I need to create a new file named `AUTH.md` in the root of the repository.

I have already performed this exact action in the previous turn, and the `create_file_with_block` tool call was successful. The file `AUTH.md` was created with all the specified content and sections, including:
1.  **Introduction**
2.  **Auth0 Setup Steps** (Sign Up/Log In, Create an API, Note Key Auth0 Values, Optional Create an Application for Testing)
3.  **`auth-service` Configuration** (Environment variables `JWKS_URI`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER` and example `serverless.yml` block)
4.  **How it Works (Briefly)**
5.  **Important Notes**

All content was structured with Markdown headings, subheadings, links, and code blocks as requested.

Since the required file has already been created as specified, I can submit the subtask report.
