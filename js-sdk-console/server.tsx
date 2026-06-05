import { Hono } from "hono";
import { html, raw } from "hono/html";

import { S3Client, ListBucketsCommand, CreateBucketCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { SQSClient, ListQueuesCommand, CreateQueueCommand, SendMessageCommand, ReceiveMessageCommand, DeleteQueueCommand } from "@aws-sdk/client-sqs";
import { SNSClient, ListTopicsCommand, CreateTopicCommand, PublishCommand } from "@aws-sdk/client-sns";
import { DynamoDBClient, ListTablesCommand, CreateTableCommand, PutItemCommand, GetItemCommand, ScanCommand, QueryCommand, DeleteTableCommand, type ScalarAttributeType } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, ListSecretsCommand, CreateSecretCommand, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, PutParameterCommand, GetParameterCommand, GetParametersByPathCommand, DeleteParameterCommand } from "@aws-sdk/client-ssm";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";

// ─── Types ───

type Field = {
  name: string;
  label: string;
  placeholder?: string;
  default?: string;
  type?: "text" | "textarea" | "number";
};

type Preset = {
  id: string;
  service: string;
  label: string;
  description?: string;
  fields: Field[];
  codeTemplate: string;
  runner: (params: Record<string, string>) => Promise<unknown>;
};

// ─── SDK Clients ───

const FLOCI_ENDPOINT = process.env.FLOCI_ENDPOINT || "http://floci:4566";

const creds = { accessKeyId: "test", secretAccessKey: "test" };
const region = "us-east-1";

const s3 = new S3Client({ region, endpoint: FLOCI_ENDPOINT, credentials: creds, forcePathStyle: true });
const sqs = new SQSClient({ region, endpoint: FLOCI_ENDPOINT, credentials: creds });
const sns = new SNSClient({ region, endpoint: FLOCI_ENDPOINT, credentials: creds });
const ddb = new DynamoDBClient({ region, endpoint: FLOCI_ENDPOINT, credentials: creds });
const sm = new SecretsManagerClient({ region, endpoint: FLOCI_ENDPOINT, credentials: creds });
const ssm = new SSMClient({ region, endpoint: FLOCI_ENDPOINT, credentials: creds });
const athena = new AthenaClient({ region, endpoint: FLOCI_ENDPOINT, credentials: creds });

// ─── Presets ───

const PRESETS: Preset[] = [
  // ── S3 ──
  {
    id: "s3-list-buckets",
    service: "S3",
    label: "List Buckets",
    fields: [],
    codeTemplate: `import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(new ListBucketsCommand({}));
console.log(result.Buckets);`,
    runner: async () => s3.send(new ListBucketsCommand({})),
  },
  {
    id: "s3-create-bucket",
    service: "S3",
    label: "Create Bucket",
    fields: [{ name: "bucket", label: "Bucket name", default: "demo-bucket" }],
    codeTemplate: `import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new CreateBucketCommand({ Bucket: "{bucket}" })
);`,
    runner: async (p) => s3.send(new CreateBucketCommand({ Bucket: p.bucket })),
  },
  {
    id: "s3-put-object",
    service: "S3",
    label: "Put Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
      { name: "body", label: "Body", type: "textarea", default: "Hello from JS SDK console!" },
    ],
    codeTemplate: `import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new PutObjectCommand({
    Bucket: "{bucket}",
    Key: "{key}",
    Body: "{body}",
  })
);`,
    runner: async (p) => s3.send(new PutObjectCommand({ Bucket: p.bucket, Key: p.key, Body: p.body })),
  },
  {
    id: "s3-get-object",
    service: "S3",
    label: "Get Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
    codeTemplate: `import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new GetObjectCommand({ Bucket: "{bucket}", Key: "{key}" })
);
const body = await result.Body.transformToString();`,
    runner: async (p) => {
      const result = await s3.send(new GetObjectCommand({ Bucket: p.bucket, Key: p.key }));
      const bodyText = await result.Body?.transformToString();
      return { ...result, Body: bodyText };
    },
  },
  {
    id: "s3-list-objects",
    service: "S3",
    label: "List Objects",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    codeTemplate: `import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new ListObjectsV2Command({ Bucket: "{bucket}" })
);
console.log(result.Contents);`,
    runner: async (p) => s3.send(new ListObjectsV2Command({ Bucket: p.bucket })),
  },
  {
    id: "s3-delete-object",
    service: "S3",
    label: "Delete Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
    codeTemplate: `import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
await client.send(
  new DeleteObjectCommand({ Bucket: "{bucket}", Key: "{key}" })
);`,
    runner: async (p) => s3.send(new DeleteObjectCommand({ Bucket: p.bucket, Key: p.key })),
  },
  {
    id: "s3-delete-bucket",
    service: "S3",
    label: "Delete Bucket",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    codeTemplate: `import { S3Client, DeleteBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
await client.send(new DeleteBucketCommand({ Bucket: "{bucket}" }));`,
    runner: async (p) => s3.send(new DeleteBucketCommand({ Bucket: p.bucket })),
  },

  // ── SQS ──
  {
    id: "sqs-list-queues",
    service: "SQS",
    label: "List Queues",
    fields: [],
    codeTemplate: `import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(new ListQueuesCommand({}));
console.log(result.QueueUrls);`,
    runner: async () => sqs.send(new ListQueuesCommand({})),
  },
  {
    id: "sqs-create-queue",
    service: "SQS",
    label: "Create Queue",
    fields: [{ name: "name", label: "Queue name", default: "demo-queue" }],
    codeTemplate: `import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(
  new CreateQueueCommand({ QueueName: "{name}" })
);`,
    runner: async (p) => sqs.send(new CreateQueueCommand({ QueueName: p.name })),
  },
  {
    id: "sqs-send-message",
    service: "SQS",
    label: "Send Message",
    fields: [
      { name: "url", label: "Queue URL", default: `${FLOCI_ENDPOINT}/000000000000/demo-queue` },
      { name: "body", label: "Message body", default: "hello" },
    ],
    codeTemplate: `import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(
  new SendMessageCommand({
    QueueUrl: "{url}",
    MessageBody: "{body}",
  })
);`,
    runner: async (p) => sqs.send(new SendMessageCommand({ QueueUrl: p.url, MessageBody: p.body })),
  },
  {
    id: "sqs-receive-message",
    service: "SQS",
    label: "Receive Message",
    fields: [
      { name: "url", label: "Queue URL", default: `${FLOCI_ENDPOINT}/000000000000/demo-queue` },
      { name: "max", label: "Max messages", default: "10", type: "number" },
    ],
    codeTemplate: `import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
const result = await client.send(
  new ReceiveMessageCommand({
    QueueUrl: "{url}",
    MaxNumberOfMessages: {max},
  })
);
console.log(result.Messages);`,
    runner: async (p) => sqs.send(new ReceiveMessageCommand({ QueueUrl: p.url, MaxNumberOfMessages: parseInt(p.max) })),
  },
  {
    id: "sqs-delete-queue",
    service: "SQS",
    label: "Delete Queue",
    fields: [{ name: "url", label: "Queue URL", default: `${FLOCI_ENDPOINT}/000000000000/demo-queue` }],
    codeTemplate: `import { SQSClient, DeleteQueueCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1" });
await client.send(new DeleteQueueCommand({ QueueUrl: "{url}" }));`,
    runner: async (p) => sqs.send(new DeleteQueueCommand({ QueueUrl: p.url })),
  },

  // ── SNS ──
  {
    id: "sns-list-topics",
    service: "SNS",
    label: "List Topics",
    fields: [],
    codeTemplate: `import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({ region: "us-east-1" });
const result = await client.send(new ListTopicsCommand({}));
console.log(result.Topics);`,
    runner: async () => sns.send(new ListTopicsCommand({})),
  },
  {
    id: "sns-create-topic",
    service: "SNS",
    label: "Create Topic",
    fields: [{ name: "name", label: "Topic name", default: "demo-topic" }],
    codeTemplate: `import { SNSClient, CreateTopicCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({ region: "us-east-1" });
const result = await client.send(
  new CreateTopicCommand({ Name: "{name}" })
);`,
    runner: async (p) => sns.send(new CreateTopicCommand({ Name: p.name })),
  },
  {
    id: "sns-publish",
    service: "SNS",
    label: "Publish",
    fields: [
      { name: "arn", label: "Topic ARN", default: "arn:aws:sns:us-east-1:000000000000:demo-topic" },
      { name: "message", label: "Message", default: "hello sns" },
    ],
    codeTemplate: `import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({ region: "us-east-1" });
const result = await client.send(
  new PublishCommand({
    TopicArn: "{arn}",
    Message: "{message}",
  })
);`,
    runner: async (p) => sns.send(new PublishCommand({ TopicArn: p.arn, Message: p.message })),
  },

  // ── DynamoDB ──
  {
    id: "dynamodb-list-tables",
    service: "DynamoDB",
    label: "List Tables",
    fields: [],
    codeTemplate: `import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(new ListTablesCommand({}));
console.log(result.TableNames);`,
    runner: async () => ddb.send(new ListTablesCommand({})),
  },
  {
    id: "dynamodb-create-table",
    service: "DynamoDB",
    label: "Create Table",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "pk", label: "Primary key name", default: "id" },
      { name: "pktype", label: "Primary key type (S/N/B)", default: "S" },
    ],
    codeTemplate: `import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new CreateTableCommand({
    TableName: "{name}",
    KeySchema: [{ AttributeName: "{pk}", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "{pk}", AttributeType: "{pktype}" }],
    BillingMode: "PAY_PER_REQUEST",
  })
);`,
    runner: async (p) =>
      ddb.send(
        new CreateTableCommand({
          TableName: p.name,
          KeySchema: [{ AttributeName: p.pk, KeyType: "HASH" }],
          AttributeDefinitions: [{ AttributeName: p.pk, AttributeType: p.pktype as ScalarAttributeType }],
          BillingMode: "PAY_PER_REQUEST",
        }),
      ),
  },
  {
    id: "dynamodb-put-item",
    service: "DynamoDB",
    label: "Put Item",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "item", label: "Item (JSON)", type: "textarea", default: '{"id":{"S":"item1"},"value":{"S":"hello floci"}}' },
    ],
    codeTemplate: `import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new PutItemCommand({
    TableName: "{name}",
    Item: {item},
  })
);`,
    runner: async (p) => ddb.send(new PutItemCommand({ TableName: p.name, Item: JSON.parse(p.item) })),
  },
  {
    id: "dynamodb-get-item",
    service: "DynamoDB",
    label: "Get Item",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "key", label: "Key (JSON)", default: '{"id":{"S":"item1"}}' },
    ],
    codeTemplate: `import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new GetItemCommand({
    TableName: "{name}",
    Key: {key},
  })
);`,
    runner: async (p) => ddb.send(new GetItemCommand({ TableName: p.name, Key: JSON.parse(p.key) })),
  },
  {
    id: "dynamodb-scan",
    service: "DynamoDB",
    label: "Scan",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
    codeTemplate: `import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new ScanCommand({ TableName: "{name}" })
);
console.log(result.Items);`,
    runner: async (p) => ddb.send(new ScanCommand({ TableName: p.name })),
  },
  {
    id: "dynamodb-query",
    service: "DynamoDB",
    label: "Query",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "expr", label: "Key condition expression", default: "id = :id" },
      { name: "values", label: "Expression attribute values (JSON)", default: '{":id":{"S":"item1"}}' },
    ],
    codeTemplate: `import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new QueryCommand({
    TableName: "{name}",
    KeyConditionExpression: "{expr}",
    ExpressionAttributeValues: {values},
  })
);
console.log(result.Items);`,
    runner: async (p) =>
      ddb.send(
        new QueryCommand({
          TableName: p.name,
          KeyConditionExpression: p.expr,
          ExpressionAttributeValues: JSON.parse(p.values),
        }),
      ),
  },
  {
    id: "dynamodb-delete-table",
    service: "DynamoDB",
    label: "Delete Table",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
    codeTemplate: `import { DynamoDBClient, DeleteTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
await client.send(new DeleteTableCommand({ TableName: "{name}" }));`,
    runner: async (p) => ddb.send(new DeleteTableCommand({ TableName: p.name })),
  },

  // ── Secrets Manager ──
  {
    id: "secretsmanager-list-secrets",
    service: "Secrets Manager",
    label: "List Secrets",
    fields: [],
    codeTemplate: `import { SecretsManagerClient, ListSecretsCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const result = await client.send(new ListSecretsCommand({}));
console.log(result.SecretList);`,
    runner: async () => sm.send(new ListSecretsCommand({})),
  },
  {
    id: "secretsmanager-create-secret",
    service: "Secrets Manager",
    label: "Create Secret",
    fields: [
      { name: "name", label: "Secret name", default: "demo/secret" },
      { name: "value", label: "Secret value (JSON)", default: '{"foo":"bar"}' },
    ],
    codeTemplate: `import { SecretsManagerClient, CreateSecretCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const result = await client.send(
  new CreateSecretCommand({
    Name: "{name}",
    SecretString: '{value}',
  })
);`,
    runner: async (p) => sm.send(new CreateSecretCommand({ Name: p.name, SecretString: p.value })),
  },
  {
    id: "secretsmanager-get-secret-value",
    service: "Secrets Manager",
    label: "Get Secret Value",
    fields: [{ name: "name", label: "Secret name", default: "demo/secret" }],
    codeTemplate: `import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const result = await client.send(
  new GetSecretValueCommand({ SecretId: "{name}" })
);
console.log(result.SecretString);`,
    runner: async (p) => sm.send(new GetSecretValueCommand({ SecretId: p.name })),
  },

  // ── SSM ──
  {
    id: "ssm-put-parameter",
    service: "SSM",
    label: "Put Parameter",
    fields: [
      { name: "name", label: "Parameter name", default: "/demo/foo" },
      { name: "value", label: "Parameter value", default: "bar" },
    ],
    codeTemplate: `import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const result = await client.send(
  new PutParameterCommand({
    Name: "{name}",
    Value: "{value}",
    Type: "String",
    Overwrite: true,
  })
);`,
    runner: async (p) =>
      ssm.send(new PutParameterCommand({ Name: p.name, Value: p.value, Type: "String", Overwrite: true })),
  },
  {
    id: "ssm-get-parameter",
    service: "SSM",
    label: "Get Parameter",
    fields: [{ name: "name", label: "Parameter name", default: "/demo/foo" }],
    codeTemplate: `import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const result = await client.send(
  new GetParameterCommand({ Name: "{name}" })
);
console.log(result.Parameter);`,
    runner: async (p) => ssm.send(new GetParameterCommand({ Name: p.name })),
  },
  {
    id: "ssm-get-parameters-by-path",
    service: "SSM",
    label: "Get Parameters by Path",
    fields: [{ name: "path", label: "Path", default: "/" }],
    codeTemplate: `import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const result = await client.send(
  new GetParametersByPathCommand({
    Path: "{path}",
    Recursive: true,
  })
);
console.log(result.Parameters);`,
    runner: async (p) =>
      ssm.send(new GetParametersByPathCommand({ Path: p.path, Recursive: true })),
  },
  {
    id: "ssm-delete-parameter",
    service: "SSM",
    label: "Delete Parameter",
    fields: [{ name: "name", label: "Parameter name", default: "/demo/foo" }],
    codeTemplate: `import { SSMClient, DeleteParameterCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
await client.send(new DeleteParameterCommand({ Name: "{name}" }));`,
    runner: async (p) => ssm.send(new DeleteParameterCommand({ Name: p.name })),
  },

  // ── Athena ──
  {
    id: "athena-start-query-execution",
    service: "Athena",
    label: "Start Query Execution",
    fields: [
      { name: "query", label: "Query", type: "textarea", default: "SELECT 1" },
      { name: "output", label: "Output location", default: "s3://athena-results/" },
      { name: "database", label: "Database", default: "default" },
    ],
    codeTemplate: `import { AthenaClient, StartQueryExecutionCommand } from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: "us-east-1" });
const result = await client.send(
  new StartQueryExecutionCommand({
    QueryString: "{query}",
    ResultConfiguration: {
      OutputLocation: "{output}",
    },
    QueryExecutionContext: {
      Database: "{database}",
    },
  })
);
console.log(result.QueryExecutionId);`,
    runner: async (p) =>
      athena.send(
        new StartQueryExecutionCommand({
          QueryString: p.query,
          ResultConfiguration: { OutputLocation: p.output },
          QueryExecutionContext: { Database: p.database },
        }),
      ),
  },
  {
    id: "athena-get-query-execution",
    service: "Athena",
    label: "Get Query Execution",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
    codeTemplate: `import { AthenaClient, GetQueryExecutionCommand } from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: "us-east-1" });
const result = await client.send(
  new GetQueryExecutionCommand({ QueryExecutionId: "{id}" })
);
console.log(result.QueryExecution);`,
    runner: async (p) => athena.send(new GetQueryExecutionCommand({ QueryExecutionId: p.id })),
  },
  {
    id: "athena-get-query-results",
    service: "Athena",
    label: "Get Query Results",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
    codeTemplate: `import { AthenaClient, GetQueryResultsCommand } from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: "us-east-1" });
const result = await client.send(
  new GetQueryResultsCommand({ QueryExecutionId: "{id}" })
);
console.log(result.ResultSet);`,
    runner: async (p) => athena.send(new GetQueryResultsCommand({ QueryExecutionId: p.id })),
  },
];

// ─── Service list ───

const SERVICES = Array.from(new Set(PRESETS.map((p) => p.service)));

// ─── Helpers ───

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanResult(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanResult);
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "$metadata") continue;
    cleaned[k] = cleanResult(v);
  }
  return cleaned;
}

function expandCode(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
}

// ─── Hono App ───

const app = new Hono();

app.get("/", (c) => c.html(renderPage()));

app.post("/run", async (c) => {
  const body = await c.req.parseBody();
  const presetId = String(body._preset || "");
  const preset = PRESETS.find((p) => p.id === presetId);

  if (!preset) {
    return c.html(renderHistoryEntry({
      label: "?",
      code: "(unknown preset)",
      output: null,
      error: `unknown preset: ${presetId}`,
      durationMs: 0,
    }));
  }

  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith("_")) continue;
    values[k] = String(v);
  }
  for (const field of preset.fields) {
    if (!(field.name in values)) values[field.name] = field.default ?? "";
  }

  const codePreview = expandCode(preset.codeTemplate, values);
  const label = `${preset.service} / ${preset.label}`;
  const start = Date.now();

  try {
    const result = await preset.runner(values);
    const durationMs = Date.now() - start;
    return c.html(renderHistoryEntry({
      label,
      code: codePreview,
      output: JSON.stringify(cleanResult(result), null, 2),
      error: null,
      durationMs,
    }));
  } catch (err) {
    const durationMs = Date.now() - start;
    return c.html(renderHistoryEntry({
      label,
      code: codePreview,
      output: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    }));
  }
});

// ─── Rendering ───

function renderHistoryEntry(entry: {
  label: string;
  code: string;
  output: string | null;
  error: string | null;
  durationMs: number;
}) {
  const ok = entry.error === null;
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  return html`
    <article class="rounded-lg border ${ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"} p-4 mb-3">
      <header class="flex flex-wrap items-center gap-2 mb-2">
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}">
          ${ok ? "OK" : "Error"}
        </span>
        <span class="font-semibold text-zinc-100">${entry.label}</span>
        <span class="text-xs text-zinc-500 ml-auto">${time} · ${entry.durationMs}ms</span>
      </header>
      <pre class="text-xs text-amber-200/80 bg-zinc-950 border border-zinc-700 rounded p-2 overflow-x-auto whitespace-pre mb-2">${escapeHtml(entry.code)}</pre>
      ${entry.output
        ? html`<pre class="text-sm text-zinc-100 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">${entry.output}</pre>`
        : ""}
      ${entry.error
        ? html`<pre class="text-sm text-rose-300 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all mt-2">${escapeHtml(entry.error)}</pre>`
        : ""}
    </article>
  `;
}

function renderPresetCard(p: Preset) {
  const initialValues = JSON.stringify(
    Object.fromEntries(p.fields.map((f) => [f.name, f.default ?? ""])),
  );
  return html`
    <form
      x-show="selected==='${p.id}'"
      x-cloak
      x-data='{ template: ${JSON.stringify(p.codeTemplate)}, values: ${initialValues} }'
      class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-3 h-full"
      hx-post="/run"
      hx-target="#history"
      hx-swap="afterbegin"
      hx-indicator="find .htmx-loader"
    >
      <input type="hidden" name="_preset" value="${p.id}" />
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 tracking-wide uppercase">${p.service}</span>
          <h3 class="text-base font-semibold text-zinc-100">${p.label}</h3>
        </div>
        <p class="text-xs text-zinc-500 mt-1 min-h-[1.25rem]">${p.description ?? raw("&nbsp;")}</p>
      </div>
      ${p.fields.length > 0
        ? html`<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${raw(
              p.fields
                .map((f) => {
                  const id = `${p.id}_${f.name}`;
                  const common = `id="${id}" name="${f.name}" x-model="values.${f.name}" class="w-full rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"`;
                  const wrapperCls =
                    f.type === "textarea"
                      ? "flex flex-col gap-1 text-xs text-zinc-400 md:col-span-2"
                      : "flex flex-col gap-1 text-xs text-zinc-400";
                  const input =
                    f.type === "textarea"
                      ? `<textarea ${common} rows="2" placeholder="${f.placeholder ?? ""}"></textarea>`
                      : `<input ${common} type="${f.type ?? "text"}" placeholder="${f.placeholder ?? ""}" />`;
                  return `<label class="${wrapperCls}"><span>${f.label}</span>${input}</label>`;
                })
                .join(""),
            )}
          </div>`
        : ""}
      <div class="mt-auto space-y-3">
        <div>
          <p class="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Code preview</p>
          <pre class="text-xs text-amber-200/80 bg-zinc-950 border border-zinc-700 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all" x-text="buildPreview(template, values)"></pre>
        </div>
        <div class="flex items-center gap-3 justify-end">
          <span class="htmx-loader text-xs text-zinc-500 htmx-indicator">running…</span>
          <button
            type="submit"
            class="rounded bg-amber-500 hover:bg-amber-400 text-zinc-900 text-sm font-semibold px-4 py-1.5 transition"
          >Run</button>
        </div>
      </div>
    </form>
  `;
}

function renderPage() {
  const firstOfService: Record<string, string> = {};
  for (const s of SERVICES) {
    firstOfService[s] = PRESETS.find((p) => p.service === s)!.id;
  }
  const defaultTab = SERVICES[0];
  const defaultSelected = firstOfService[defaultTab];

  const sidebarSections = SERVICES.map(
    (s) => html`
      <div x-show="tab==='${s}'" x-cloak class="flex flex-col">
        ${raw(
          PRESETS.filter((p) => p.service === s)
            .map(
              (p) =>
                `<button type="button" @click="selected='${p.id}'" :class="selected==='${p.id}' ? 'bg-amber-500/10 text-amber-300 border-l-2 border-amber-400' : 'border-l-2 border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'" class="w-full text-left px-3 py-1.5 text-sm rounded-r transition">${p.label}</button>`,
            )
            .join(""),
        )}
      </div>
    `,
  );

  const tabButtons = SERVICES.map(
    (s) => html`
      <button
        type="button"
        @click="tab='${s}'"
        :class="tab==='${s}' ? 'border-amber-400 text-amber-300' : 'border-transparent text-zinc-400 hover:text-amber-200'"
        class="px-4 py-2 border-b-2 text-sm font-medium transition whitespace-nowrap"
      >${s}</button>
    `,
  );

  const cards = PRESETS.map((p) => renderPresetCard(p));

  return html`<!DOCTYPE html>
<html lang="ja" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Floci JS SDK Console</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script src="https://unpkg.com/htmx.org@2.0.3" defer></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <style>
      body { opacity: 0; }
      body.ready { opacity: 1; transition: opacity 80ms; }
      [x-cloak] { display: none !important; }
      .htmx-indicator { opacity: 0; transition: opacity 200ms; }
      .htmx-request .htmx-indicator { opacity: 1; }
      #history:has(article) > .empty-placeholder { display: none; }
    </style>
    <script>
      function buildPreview(template, values) {
        return template.replace(/\{(\w+)\}/g, (match, name) => {
          const val = values[name];
          if (val === undefined || val === '') return match;
          return val;
        });
      }
    </script>
  </head>
  <body
    class="bg-zinc-900 text-zinc-100 min-h-screen"
    x-data='{ tab: ${JSON.stringify(defaultTab)}, selected: ${JSON.stringify(defaultSelected)}, firstOf: ${JSON.stringify(firstOfService)} }'
    x-init="$watch('tab', t => selected = firstOf[t])"
  >
    <header class="border-b border-zinc-700 px-6 py-3 flex items-center gap-4">
      <h1 class="text-base font-bold">
        <span class="text-zinc-300">Floci</span> JS SDK Console
      </h1>
      <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300">JS SDK</span>
      <span class="text-xs text-zinc-500 font-mono">${FLOCI_ENDPOINT}</span>
      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>Console:</span>
          <select
            onchange="window.location.href=this.value"
            class="text-xs bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            <option value="http://localhost:8000">CLI Console</option>
            <option value="http://localhost:8001">Ruby SDK Console</option>
            <option value="http://localhost:8002" selected>JS SDK Console</option>
          </select>
        </label>
        <button
          type="button"
          @click="$dispatch('clear-history')"
          class="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-700 hover:border-zinc-600"
        >Clear history</button>
      </div>
    </header>

    <nav role="tablist" class="px-6 border-b border-zinc-700 flex gap-1 overflow-x-auto">
      ${raw(tabButtons.map((t) => t.toString()).join(""))}
    </nav>

    <main class="max-w-[1600px] mx-auto px-6 pt-4 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      <aside class="self-start overflow-y-auto max-h-[340px] lg:max-h-[360px]">
        ${raw(sidebarSections.map((s) => s.toString()).join(""))}
      </aside>

      <section class="h-[360px]">
        ${raw(cards.map((c) => c.toString()).join(""))}
      </section>
    </main>

    <section class="max-w-[1600px] mx-auto px-6 pb-10 pt-6">
      <div class="border-t border-zinc-700 pt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-zinc-300">History</h2>
          <span class="text-xs text-zinc-600">最新が上</span>
        </div>
        <div
          id="history"
          class="space-y-3"
          @clear-history.window="$el.innerHTML = ''"
        >
          <p class="empty-placeholder text-xs text-zinc-600 italic">まだ実行履歴がありません。コマンドを選んで Run を押してください。</p>
        </div>
      </div>
    </section>
    <script>requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('ready')))</script>
  </body>
</html>`;
}

// ─── Start ───

const port = process.env.PORT || 8002;

export default {
  port,
  fetch: app.fetch,
};

console.log(`JS SDK Console listening on http://0.0.0.0:${port}`);
console.log(`Floci endpoint: ${FLOCI_ENDPOINT}`);
