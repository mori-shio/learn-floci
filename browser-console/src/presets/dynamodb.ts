import {
  DynamoDBClient,
  ListTablesCommand,
  CreateTableCommand,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  QueryCommand,
  DeleteTableCommand,
  type ScalarAttributeType,
} from "@aws-sdk/client-dynamodb";
import type { Preset } from "../types";

const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

export const dynamodbPresets: Preset[] = [
  {
    id: "dynamodb-list-tables",
    service: "DynamoDB",
    label: "List Tables",
    fields: [],
    code: () =>
`import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(new ListTablesCommand({}));
console.log(result.TableNames);`,
    run: async () => client.send(new ListTablesCommand({})),
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
    code: (p) =>
`import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new CreateTableCommand({
    TableName: "${p.name}",
    KeySchema: [{ AttributeName: "${p.pk}", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "${p.pk}", AttributeType: "${p.pktype}" }],
    BillingMode: "PAY_PER_REQUEST",
  })
);`,
    run: async (p) =>
      client.send(
        new CreateTableCommand({
          TableName: p.name,
          KeySchema: [{ AttributeName: p.pk, KeyType: "HASH" }],
          AttributeDefinitions: [{ AttributeName: p.pk, AttributeType: p.pktype as ScalarAttributeType }],
          BillingMode: "PAY_PER_REQUEST",
        })
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
    code: (p) =>
`import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new PutItemCommand({
    TableName: "${p.name}",
    Item: ${p.item},
  })
);`,
    run: async (p) =>
      client.send(
        new PutItemCommand({
          TableName: p.name,
          Item: JSON.parse(p.item),
        })
      ),
  },
  {
    id: "dynamodb-get-item",
    service: "DynamoDB",
    label: "Get Item",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "key", label: "Key (JSON)", default: '{"id":{"S":"item1"}}' },
    ],
    code: (p) =>
`import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new GetItemCommand({
    TableName: "${p.name}",
    Key: ${p.key},
  })
);`,
    run: async (p) =>
      client.send(
        new GetItemCommand({
          TableName: p.name,
          Key: JSON.parse(p.key),
        })
      ),
  },
  {
    id: "dynamodb-scan",
    service: "DynamoDB",
    label: "Scan",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
    code: (p) =>
`import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new ScanCommand({ TableName: "${p.name}" })
);
console.log(result.Items);`,
    run: async (p) => client.send(new ScanCommand({ TableName: p.name })),
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
    code: (p) =>
`import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const result = await client.send(
  new QueryCommand({
    TableName: "${p.name}",
    KeyConditionExpression: "${p.expr}",
    ExpressionAttributeValues: ${p.values},
  })
);
console.log(result.Items);`,
    run: async (p) =>
      client.send(
        new QueryCommand({
          TableName: p.name,
          KeyConditionExpression: p.expr,
          ExpressionAttributeValues: JSON.parse(p.values),
        })
      ),
  },
  {
    id: "dynamodb-delete-table",
    service: "DynamoDB",
    label: "Delete Table",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
    code: (p) =>
`import { DynamoDBClient, DeleteTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
await client.send(new DeleteTableCommand({ TableName: "${p.name}" }));`,
    run: async (p) => client.send(new DeleteTableCommand({ TableName: p.name })),
  },
];
