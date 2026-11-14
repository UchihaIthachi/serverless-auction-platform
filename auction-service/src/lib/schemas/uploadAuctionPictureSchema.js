// The body is the picture as base64 text, optionally with a
// "data:image/jpeg;base64," prefix. Base64 padding ("=") is optional.
const schema = {
  properties: {
    body: {
      type: 'string',
      minLength: 4,
      pattern: '^\\s*(data:image\\/[\\w+.-]+;base64,)?[A-Za-z0-9+/\\r\\n]+={0,2}\\s*$',
    },
  },
  required: ['body'],
};

export default schema;
