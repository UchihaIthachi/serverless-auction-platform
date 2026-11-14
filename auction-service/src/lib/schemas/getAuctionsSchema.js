const schema = {
  properties: {
    queryStringParameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['OPEN', 'CLOSED'],
          default: 'OPEN',
        },
        // Page size; the response's X-Next-Token header holds the token for
        // the next page (absent on the last page).
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
        nextToken: {
          type: 'string',
          maxLength: 2048,
        },
      },
    },
  },
  required: [
    'queryStringParameters',
  ],
};

export default schema;
