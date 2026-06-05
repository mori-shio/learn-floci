import {
  SQSClient,
  ListQueuesCommand,
  CreateQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-sqs";
import type { Preset } from "../types";

const client = new SQSClient({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

export const sqsPresets: Preset[] = [
  {
    id: "sqs-list-queues",
    service: "SQS",
    label: "List Queues",
    fields: [],
    code: () =>
`import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(new ListQueuesCommand({}));
console.log(result.QueueUrls);`,
    run: async () => client.send(new ListQueuesCommand({})),
  },
  {
    id: "sqs-create-queue",
    service: "SQS",
    label: "Create Queue",
    fields: [{ name: "name", label: "Queue name", default: "demo-queue" }],
    code: (p) =>
`import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(
  new CreateQueueCommand({ QueueName: "${p.name}" })
);`,
    run: async (p) => client.send(new CreateQueueCommand({ QueueName: p.name })),
  },
  {
    id: "sqs-send-message",
    service: "SQS",
    label: "Send Message",
    fields: [
      { name: "url", label: "Queue URL", default: "/mock-api/000000000000/demo-queue" },
      { name: "body", label: "Message body", default: "hello" },
    ],
    code: (p) =>
`import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(
  new SendMessageCommand({
    QueueUrl: "${p.url}",
    MessageBody: "${p.body}",
  })
);`,
    run: async (p) => client.send(new SendMessageCommand({ QueueUrl: p.url, MessageBody: p.body })),
  },
  {
    id: "sqs-receive-message",
    service: "SQS",
    label: "Receive Message",
    fields: [
      { name: "url", label: "Queue URL", default: "/mock-api/000000000000/demo-queue" },
      { name: "max", label: "Max messages", default: "10", type: "number" },
    ],
    code: (p) =>
`import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(
  new ReceiveMessageCommand({
    QueueUrl: "${p.url}",
    MaxNumberOfMessages: ${p.max},
  })
);
console.log(result.Messages);`,
    run: async (p) => client.send(new ReceiveMessageCommand({ QueueUrl: p.url, MaxNumberOfMessages: parseInt(p.max) })),
  },
  {
    id: "sqs-delete-queue",
    service: "SQS",
    label: "Delete Queue",
    fields: [{ name: "url", label: "Queue URL", default: "/mock-api/000000000000/demo-queue" }],
    code: (p) =>
`import { SQSClient, DeleteQueueCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
await client.send(new DeleteQueueCommand({ QueueUrl: "${p.url}" }));`,
    run: async (p) => client.send(new DeleteQueueCommand({ QueueUrl: p.url })),
  },
];
