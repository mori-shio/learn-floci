import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import type { Preset } from "../types";

const client = new S3Client({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  forcePathStyle: true,
});

export const s3Presets: Preset[] = [
  {
    id: "s3-list-buckets",
    service: "S3",
    label: "List Buckets",
    fields: [],
    code: () =>
`import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(new ListBucketsCommand({}));
console.log(result.Buckets);`,
    run: async () => client.send(new ListBucketsCommand({})),
  },
  {
    id: "s3-create-bucket",
    service: "S3",
    label: "Create Bucket",
    fields: [{ name: "bucket", label: "Bucket name", default: "demo-bucket" }],
    code: (p) =>
`import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new CreateBucketCommand({ Bucket: "${p.bucket}" })
);`,
    run: async (p) => client.send(new CreateBucketCommand({ Bucket: p.bucket })),
  },
  {
    id: "s3-put-object",
    service: "S3",
    label: "Put Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
      { name: "body", label: "Body", type: "textarea", default: "Hello from browser console!" },
    ],
    code: (p) =>
`import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new PutObjectCommand({
    Bucket: "${p.bucket}",
    Key: "${p.key}",
    Body: "${p.body}",
  })
);`,
    run: async (p) => client.send(new PutObjectCommand({ Bucket: p.bucket, Key: p.key, Body: p.body })),
  },
  {
    id: "s3-get-object",
    service: "S3",
    label: "Get Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
    code: (p) =>
`import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new GetObjectCommand({ Bucket: "${p.bucket}", Key: "${p.key}" })
);
const body = await result.Body.transformToString();`,
    run: async (p) => {
      const result = await client.send(new GetObjectCommand({ Bucket: p.bucket, Key: p.key }));
      const body = await result.Body?.transformToString();
      return { ...result, BodyText: body };
    },
  },
  {
    id: "s3-list-objects",
    service: "S3",
    label: "List Objects",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    code: (p) =>
`import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new ListObjectsV2Command({ Bucket: "${p.bucket}" })
);
console.log(result.Contents);`,
    run: async (p) => client.send(new ListObjectsV2Command({ Bucket: p.bucket })),
  },
  {
    id: "s3-delete-object",
    service: "S3",
    label: "Delete Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
    code: (p) =>
`import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
await client.send(
  new DeleteObjectCommand({ Bucket: "${p.bucket}", Key: "${p.key}" })
);`,
    run: async (p) => client.send(new DeleteObjectCommand({ Bucket: p.bucket, Key: p.key })),
  },
  {
    id: "s3-delete-bucket",
    service: "S3",
    label: "Delete Bucket",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    code: (p) =>
`import { S3Client, DeleteBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
await client.send(new DeleteBucketCommand({ Bucket: "${p.bucket}" }));`,
    run: async (p) => client.send(new DeleteBucketCommand({ Bucket: p.bucket })),
  },
];
