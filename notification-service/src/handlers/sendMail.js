import { ses } from '../../../shared/aws';

async function sendMail(event, context) {
  const record = event.Records[0];
  console.log('record processing', record);

  const email = JSON.parse(record.body);
  const { subject, body, recipient } = email;

  const params = {
    Source: 'ariel@codingly.io',
    Destination: {
      ToAddresses: [recipient],
    },
    Message: {
      Body: {
        Text: {
          Data: body,
        },
      },
      Subject: {
        Data: subject,
      },
    },
  };

  try {
    const result = await ses.send(new SendEmailCommand(params));
    console.log(result);
    return result;
  } catch (error) {
    console.error(error);
  }
}

export const handler = sendMail;