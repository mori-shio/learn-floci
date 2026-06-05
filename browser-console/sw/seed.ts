import { put, getAll } from "./store";

export async function seedInitialData(): Promise<void> {
  const existing = await getAll("s3-buckets");
  if (existing.length > 0) return;

  const now = new Date().toISOString();

  await put("s3-buckets", "floci-test-bucket", {
    name: "floci-test-bucket",
    creationDate: now,
  });
  await put("s3-buckets", "athena-results", {
    name: "athena-results",
    creationDate: now,
  });

  const queueUrl = "/mock-api/000000000000/floci-test-queue";
  await put("sqs-queues", "floci-test-queue", {
    name: "floci-test-queue",
    url: queueUrl,
    arn: "arn:aws:sqs:us-east-1:000000000000:floci-test-queue",
    attributes: {},
    createdTimestamp: String(Date.now()),
  });

  await put("sns-topics", "floci-test-topic", {
    name: "floci-test-topic",
    arn: "arn:aws:sns:us-east-1:000000000000:floci-test-topic",
  });

  await put("secrets", "floci-test/rails-secret", {
    name: "floci-test/rails-secret",
    arn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:floci-test/rails-secret-AbCdEf",
    secretString: '{"secret_key_base":"dummy-secret-key-for-local-dev"}',
    versionId: "00000000-0000-0000-0000-000000000001",
    createdDate: Date.now(),
  });

  await put("ssm-parameters", "/floci-test/app/environment", {
    name: "/floci-test/app/environment",
    type: "String",
    value: "development",
    version: 1,
    lastModifiedDate: Date.now(),
  });

  await put("dynamodb-tables", "floci-test-items", {
    tableName: "floci-test-items",
    keySchema: [{ attributeName: "id", keyType: "HASH" }],
    attributeDefinitions: [{ attributeName: "id", attributeType: "S" }],
    billingMode: "PAY_PER_REQUEST",
    tableStatus: "ACTIVE",
    creationDateTime: Date.now(),
    itemCount: 1,
  });

  await put("dynamodb-items", "floci-test-items::id::item1", {
    tableName: "floci-test-items",
    item: { id: { S: "item1" }, value: { S: "hello from floci" } },
  });
}
