import {
  SecretsManagerClient,
  ListSecretsCommand,
  CreateSecretCommand,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import type { Preset } from "../types";

const client = new SecretsManagerClient({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

export const secretsManagerPresets: Preset[] = [
  {
    id: "secretsmanager-list-secrets",
    service: "Secrets Manager",
    label: "List Secrets",
    fields: [],
    code: () =>
`import { SecretsManagerClient, ListSecretsCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const result = await client.send(new ListSecretsCommand({}));
console.log(result.SecretList);`,
    run: async () => client.send(new ListSecretsCommand({})),
  },
  {
    id: "secretsmanager-create-secret",
    service: "Secrets Manager",
    label: "Create Secret",
    fields: [
      { name: "name", label: "Secret name", default: "demo/secret" },
      { name: "value", label: "Secret value (JSON)", default: '{"foo":"bar"}' },
    ],
    code: (p) =>
`import { SecretsManagerClient, CreateSecretCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const result = await client.send(
  new CreateSecretCommand({
    Name: "${p.name}",
    SecretString: '${p.value}',
  })
);`,
    run: async (p) =>
      client.send(
        new CreateSecretCommand({
          Name: p.name,
          SecretString: p.value,
        })
      ),
  },
  {
    id: "secretsmanager-get-secret-value",
    service: "Secrets Manager",
    label: "Get Secret Value",
    fields: [{ name: "name", label: "Secret name", default: "demo/secret" }],
    code: (p) =>
`import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const result = await client.send(
  new GetSecretValueCommand({ SecretId: "${p.name}" })
);
console.log(result.SecretString);`,
    run: async (p) => client.send(new GetSecretValueCommand({ SecretId: p.name })),
  },
];
