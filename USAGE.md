# API Usage Guide

## Introduction

This API allows users to create and participate in online auctions. Users can list items for auction, view available auctions, and place bids on items they are interested in. The API also includes authentication features to secure user data and actions.

## Authentication

Most auction endpoints require authentication to ensure that only authorized users can perform actions such as creating auctions or placing bids.

Authentication is handled via Auth0 and JSON Web Tokens (JWTs).

To obtain a JWT token:

1.  Sign up or log in through the Auth0 service associated with this application.
2.  Upon successful authentication, you will receive a JWT token.

This JWT token must be included in the `Authorization` header of your requests to protected endpoints. The format is:

`Authorization: Bearer <YOUR_JWT_TOKEN>`

## API Endpoints

### Auction Service

#### `POST /auction`

*   **Description**: Creates a new auction.
*   **Authentication**: Required.
*   **Request Body**:
    ```json
    {
      "title": "string"
    }
    ```
*   **Example Request**:
    ```json
    {
      "title": "Vintage Typewriter"
    }
    ```
*   **Example Response (201 Created)**:
    ```json
    {
      "id": "c2a7a802-4b5f-4b9c-9f0d-017e0b6a0ef4",
      "title": "Vintage Typewriter",
      "status": "OPEN",
      "createdAt": "2023-10-27T10:00:00.000Z",
      "highestBid": {
        "amount": 0
      }
    }
    ```

#### `GET /auctions`

*   **Description**: Retrieves a list of all available auctions.
*   **Authentication**: Not required.
*   **Example Response (200 OK)**:
    ```json
    [
      {
        "id": "c2a7a802-4b5f-4b9c-9f0d-017e0b6a0ef4",
        "title": "Vintage Typewriter",
        "status": "OPEN",
        "createdAt": "2023-10-27T10:00:00.000Z",
        "highestBid": {
          "amount": 50
        }
      },
      {
        "id": "d3b8b903-5c6g-5c0d-0g1e-028f1c7b1fg5",
        "title": "Antique Radio",
        "status": "OPEN",
        "createdAt": "2023-10-28T11:00:00.000Z",
        "highestBid": {
          "amount": 75
        }
      }
    ]
    ```

#### `GET /auction/{id}`

*   **Description**: Retrieves details for a specific auction by its ID.
*   **Authentication**: Not required.
*   **Example Response (200 OK)**:
    ```json
    {
      "id": "c2a7a802-4b5f-4b9c-9f0d-017e0b6a0ef4",
      "title": "Vintage Typewriter",
      "status": "OPEN",
      "createdAt": "2023-10-27T10:00:00.000Z",
      "endingAt": "2023-11-03T10:00:00.000Z",
      "highestBid": {
        "amount": 50,
        "bidder": "user@example.com"
      },
      "seller": "seller@example.com"
    }
    ```

#### `PATCH /auction/{id}/bid`

*   **Description**: Places a bid on a specific auction.
*   **Authentication**: Required.
*   **Request Body**:
    ```json
    {
      "amount": "number"
    }
    ```
*   **Example Request**:
    ```json
    {
      "amount": 100
    }
    ```
*   **Example Response (200 OK)**:
    ```json
    {
      "id": "c2a7a802-4b5f-4b9c-9f0d-017e0b6a0ef4",
      "title": "Vintage Typewriter",
      "status": "OPEN",
      "createdAt": "2023-10-27T10:00:00.000Z",
      "endingAt": "2023-11-03T10:00:00.000Z",
      "highestBid": {
        "amount": 100,
        "bidder": "bidder@example.com"
      },
      "seller": "seller@example.com"
    }
    ```

#### `PATCH /auction/{id}/picture`

*   **Description**: Uploads/associates a picture URL with an auction. This endpoint updates the auction record with the URL of the picture. The actual image upload to a storage service (like S3) might be handled separately (e.g., using a pre-signed URL provided by another endpoint, or uploaded directly by the client to S3 which then notifies the service). For the purpose of this API, this endpoint associates the picture URL.
*   **Authentication**: Required.
*   **Request Body**:
    ```json
    {
      "pictureUrl": "string"
    }
    ```
*   **Example Request**:
    ```json
    {
      "pictureUrl": "https://example-bucket.s3.amazonaws.com/pictures/auction_vintage_typewriter.jpg"
    }
    ```
*   **Example Response (200 OK)**:
    ```json
    {
      "id": "c2a7a802-4b5f-4b9c-9f0d-017e0b6a0ef4",
      "title": "Vintage Typewriter",
      "status": "OPEN",
      "createdAt": "2023-10-27T10:00:00.000Z",
      "endingAt": "2023-11-03T10:00:00.000Z",
      "highestBid": {
        "amount": 100,
        "bidder": "bidder@example.com"
      },
      "seller": "seller@example.com",
      "pictureUrl": "https://example-bucket.s3.amazonaws.com/pictures/auction_vintage_typewriter.jpg"
    }
    ```

### Auth Service

#### `POST /public`

*   **Description**: Example public endpoint. Does not require authentication.
*   **Authentication**: Not required.
*   **Example Response (200 OK)**:
    ```json
    {
      "message": "This is a public endpoint. Anyone can access it."
    }
    ```

#### `POST /private`

*   **Description**: Example private endpoint. Requires authentication.
*   **Authentication**: Required.
*   **Example Response (200 OK)**:
    ```json
    {
      "message": "This is a private endpoint. You need to be authenticated to access it.",
      "user": "user@example.com"
    }
    ```

### Notification Service

The Notification Service does not have direct user-facing API endpoints. It works internally based on events from other services (e.g., when an auction is created or a bid is placed) to send notifications (like emails) to relevant users.

## Common Workflows

### Creating an Auction

1.  **Obtain JWT Token**: Authenticate with the Auth0 service to get a JWT token.
2.  **Make API Request**: Send a `POST` request to the `/auction` endpoint.
    *   Include the JWT token in the `Authorization` header: `Authorization: Bearer <YOUR_JWT_TOKEN>`
    *   Provide the auction title in the request body:
        ```json
        {
          "title": "My New Auction Item"
        }
        ```
3.  **Receive Response**: If successful, you'll receive a 201 Created response with the details of the newly created auction.

### Placing a Bid

1.  **Obtain JWT Token**: Authenticate with the Auth0 service to get a JWT token.
2.  **Find an Auction**:
    *   You can list available auctions by sending a `GET` request to `/auctions`.
    *   Identify the `id` of the auction you want to bid on from the response.
3.  **Make API Request**: Send a `PATCH` request to the `/auction/{id}/bid` endpoint, replacing `{id}` with the actual auction ID.
    *   Include the JWT token in the `Authorization` header: `Authorization: Bearer <YOUR_JWT_TOKEN>`
    *   Provide your bid amount in the request body:
        ```json
        {
          "amount": 125
        }
        ```
4.  **Receive Response**: If successful, you'll receive a 200 OK response with the updated auction details, showing your bid as the current highest bid (if it is).

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of an API request.

*   **200 OK**: The request was successful.
*   **201 Created**: The request was successful, and a resource was created.
*   **204 No Content**: The request was successful, but there is no content to return.
*   **400 Bad Request**: The request was invalid or cannot be otherwise served. The request syntax may be incorrect, or it may contain invalid parameters.
*   **401 Unauthorized**: Authentication failed or was not provided. Ensure you have a valid JWT token in the `Authorization` header.
*   **403 Forbidden**: You are authenticated, but you do not have permission to access the requested resource.
*   **404 Not Found**: The requested resource could not be found.
*   **500 Internal Server Error**: An unexpected error occurred on the server.

Error responses will typically include a JSON body with more details about the error:

```json
{
  "error": "Brief error description",
  "message": "More detailed error message"
}
```
