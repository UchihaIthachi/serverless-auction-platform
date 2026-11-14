const schema = {
  properties: {
    body: {
      type: "object",
      properties: {
        title: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          pattern: "\\S",
        },
        endingAt: {
          type: "string",
          format: "date-time",
        },
      },
      required: ["title"],
    },
  },
  required: ["body"],
};

export default schema;
