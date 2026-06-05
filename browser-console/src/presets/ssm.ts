import {
  SSMClient,
  PutParameterCommand,
  GetParameterCommand,
  GetParametersByPathCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm";
import type { Preset } from "../types";

const client = new SSMClient({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

export const ssmPresets: Preset[] = [
  {
    id: "ssm-put-parameter",
    service: "SSM",
    label: "Put Parameter",
    fields: [
      { name: "name", label: "Parameter name", default: "/demo/foo" },
      { name: "value", label: "Parameter value", default: "bar" },
    ],
    code: (p) =>
`import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const result = await client.send(
  new PutParameterCommand({
    Name: "${p.name}",
    Value: "${p.value}",
    Type: "String",
    Overwrite: true,
  })
);`,
    run: async (p) =>
      client.send(
        new PutParameterCommand({
          Name: p.name,
          Value: p.value,
          Type: "String",
          Overwrite: true,
        })
      ),
  },
  {
    id: "ssm-get-parameter",
    service: "SSM",
    label: "Get Parameter",
    fields: [{ name: "name", label: "Parameter name", default: "/demo/foo" }],
    code: (p) =>
`import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const result = await client.send(
  new GetParameterCommand({ Name: "${p.name}" })
);
console.log(result.Parameter);`,
    run: async (p) => client.send(new GetParameterCommand({ Name: p.name })),
  },
  {
    id: "ssm-get-parameters-by-path",
    service: "SSM",
    label: "Get Parameters by Path",
    fields: [{ name: "path", label: "Path", default: "/" }],
    code: (p) =>
`import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
const result = await client.send(
  new GetParametersByPathCommand({
    Path: "${p.path}",
    Recursive: true,
  })
);
console.log(result.Parameters);`,
    run: async (p) =>
      client.send(
        new GetParametersByPathCommand({
          Path: p.path,
          Recursive: true,
        })
      ),
  },
  {
    id: "ssm-delete-parameter",
    service: "SSM",
    label: "Delete Parameter",
    fields: [{ name: "name", label: "Parameter name", default: "/demo/foo" }],
    code: (p) =>
`import { SSMClient, DeleteParameterCommand } from "@aws-sdk/client-ssm";

const client = new SSMClient({ region: "us-east-1" });
await client.send(new DeleteParameterCommand({ Name: "${p.name}" }));`,
    run: async (p) => client.send(new DeleteParameterCommand({ Name: p.name })),
  },
];
