import {
  SNSClient,
  ListTopicsCommand,
  CreateTopicCommand,
  PublishCommand,
} from "@aws-sdk/client-sns";
import type { Preset } from "../types";

const client = new SNSClient({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

export const snsPresets: Preset[] = [
  {
    id: "sns-list-topics",
    service: "SNS",
    label: "List Topics",
    fields: [],
    code: () =>
`import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({ region: "us-east-1" });
const result = await client.send(new ListTopicsCommand({}));
console.log(result.Topics);`,
    run: async () => client.send(new ListTopicsCommand({})),
  },
  {
    id: "sns-create-topic",
    service: "SNS",
    label: "Create Topic",
    fields: [{ name: "name", label: "Topic name", default: "demo-topic" }],
    code: (p) =>
`import { SNSClient, CreateTopicCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({ region: "us-east-1" });
const result = await client.send(
  new CreateTopicCommand({ Name: "${p.name}" })
);`,
    run: async (p) => client.send(new CreateTopicCommand({ Name: p.name })),
  },
  {
    id: "sns-publish",
    service: "SNS",
    label: "Publish",
    fields: [
      { name: "arn", label: "Topic ARN", default: "arn:aws:sns:us-east-1:000000000000:demo-topic" },
      { name: "message", label: "Message", default: "hello sns" },
    ],
    code: (p) =>
`import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({ region: "us-east-1" });
const result = await client.send(
  new PublishCommand({
    TopicArn: "${p.arn}",
    Message: "${p.message}",
  })
);`,
    run: async (p) => client.send(new PublishCommand({ TopicArn: p.arn, Message: p.message })),
  },
];
