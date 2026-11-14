const schema = {
  properties: {
    body: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          exclusiveMinimum: 0,
          maximum: 1000000000,
        },
      },
      required: ['amount'],
    },
  },
  required: ['body'],
};

export default schema;
