import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { xmlResponse } from "../response";

async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const handle: HandleFn = async (request, _url) => {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const action = params.get("Action");

  // CreateQueue
  if (action === "CreateQueue") {
    const queueName = params.get("QueueName")!;
    const url = `/mock-api/000000000000/${queueName}`;
    const arn = `arn:aws:sqs:us-east-1:000000000000:${queueName}`;
    await put("sqs-queues", queueName, {
      name: queueName,
      url,
      arn,
      attributes: {},
      createdTimestamp: Date.now().toString(),
    });
    return xmlResponse(
      `<CreateQueueResponse><CreateQueueResult><QueueUrl>${url}</QueueUrl></CreateQueueResult></CreateQueueResponse>`
    );
  }

  // ListQueues
  if (action === "ListQueues") {
    const queues = await getAll("sqs-queues");
    const queueUrls = queues.map((q) => `<QueueUrl>${q.url}</QueueUrl>`).join("");
    return xmlResponse(
      `<ListQueuesResponse><ListQueuesResult>${queueUrls}</ListQueuesResult></ListQueuesResponse>`
    );
  }

  // GetQueueUrl
  if (action === "GetQueueUrl") {
    const queueName = params.get("QueueName")!;
    const queue = await get("sqs-queues", queueName);
    if (!queue) {
      return xmlResponse(
        `<ErrorResponse><Error><Code>AWS.SimpleQueueService.NonExistentQueue</Code><Message>Queue does not exist</Message></Error></ErrorResponse>`,
        400
      );
    }
    return xmlResponse(
      `<GetQueueUrlResponse><GetQueueUrlResult><QueueUrl>${queue.url}</QueueUrl></GetQueueUrlResult></GetQueueUrlResponse>`
    );
  }

  // SendMessage
  if (action === "SendMessage") {
    const queueUrl = params.get("QueueUrl")!;
    const messageBody = params.get("MessageBody")!;
    const messageId = crypto.randomUUID();
    const receiptHandle = crypto.randomUUID();
    const md5OfBody = await md5(messageBody);

    await put("sqs-messages", messageId, {
      queueUrl,
      messageId,
      body: messageBody,
      receiptHandle,
      md5OfBody,
      sentTimestamp: Date.now().toString(),
    });

    return xmlResponse(
      `<SendMessageResponse><SendMessageResult><MessageId>${messageId}</MessageId><MD5OfMessageBody>${md5OfBody}</MD5OfMessageBody></SendMessageResult></SendMessageResponse>`
    );
  }

  // ReceiveMessage
  if (action === "ReceiveMessage") {
    const queueUrl = params.get("QueueUrl")!;
    const maxMessages = parseInt(params.get("MaxNumberOfMessages") || "1", 10);
    const allMessages = await getAll("sqs-messages");
    const messages = allMessages.filter((m) => m.queueUrl === queueUrl).slice(0, maxMessages);

    const messagesXml = messages
      .map(
        (m) =>
          `<Message><MessageId>${m.messageId}</MessageId><ReceiptHandle>${m.receiptHandle}</ReceiptHandle><MD5OfBody>${m.md5OfBody}</MD5OfBody><Body>${m.body}</Body></Message>`
      )
      .join("");

    return xmlResponse(
      `<ReceiveMessageResponse><ReceiveMessageResult>${messagesXml}</ReceiveMessageResult></ReceiveMessageResponse>`
    );
  }

  // DeleteMessage
  if (action === "DeleteMessage") {
    const receiptHandle = params.get("ReceiptHandle")!;
    const allMessages = await getAll("sqs-messages");
    const message = allMessages.find((m) => m.receiptHandle === receiptHandle);
    if (message) {
      await del("sqs-messages", message.messageId);
    }
    return xmlResponse(
      `<DeleteMessageResponse><DeleteMessageResult/></DeleteMessageResponse>`
    );
  }

  // DeleteQueue
  if (action === "DeleteQueue") {
    const queueUrl = params.get("QueueUrl")!;
    const allQueues = await getAll("sqs-queues");
    const queue = allQueues.find((q) => q.url === queueUrl);
    if (queue) {
      await del("sqs-queues", queue.name);
      // Also delete all messages for this queue
      const allMessages = await getAll("sqs-messages");
      for (const msg of allMessages.filter((m) => m.queueUrl === queueUrl)) {
        await del("sqs-messages", msg.messageId);
      }
    }
    return xmlResponse(
      `<DeleteQueueResponse><DeleteQueueResult/></DeleteQueueResponse>`
    );
  }

  return new Response("Unknown Action", { status: 400 });
};
