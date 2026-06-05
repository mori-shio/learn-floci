import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { xmlResponse, jsonResponse } from "../response";

async function md5hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function extractAction(request: Request): { action: string; isJson: boolean } {
  const target = request.headers.get("x-amz-target") || "";
  if (target.startsWith("AmazonSQS.")) {
    return { action: target.replace("AmazonSQS.", ""), isJson: true };
  }
  return { action: "", isJson: false };
}

export const handle: HandleFn = async (request, _url) => {
  const { action: targetAction, isJson } = extractAction(request);
  const bodyText = await request.text();

  if (isJson) {
    return handleJson(targetAction, bodyText);
  }

  const params = new URLSearchParams(bodyText);
  const action = params.get("Action") || "";
  return handleQuery(action, params);
};

async function handleJson(action: string, bodyText: string): Promise<Response> {
  const body = JSON.parse(bodyText || "{}");

  if (action === "CreateQueue") {
    const queueName = body.QueueName;
    const url = `/mock-api/000000000000/${queueName}`;
    const arn = `arn:aws:sqs:us-east-1:000000000000:${queueName}`;
    await put("sqs-queues", queueName, {
      name: queueName, url, arn, attributes: {},
      createdTimestamp: String(Date.now()),
    });
    return jsonResponse({ QueueUrl: url });
  }

  if (action === "ListQueues") {
    const queues = await getAll("sqs-queues");
    return jsonResponse({ QueueUrls: queues.map((q) => q.url) });
  }

  if (action === "GetQueueUrl") {
    const queue = await get("sqs-queues", body.QueueName);
    if (!queue) {
      return jsonResponse(
        { __type: "AWS.SimpleQueueService.NonExistentQueue", message: "Queue does not exist" },
        400
      );
    }
    return jsonResponse({ QueueUrl: queue.url });
  }

  if (action === "SendMessage") {
    const messageId = crypto.randomUUID();
    const receiptHandle = crypto.randomUUID();
    const md5OfBody = await md5hex(body.MessageBody || "");
    await put("sqs-messages", messageId, {
      queueUrl: body.QueueUrl, messageId, body: body.MessageBody,
      receiptHandle, md5OfBody, sentTimestamp: String(Date.now()),
    });
    return jsonResponse({ MessageId: messageId, MD5OfMessageBody: md5OfBody });
  }

  if (action === "ReceiveMessage") {
    const maxMessages = body.MaxNumberOfMessages || 1;
    const allMessages = await getAll("sqs-messages");
    const messages = allMessages
      .filter((m) => m.queueUrl === body.QueueUrl)
      .slice(0, maxMessages);
    return jsonResponse({
      Messages: messages.map((m) => ({
        MessageId: m.messageId,
        ReceiptHandle: m.receiptHandle,
        MD5OfBody: m.md5OfBody,
        Body: m.body,
      })),
    });
  }

  if (action === "DeleteMessage") {
    const allMessages = await getAll("sqs-messages");
    const message = allMessages.find((m) => m.receiptHandle === body.ReceiptHandle);
    if (message) await del("sqs-messages", message.messageId);
    return jsonResponse({});
  }

  if (action === "DeleteQueue") {
    const allQueues = await getAll("sqs-queues");
    const queue = allQueues.find((q) => q.url === body.QueueUrl);
    if (queue) {
      await del("sqs-queues", queue.name);
      const allMessages = await getAll("sqs-messages");
      for (const msg of allMessages.filter((m) => m.queueUrl === body.QueueUrl)) {
        await del("sqs-messages", msg.messageId);
      }
    }
    return jsonResponse({});
  }

  return new Response(JSON.stringify({ error: `Unknown SQS action: ${action}` }), {
    status: 400, headers: { "Content-Type": "application/json" },
  });
}

async function handleQuery(action: string, params: URLSearchParams): Promise<Response> {
  if (action === "CreateQueue") {
    const queueName = params.get("QueueName")!;
    const url = `/mock-api/000000000000/${queueName}`;
    const arn = `arn:aws:sqs:us-east-1:000000000000:${queueName}`;
    await put("sqs-queues", queueName, {
      name: queueName, url, arn, attributes: {},
      createdTimestamp: String(Date.now()),
    });
    return xmlResponse(
      `<CreateQueueResponse><CreateQueueResult><QueueUrl>${url}</QueueUrl></CreateQueueResult></CreateQueueResponse>`
    );
  }

  if (action === "ListQueues") {
    const queues = await getAll("sqs-queues");
    const queueUrls = queues.map((q) => `<QueueUrl>${q.url}</QueueUrl>`).join("");
    return xmlResponse(
      `<ListQueuesResponse><ListQueuesResult>${queueUrls}</ListQueuesResult></ListQueuesResponse>`
    );
  }

  return new Response("Unknown Action", { status: 400 });
}
