import { Hono } from "hono";
import { html, raw } from "hono/html";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
  template: string;
  fields: Field[];
};

const PRESETS: Preset[] = [
  // ─── S3 ───
  {
    id: "s3-list-buckets",
    service: "S3",
    label: "List buckets",
    template: "s3 ls",
    fields: [],
  },
  {
    id: "s3-mb",
    service: "S3",
    label: "Create bucket",
    template: "s3 mb s3://{bucket}",
    fields: [{ name: "bucket", label: "Bucket name", default: "demo-bucket" }],
  },
  {
    id: "s3-put",
    service: "S3",
    label: "Put object",
    description: "Body はテキスト一時ファイルに書き出されて --body file://… で渡されます",
    template: "s3api put-object --bucket {bucket} --key {key} --body @{body}",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
      { name: "body", label: "Body (text)", type: "textarea", default: "Hello from cli-console!" },
    ],
  },
  {
    id: "s3-ls",
    service: "S3",
    label: "List objects",
    template: "s3 ls s3://{bucket}/",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
  },
  {
    id: "s3-get",
    service: "S3",
    label: "Get object (content)",
    description: "オブジェクトの中身を stdout に出力",
    template: "s3 cp s3://{bucket}/{key} -",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
  },
  {
    id: "s3-head",
    service: "S3",
    label: "Head object (metadata)",
    template: "s3api head-object --bucket {bucket} --key {key}",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
  },
  {
    id: "s3-rm",
    service: "S3",
    label: "Delete object",
    template: "s3api delete-object --bucket {bucket} --key {key}",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
  },
  {
    id: "s3-rb",
    service: "S3",
    label: "Delete bucket",
    template: "s3 rb s3://{bucket} --force",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
  },

  // ─── SQS ───
  {
    id: "sqs-list",
    service: "SQS",
    label: "List queues",
    template: "sqs list-queues",
    fields: [],
  },
  {
    id: "sqs-create",
    service: "SQS",
    label: "Create queue",
    template: "sqs create-queue --queue-name {name}",
    fields: [{ name: "name", label: "Queue name", default: "demo-queue" }],
  },
  {
    id: "sqs-send",
    service: "SQS",
    label: "Send message",
    template: "sqs send-message --queue-url {url} --message-body {body}",
    fields: [
      { name: "url", label: "Queue URL", default: "http://floci:4566/000000000000/demo-queue" },
      { name: "body", label: "Message body", default: "hello" },
    ],
  },
  {
    id: "sqs-receive",
    service: "SQS",
    label: "Receive message",
    template:
      "sqs receive-message --queue-url {url} --max-number-of-messages {max} --wait-time-seconds 1",
    fields: [
      { name: "url", label: "Queue URL", default: "http://floci:4566/000000000000/demo-queue" },
      { name: "max", label: "Max messages", default: "10", type: "number" },
    ],
  },
  {
    id: "sqs-delete-queue",
    service: "SQS",
    label: "Delete queue",
    template: "sqs delete-queue --queue-url {url}",
    fields: [
      { name: "url", label: "Queue URL", default: "http://floci:4566/000000000000/demo-queue" },
    ],
  },

  // ─── SNS ───
  {
    id: "sns-list",
    service: "SNS",
    label: "List topics",
    template: "sns list-topics",
    fields: [],
  },
  {
    id: "sns-create",
    service: "SNS",
    label: "Create topic",
    template: "sns create-topic --name {name}",
    fields: [{ name: "name", label: "Topic name", default: "demo-topic" }],
  },
  {
    id: "sns-publish",
    service: "SNS",
    label: "Publish message",
    template: "sns publish --topic-arn {arn} --message {message}",
    fields: [
      {
        name: "arn",
        label: "Topic ARN",
        default: "arn:aws:sns:us-east-1:000000000000:demo-topic",
      },
      { name: "message", label: "Message", default: "hello sns" },
    ],
  },

  // ─── Secrets Manager ───
  {
    id: "sm-list",
    service: "Secrets",
    label: "List secrets",
    template: "secretsmanager list-secrets",
    fields: [],
  },
  {
    id: "sm-create",
    service: "Secrets",
    label: "Create secret",
    template: "secretsmanager create-secret --name {name} --secret-string {value}",
    fields: [
      { name: "name", label: "Name", default: "demo/secret" },
      { name: "value", label: "Secret string", default: '{"foo":"bar"}' },
    ],
  },
  {
    id: "sm-get",
    service: "Secrets",
    label: "Get secret value",
    template: "secretsmanager get-secret-value --secret-id {name}",
    fields: [{ name: "name", label: "Secret ID/Name", default: "demo/secret" }],
  },

  // ─── SSM Parameter Store ───
  {
    id: "ssm-put",
    service: "SSM",
    label: "Put parameter",
    template: "ssm put-parameter --name {name} --value {value} --type String --overwrite",
    fields: [
      { name: "name", label: "Parameter name", default: "/demo/foo" },
      { name: "value", label: "Value", default: "bar" },
    ],
  },
  {
    id: "ssm-get",
    service: "SSM",
    label: "Get parameter",
    template: "ssm get-parameter --name {name}",
    fields: [{ name: "name", label: "Parameter name", default: "/demo/foo" }],
  },
  {
    id: "ssm-list",
    service: "SSM",
    label: "Get parameters by path",
    template: "ssm get-parameters-by-path --path {path} --recursive",
    fields: [{ name: "path", label: "Path", default: "/" }],
  },
  {
    id: "ssm-delete",
    service: "SSM",
    label: "Delete parameter",
    template: "ssm delete-parameter --name {name}",
    fields: [{ name: "name", label: "Parameter name", default: "/demo/foo" }],
  },

  // ─── RDS ───
  {
    id: "rds-describe",
    service: "RDS",
    label: "Describe DB instances",
    template: "rds describe-db-instances",
    fields: [],
  },
  {
    id: "rds-create",
    service: "RDS",
    label: "Create DB instance (postgres)",
    description: "PostgreSQL コンテナの起動に20〜40秒かかります",
    template:
      "rds create-db-instance --db-instance-identifier {id} --db-instance-class db.t3.micro --engine postgres --master-username postgres --master-user-password password --db-name {db}",
    fields: [
      { name: "id", label: "Instance identifier", default: "demo-db" },
      { name: "db", label: "Initial DB name", default: "demo" },
    ],
  },
  {
    id: "rds-delete",
    service: "RDS",
    label: "Delete DB instance",
    template:
      "rds delete-db-instance --db-instance-identifier {id} --skip-final-snapshot",
    fields: [{ name: "id", label: "Instance identifier", default: "demo-db" }],
  },

  // ─── Lambda ───
  {
    id: "lambda-list",
    service: "Lambda",
    label: "List functions",
    template: "lambda list-functions",
    fields: [],
  },
  {
    id: "lambda-create-node",
    service: "Lambda",
    label: "Create function (Node.js)",
    description:
      "コードをその場で zip にして --zip-file fileb:// で渡します（handler は index.handler 固定）",
    template:
      "lambda create-function --function-name {name} --runtime nodejs20.x --handler index.handler --role arn:aws:iam::000000000000:role/lambda-role --zip-file fileb://@zip{code,index.js}",
    fields: [
      { name: "name", label: "Function name", default: "demo-fn-node" },
      {
        name: "code",
        label: "index.js",
        type: "textarea",
        default:
          'exports.handler = async (event) => {\n  return { message: "Hello from Floci (Node)!", event };\n};\n',
      },
    ],
  },
  {
    id: "lambda-create-python",
    service: "Lambda",
    label: "Create function (Python)",
    description:
      "コードをその場で zip にして --zip-file fileb:// で渡します（handler は lambda_function.lambda_handler 固定）",
    template:
      "lambda create-function --function-name {name} --runtime python3.12 --handler lambda_function.lambda_handler --role arn:aws:iam::000000000000:role/lambda-role --zip-file fileb://@zip{code,lambda_function.py}",
    fields: [
      { name: "name", label: "Function name", default: "demo-fn-py" },
      {
        name: "code",
        label: "lambda_function.py",
        type: "textarea",
        default:
          'def lambda_handler(event, context):\n    return {"message": "Hello from Floci (Python)!", "event": event}\n',
      },
    ],
  },
  {
    id: "lambda-invoke",
    service: "Lambda",
    label: "Invoke function",
    description:
      "戻り値は『function output』として stdout の末尾に表示されます",
    template:
      "lambda invoke --function-name {name} --cli-binary-format raw-in-base64-out --payload {payload} @out{response}",
    fields: [
      { name: "name", label: "Function name", default: "demo-fn-node" },
      { name: "payload", label: "Payload (JSON)", default: '{"hello":"floci"}' },
    ],
  },
  {
    id: "lambda-get",
    service: "Lambda",
    label: "Get function",
    template: "lambda get-function --function-name {name}",
    fields: [{ name: "name", label: "Function name", default: "demo-fn-node" }],
  },
  {
    id: "lambda-delete",
    service: "Lambda",
    label: "Delete function",
    template: "lambda delete-function --function-name {name}",
    fields: [{ name: "name", label: "Function name", default: "demo-fn-node" }],
  },

  // ─── EC2 ───
  {
    id: "ec2-describe-instances",
    service: "EC2",
    label: "Describe instances",
    template: "ec2 describe-instances",
    fields: [],
  },
  {
    id: "ec2-describe-images",
    service: "EC2",
    label: "Describe images (AMIs)",
    description:
      "Floci が事前定義している AMI を確認できます。RunInstances 用の image-id をここから取得",
    template: "ec2 describe-images",
    fields: [],
  },
  {
    id: "ec2-describe-vpcs",
    service: "EC2",
    label: "Describe VPCs",
    template: "ec2 describe-vpcs",
    fields: [],
  },
  {
    id: "ec2-describe-subnets",
    service: "EC2",
    label: "Describe subnets",
    template: "ec2 describe-subnets",
    fields: [],
  },
  {
    id: "ec2-describe-sg",
    service: "EC2",
    label: "Describe security groups",
    template: "ec2 describe-security-groups",
    fields: [],
  },
  {
    id: "ec2-run-instances",
    service: "EC2",
    label: "Run instances",
    description:
      "Floci の EC2 は実 Docker コンテナを起動します。AMI ID は describe-images の結果から選択（デフォルトは Amazon Linux 2023）",
    template:
      "ec2 run-instances --image-id {ami} --instance-type {type} --count {count}",
    fields: [
      { name: "ami", label: "AMI ID", default: "ami-0abcdef1234567891" },
      { name: "type", label: "Instance type", default: "t3.micro" },
      { name: "count", label: "Count", default: "1", type: "number" },
    ],
  },
  {
    id: "ec2-terminate-instances",
    service: "EC2",
    label: "Terminate instances",
    template: "ec2 terminate-instances --instance-ids {id}",
    fields: [{ name: "id", label: "Instance ID", default: "i-xxxxxxxxxxxxxxxxx" }],
  },

  // ─── ECS (Fargate) ───
  {
    id: "ecs-list-clusters",
    service: "ECS",
    label: "List clusters",
    template: "ecs list-clusters",
    fields: [],
  },
  {
    id: "ecs-create-cluster",
    service: "ECS",
    label: "Create cluster",
    template: "ecs create-cluster --cluster-name {name}",
    fields: [{ name: "name", label: "Cluster name", default: "demo-cluster" }],
  },
  {
    id: "ecs-register-task-def",
    service: "ECS",
    label: "Register task definition (Fargate)",
    description:
      "Task Definition JSON を一時ファイルに書き出して --cli-input-json file:// で渡します",
    template: "ecs register-task-definition --cli-input-json file://@{def}",
    fields: [
      {
        name: "def",
        label: "Task definition JSON",
        type: "textarea",
        default:
          '{\n  "family": "demo-task",\n  "networkMode": "awsvpc",\n  "requiresCompatibilities": ["FARGATE"],\n  "cpu": "256",\n  "memory": "512",\n  "containerDefinitions": [\n    {\n      "name": "app",\n      "image": "public.ecr.aws/nginx/nginx:alpine",\n      "essential": true,\n      "portMappings": [{"containerPort": 80, "protocol": "tcp"}]\n    }\n  ]\n}',
      },
    ],
  },
  {
    id: "ecs-list-task-defs",
    service: "ECS",
    label: "List task definitions",
    template: "ecs list-task-definitions",
    fields: [],
  },
  {
    id: "ecs-run-task",
    service: "ECS",
    label: "Run task (Fargate)",
    description:
      "network-configuration は shorthand 形式。subnet-id / sg-id は describe-subnets / describe-security-groups で確認",
    template:
      "ecs run-task --cluster {cluster} --task-definition {taskdef} --launch-type FARGATE --network-configuration {netconfig}",
    fields: [
      { name: "cluster", label: "Cluster name", default: "demo-cluster" },
      { name: "taskdef", label: "Task definition (family[:revision])", default: "demo-task" },
      {
        name: "netconfig",
        label: "Network configuration (shorthand)",
        default: "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}",
      },
    ],
  },
  {
    id: "ecs-list-tasks",
    service: "ECS",
    label: "List tasks",
    template: "ecs list-tasks --cluster {cluster}",
    fields: [{ name: "cluster", label: "Cluster name", default: "demo-cluster" }],
  },
  {
    id: "ecs-describe-tasks",
    service: "ECS",
    label: "Describe tasks",
    template: "ecs describe-tasks --cluster {cluster} --tasks {arn}",
    fields: [
      { name: "cluster", label: "Cluster name", default: "demo-cluster" },
      { name: "arn", label: "Task ARN", default: "" },
    ],
  },
  {
    id: "ecs-delete-cluster",
    service: "ECS",
    label: "Delete cluster",
    template: "ecs delete-cluster --cluster {name}",
    fields: [{ name: "name", label: "Cluster name", default: "demo-cluster" }],
  },

  // ─── DynamoDB ───
  {
    id: "ddb-list",
    service: "DynamoDB",
    label: "List tables",
    template: "dynamodb list-tables",
    fields: [],
  },
  {
    id: "ddb-create",
    service: "DynamoDB",
    label: "Create table (PAY_PER_REQUEST)",
    template:
      "dynamodb create-table --table-name {name} --attribute-definitions AttributeName={pk},AttributeType={pktype} --key-schema AttributeName={pk},KeyType=HASH --billing-mode PAY_PER_REQUEST",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "pk", label: "Partition key name", default: "id" },
      { name: "pktype", label: "Partition key type (S/N/B)", default: "S" },
    ],
  },
  {
    id: "ddb-describe",
    service: "DynamoDB",
    label: "Describe table",
    template: "dynamodb describe-table --table-name {name}",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
  },
  {
    id: "ddb-put",
    service: "DynamoDB",
    label: "Put item",
    description: "--item は DynamoDB JSON 形式 (例: {\"id\":{\"S\":\"a\"}})",
    template: "dynamodb put-item --table-name {name} --item {item}",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      {
        name: "item",
        label: "Item (DynamoDB JSON)",
        type: "textarea",
        default: '{"id":{"S":"item1"},"value":{"S":"hello floci"}}',
      },
    ],
  },
  {
    id: "ddb-get",
    service: "DynamoDB",
    label: "Get item",
    template: "dynamodb get-item --table-name {name} --key {key}",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "key", label: "Key (DynamoDB JSON)", default: '{"id":{"S":"item1"}}' },
    ],
  },
  {
    id: "ddb-scan",
    service: "DynamoDB",
    label: "Scan table",
    template: "dynamodb scan --table-name {name}",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
  },
  {
    id: "ddb-query",
    service: "DynamoDB",
    label: "Query table",
    template:
      "dynamodb query --table-name {name} --key-condition-expression {expr} --expression-attribute-values {values}",
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "expr", label: "Key condition expression", default: "id = :id" },
      {
        name: "values",
        label: "Expression attribute values",
        default: '{":id":{"S":"item1"}}',
      },
    ],
  },
  {
    id: "ddb-delete",
    service: "DynamoDB",
    label: "Delete table",
    template: "dynamodb delete-table --table-name {name}",
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
  },

  // ─── ElastiCache (Valkey / Redis) ───
  {
    id: "ec-describe",
    service: "ElastiCache",
    label: "Describe cache clusters",
    template: "elasticache describe-cache-clusters",
    fields: [],
  },
  {
    id: "ec-describe-rg",
    service: "ElastiCache",
    label: "Describe replication groups",
    template: "elasticache describe-replication-groups",
    fields: [],
  },
  {
    id: "ec-create-valkey-rg",
    service: "ElastiCache",
    label: "Create replication group (Valkey)",
    description:
      "Floci(実 AWS と同様)は Redis/Valkey を CreateReplicationGroup で作成。実 Valkey/Redis コンテナを 6379-6399 のプロキシポートで公開します（10〜30秒）",
    template:
      "elasticache create-replication-group --replication-group-id {id} --replication-group-description {desc} --engine valkey --num-cache-clusters 1 --cache-node-type cache.t3.micro",
    fields: [
      { name: "id", label: "Replication group ID", default: "demo-valkey" },
      { name: "desc", label: "Description", default: "Demo Valkey replication group" },
    ],
  },
  {
    id: "ec-create-redis-rg",
    service: "ElastiCache",
    label: "Create replication group (Redis)",
    template:
      "elasticache create-replication-group --replication-group-id {id} --replication-group-description {desc} --engine redis --num-cache-clusters 1 --cache-node-type cache.t3.micro",
    fields: [
      { name: "id", label: "Replication group ID", default: "demo-redis" },
      { name: "desc", label: "Description", default: "Demo Redis replication group" },
    ],
  },
  {
    id: "ec-create-memcached",
    service: "ElastiCache",
    label: "Create cache cluster (Memcached)",
    description:
      "Memcached は CreateCacheCluster で作成 (Redis/Valkey と異なる)",
    template:
      "elasticache create-cache-cluster --cache-cluster-id {id} --engine memcached --num-cache-nodes 1 --cache-node-type cache.t3.micro",
    fields: [{ name: "id", label: "Cluster ID", default: "demo-memcached" }],
  },
  {
    id: "ec-delete-rg",
    service: "ElastiCache",
    label: "Delete replication group",
    template: "elasticache delete-replication-group --replication-group-id {id}",
    fields: [{ name: "id", label: "Replication group ID", default: "demo-valkey" }],
  },
  {
    id: "ec-delete",
    service: "ElastiCache",
    label: "Delete cache cluster",
    template: "elasticache delete-cache-cluster --cache-cluster-id {id}",
    fields: [{ name: "id", label: "Cluster ID", default: "demo-memcached" }],
  },

  // ─── Athena ───
  // Floci の Athena は mock mode：クエリは受理されるが結果は空。list-data-catalogs /
  // list-work-groups / list-databases は Floci 未対応 (Action ... is not supported)。
  {
    id: "athena-start-query",
    service: "Athena",
    label: "Start query execution",
    description:
      "Floci の Athena は mock mode：クエリ ID は発行されるが get-query-results は空。OutputLocation の S3 バケットを先に作成しておく",
    template:
      "athena start-query-execution --query-string {query} --result-configuration OutputLocation={output} --query-execution-context Database={database}",
    fields: [
      { name: "query", label: "SQL", type: "textarea", default: "SELECT 1" },
      { name: "output", label: "Output location (S3)", default: "s3://athena-results/" },
      { name: "database", label: "Database", default: "default" },
    ],
  },
  {
    id: "athena-list-executions",
    service: "Athena",
    label: "List query executions",
    template: "athena list-query-executions",
    fields: [],
  },
  {
    id: "athena-get-execution",
    service: "Athena",
    label: "Get query execution",
    template: "athena get-query-execution --query-execution-id {id}",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
  },
  {
    id: "athena-get-results",
    service: "Athena",
    label: "Get query results",
    template: "athena get-query-results --query-execution-id {id}",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
  },
];

const SERVICES = Array.from(new Set(PRESETS.map((p) => p.service)));

const FLOCI_ENDPOINT = process.env.FLOCI_ENDPOINT || "http://floci:4566";

type Expanded = {
  tokens: string[];
  // Simple text files to write before running the command (used by `@{name}`).
  prepFiles: Array<{ path: string; content: string }>;
  // Zip artifacts: write content as {name} inside dir, then `zip -r zipPath .` from dir.
  prepZips: Array<{ dir: string; zipPath: string; files: Array<{ name: string; content: string }> }>;
  // Output files to read after the command finishes and append to stdout.
  outputs: Array<{ path: string; label: string }>;
  cleanupFiles: string[];
  cleanupDirs: string[];
};

function expandTemplate(template: string, values: Record<string, string>): Expanded {
  const result: Expanded = {
    tokens: [],
    prepFiles: [],
    prepZips: [],
    outputs: [],
    cleanupFiles: [],
    cleanupDirs: [],
  };

  const rawTokens = template.split(/\s+/).filter(Boolean);

  for (const token of rawTokens) {
    let replaced = token;

    // @zip{varname,filename}: write field value as <filename> in a temp dir and
    // zip it; substitute the zip path. Use for Lambda --zip-file fileb://...
    replaced = replaced.replace(/@zip\{(\w+),([\w.]+)\}/g, (_, varname: string, filename: string) => {
      const content = values[varname] ?? "";
      const id = randomUUID();
      const dir = `/tmp/cli-console-zip-${id}`;
      const zipPath = `/tmp/cli-console-zip-${id}.zip`;
      result.prepZips.push({ dir, zipPath, files: [{ name: filename, content }] });
      result.cleanupFiles.push(zipPath);
      result.cleanupDirs.push(dir);
      return zipPath;
    });

    // @out{varname}: substitute with a unique temp path; after the command runs,
    // the file content is appended to stdout (labeled). Use for `aws lambda invoke OUTFILE`.
    replaced = replaced.replace(/@out\{(\w+)\}/g, (_, varname: string) => {
      const id = randomUUID();
      const outPath = `/tmp/cli-console-out-${id}`;
      result.outputs.push({ path: outPath, label: varname });
      result.cleanupFiles.push(outPath);
      return outPath;
    });

    // @{name}: write field value to a temp text file and substitute the file path.
    replaced = replaced.replace(/@\{(\w+)\}/g, (_, name: string) => {
      const value = values[name] ?? "";
      const path = `/tmp/cli-console-${randomUUID()}.txt`;
      result.prepFiles.push({ path, content: value });
      result.cleanupFiles.push(path);
      return path;
    });

    // {name} = literal substitution (whole token preserved when the value contains
    // characters like { } that would confuse the partial regex).
    const fullMatch = replaced.match(/^\{(\w+)\}$/);
    if (fullMatch) {
      result.tokens.push(values[fullMatch[1]] ?? "");
      continue;
    }

    // partial substitution inside token (e.g. s3://{bucket})
    replaced = replaced.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
    result.tokens.push(replaced);
  }

  return result;
}

async function createZip(dir: string, zipPath: string): Promise<{ ok: boolean; stderr: string }> {
  const proc = Bun.spawn(["zip", "-r", "-q", zipPath, "."], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  return { ok: (proc.exitCode ?? -1) === 0, stderr };
}

async function runAwsCommand(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}> {
  const start = Date.now();
  const proc = Bun.spawn(["aws", "--endpoint-url", FLOCI_ENDPOINT, ...args], {
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      AWS_DEFAULT_REGION: "us-east-1",
      AWS_PAGER: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;

  return {
    stdout,
    stderr,
    exitCode: proc.exitCode ?? -1,
    durationMs: Date.now() - start,
  };
}

const app = new Hono();

app.get("/", (c) => {
  return c.html(renderPage());
});

app.post("/run", async (c) => {
  const body = await c.req.parseBody();
  const presetId = String(body._preset || "");
  const customArgs = String(body._args || "");

  let argsTemplate: string;
  let label: string;

  if (presetId === "_custom") {
    if (!customArgs.trim()) {
      return c.html(renderHistoryEntry({
        label: "Custom",
        command: "(empty)",
        stdout: "",
        stderr: "コマンドが空です",
        exitCode: 1,
        durationMs: 0,
      }));
    }
    argsTemplate = customArgs;
    label = "Custom";
  } else {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      return c.html(renderHistoryEntry({
        label: "?",
        command: "(unknown preset)",
        stdout: "",
        stderr: `unknown preset: ${presetId}`,
        exitCode: 1,
        durationMs: 0,
      }));
    }
    argsTemplate = preset.template;
    label = `${preset.service} / ${preset.label}`;
  }

  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.startsWith("_")) continue;
    values[k] = String(v);
  }

  const expanded = expandTemplate(argsTemplate, values);

  try {
    await Promise.all(
      expanded.prepFiles.map((f) => writeFile(f.path, f.content, "utf-8")),
    );

    for (const z of expanded.prepZips) {
      await mkdir(z.dir, { recursive: true });
      await Promise.all(
        z.files.map((f) => writeFile(join(z.dir, f.name), f.content, "utf-8")),
      );
      const zipRes = await createZip(z.dir, z.zipPath);
      if (!zipRes.ok) {
        return c.html(
          renderHistoryEntry({
            label,
            command: `(zip preparation) ${z.zipPath}`,
            stdout: "",
            stderr: `zip failed: ${zipRes.stderr}`,
            exitCode: 1,
            durationMs: 0,
          }),
        );
      }
    }

    const result = await runAwsCommand(expanded.tokens);

    let extraStdout = "";
    for (const out of expanded.outputs) {
      try {
        const content = await readFile(out.path, "utf-8");
        extraStdout += `\n─── ${out.label} ───\n${content}`;
      } catch (_) {
        // file might not exist if the command failed before writing it
      }
    }

    return c.html(
      renderHistoryEntry({
        label,
        command: `aws --endpoint-url ${FLOCI_ENDPOINT} ${expanded.tokens.join(" ")}`,
        stdout: result.stdout + extraStdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      }),
    );
  } finally {
    await Promise.all(
      expanded.cleanupFiles.map((f) => unlink(f).catch(() => {})),
    );
    await Promise.all(
      expanded.cleanupDirs.map((d) =>
        rm(d, { recursive: true, force: true }).catch(() => {}),
      ),
    );
  }
});

// ─── HTML rendering ────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHistoryEntry(entry: {
  label: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}) {
  const ok = entry.exitCode === 0;
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  return html`
    <article class="rounded-lg border ${ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"} p-4 mb-3">
      <header class="flex flex-wrap items-center gap-2 mb-2">
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}">
          ${ok ? "OK" : `exit ${entry.exitCode}`}
        </span>
        <span class="font-semibold text-zinc-100">${entry.label}</span>
        <span class="text-xs text-zinc-500 ml-auto">${time} · ${entry.durationMs}ms</span>
      </header>
      <pre class="text-xs text-zinc-400 whitespace-pre-wrap break-all mb-2">$ ${entry.command}</pre>
      ${entry.stdout
        ? html`<pre class="text-sm text-zinc-100 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">${entry.stdout}</pre>`
        : ""}
      ${entry.stderr
        ? html`<pre class="text-sm text-rose-300 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all mt-2">${entry.stderr}</pre>`
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
      x-data='{ template: ${JSON.stringify(p.template)}, values: ${initialValues} }'
      class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-3 h-full"
      hx-post="/run"
      hx-target="#history"
      hx-swap="afterbegin"
      hx-indicator="find .htmx-loader"
    >
      <input type="hidden" name="_preset" value="${p.id}" />
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-700 text-zinc-300 tracking-wide uppercase">${p.service}</span>
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
                  const common = `id="${id}" name="${f.name}" x-model="values.${f.name}" class="w-full rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400"`;
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
          <p class="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Command preview</p>
          <pre class="text-xs text-zinc-200 bg-zinc-950 border border-zinc-700 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all" x-text="buildPreview(template, values)"></pre>
        </div>
        <div class="flex items-center gap-3 justify-end">
          <span class="htmx-loader text-xs text-zinc-500 htmx-indicator">running…</span>
          <button
            type="submit"
            class="rounded bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-semibold px-4 py-1.5 transition"
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
  firstOfService["Custom"] = "_custom";
  const defaultTab = SERVICES[0];
  const defaultSelected = firstOfService[defaultTab];

  const sidebarSections = SERVICES.map(
    (s) => html`
      <div x-show="tab==='${s}'" x-cloak class="flex flex-col">
        ${raw(
          PRESETS.filter((p) => p.service === s)
            .map(
              (p) =>
                `<button type="button" @click="selected='${p.id}'" :class="selected==='${p.id}' ? 'bg-zinc-700 text-zinc-100 border-l-2 border-zinc-300' : 'border-l-2 border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'" class="w-full text-left px-3 py-1.5 text-sm rounded-r transition">${p.label}</button>`,
            )
            .join(""),
        )}
      </div>
    `,
  );

  const tabButtons = [...SERVICES, "Custom"].map(
    (s) => html`
      <button
        type="button"
        @click="tab='${s}'"
        :class="tab==='${s}' ? 'border-zinc-200 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200'"
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
    <title>Floci CLI Console</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script src="https://unpkg.com/htmx.org@2.0.3" defer></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <style>
      [x-cloak] { display: none !important; }
      .htmx-indicator { opacity: 0; transition: opacity 200ms; }
      .htmx-request .htmx-indicator { opacity: 1; }
      #history:has(article) > .empty-placeholder { display: none; }
    </style>
    <script>
      const FLOCI_ENDPOINT = ${raw(JSON.stringify(FLOCI_ENDPOINT))};
      function buildPreview(template, values) {
        const expanded = template.replace(/(@?)\\{(\\w+)\\}/g, (match, prefix, name) => {
          const val = values[name];
          if (val === undefined || val === '') return '{' + name + '}';
          if (prefix === '@') {
            const preview = val.length > 24 ? val.slice(0, 24) + '…' : val;
            return '<file:' + preview + '>';
          }
          return val;
        });
        return 'aws --endpoint-url ' + FLOCI_ENDPOINT + ' ' + expanded;
      }
      function buildCustomPreview(args) {
        return 'aws --endpoint-url ' + FLOCI_ENDPOINT + ' ' + (args || '<args>');
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
        <span class="text-zinc-300">Floci</span> CLI Console
      </h1>
      <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-zinc-700 text-zinc-200">CLI</span>
      <span class="text-xs text-zinc-500 font-mono">${FLOCI_ENDPOINT}</span>
      <div class="ml-auto flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>Console:</span>
          <select
            onchange="window.location.href=this.value"
            class="text-xs bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-zinc-400"
          >
            <option value="http://localhost:8000" selected>CLI Console</option>
            <option value="http://localhost:8001">Ruby SDK Console</option>
            <option value="http://localhost:8002">JS SDK Console</option>
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
        <form
          x-show="selected==='_custom'"
          x-cloak
          x-data="{ args: '' }"
          class="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-3 h-full"
          hx-post="/run"
          hx-target="#history"
          hx-swap="afterbegin"
          hx-indicator="find .htmx-loader"
        >
          <input type="hidden" name="_preset" value="_custom" />
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-700 text-zinc-300 tracking-wide uppercase">Custom</span>
              <h3 class="text-base font-semibold text-zinc-100">Custom command</h3>
            </div>
            <p class="text-xs text-zinc-500">
              <code class="text-zinc-300">aws --endpoint-url ${FLOCI_ENDPOINT}</code> に続く引数を入力。例: <code class="text-zinc-300">s3 ls</code>
            </p>
          </div>
          <label class="flex flex-col gap-1 text-xs text-zinc-400">
            <span>Arguments</span>
            <textarea
              name="_args"
              x-model="args"
              rows="2"
              class="w-full rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-400"
              placeholder="s3 ls"
            ></textarea>
          </label>
          <div class="mt-auto space-y-3">
            <div>
              <p class="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Command preview</p>
              <pre class="text-xs text-zinc-200 bg-zinc-950 border border-zinc-700 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all" x-text="buildCustomPreview(args)"></pre>
            </div>
            <div class="flex items-center gap-3 justify-end">
              <span class="htmx-loader text-xs text-zinc-500 htmx-indicator">running…</span>
              <button
                type="submit"
                class="rounded bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-semibold px-4 py-1.5 transition"
              >Run</button>
            </div>
          </div>
        </form>
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
  </body>
</html>`;
}

// ─── Demo resource seeding ───
// init/setup-aws-resources.sh は floci コンテナ内で curl を使うので、SigV4 が必要なサービス
// (ElastiCache 等) や zip が必要なサービス (Lambda) はここで aws-cli 経由で seed する。

async function seedDemoLambda() {
  const check = await runAwsCommand([
    "lambda",
    "get-function",
    "--function-name",
    "floci-test-lambda",
  ]);
  if (check.exitCode === 0) {
    console.log("ℹ Lambda 'floci-test-lambda' already exists, skipping seed");
    return;
  }
  const id = randomUUID();
  const dir = `/tmp/seed-lambda-${id}`;
  const zipPath = `/tmp/seed-lambda-${id}.zip`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "index.js"),
      'exports.handler = async (event) => {\n  return { message: "Hello from Floci Lambda!", event };\n};\n',
      "utf-8",
    );
    const zipRes = await createZip(dir, zipPath);
    if (!zipRes.ok) {
      console.warn(`⚠ Lambda seed zip failed: ${zipRes.stderr}`);
      return;
    }
    const result = await runAwsCommand([
      "lambda",
      "create-function",
      "--function-name",
      "floci-test-lambda",
      "--runtime",
      "nodejs20.x",
      "--handler",
      "index.handler",
      "--role",
      "arn:aws:iam::000000000000:role/lambda-role",
      "--zip-file",
      `fileb://${zipPath}`,
    ]);
    if (result.exitCode === 0) {
      console.log("✓ Lambda seeded: floci-test-lambda (nodejs20.x)");
    } else {
      console.warn(`⚠ Lambda seed failed: ${result.stderr.trim()}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    await unlink(zipPath).catch(() => {});
  }
}

async function seedElastiCacheReplicationGroup(
  rgId: string,
  engine: "redis" | "valkey",
) {
  // Floci (実 AWS と同様) は Redis/Valkey を CreateCacheCluster ではなく
  // CreateReplicationGroup で作成する必要がある。
  const check = await runAwsCommand([
    "elasticache",
    "describe-replication-groups",
    "--replication-group-id",
    rgId,
  ]);
  if (check.exitCode === 0) {
    console.log(`ℹ ElastiCache RG '${rgId}' already exists, skipping seed`);
    return;
  }
  const result = await runAwsCommand([
    "elasticache",
    "create-replication-group",
    "--replication-group-id",
    rgId,
    "--replication-group-description",
    `Floci test ${engine}`,
    "--engine",
    engine,
    "--num-cache-clusters",
    "1",
    "--cache-node-type",
    "cache.t3.micro",
  ]);
  if (result.exitCode === 0) {
    console.log(`✓ ElastiCache RG seeded: ${rgId} (${engine})`);
  } else {
    console.warn(`⚠ ElastiCache RG seed failed (${rgId}): ${result.stderr.trim()}`);
  }
}

async function seedAll() {
  // floci の healthcheck で起動済みなはずだが念のため少し待つ
  await new Promise((r) => setTimeout(r, 2000));
  await seedDemoLambda();
  await seedElastiCacheReplicationGroup("floci-test-cache", "redis");
  await seedElastiCacheReplicationGroup("floci-test-valkey", "valkey");
}
seedAll().catch((e) => console.warn("Demo seed error:", e));

const port = Number(process.env.PORT) || 8000;
console.log(`CLI Console listening on http://0.0.0.0:${port}`);
console.log(`Floci endpoint: ${FLOCI_ENDPOINT}`);

export default {
  port,
  fetch: app.fetch,
};
