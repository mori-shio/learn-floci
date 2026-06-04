#!/bin/bash
set -e

ENDPOINT="http://localhost:4566"

echo "=== Creating AWS resources on Floci ==="

# S3 バケット作成
curl -s -X PUT "${ENDPOINT}/floci-test-bucket" > /dev/null
echo "✓ S3 bucket: floci-test-bucket"

# SQS キュー作成
curl -s -X POST "${ENDPOINT}/" \
  -d "Action=CreateQueue&QueueName=floci-test-queue&Version=2012-11-05" > /dev/null
echo "✓ SQS queue: floci-test-queue"

# SNS トピック作成
curl -s -X POST "${ENDPOINT}/" \
  -d "Action=CreateTopic&Name=floci-test-topic&Version=2010-03-31" > /dev/null
echo "✓ SNS topic: floci-test-topic"

# Secrets Manager
curl -s -X POST "${ENDPOINT}/" \
  -H "X-Amz-Target: secretsmanager.CreateSecret" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -d '{"Name":"floci-test/rails-secret","SecretString":"{\"secret_key_base\":\"dummy-secret-key-for-local-dev\"}"}' > /dev/null
echo "✓ Secret: floci-test/rails-secret"

# SSM Parameter Store
curl -s -X POST "${ENDPOINT}/" \
  -H "X-Amz-Target: AmazonSSM.PutParameter" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -d '{"Name":"/floci-test/app/environment","Value":"development","Type":"String","Overwrite":true}' > /dev/null
echo "✓ SSM Parameter: /floci-test/app/environment"

# RDS PostgreSQL インスタンス作成（コンテナ起動まで30秒ほどかかる）
echo "Creating RDS instance (this may take 20-40s)..."
RDS_RESULT=$(curl -s -X POST "${ENDPOINT}/" \
  -d "Action=CreateDBInstance&DBInstanceIdentifier=floci-test-db&DBInstanceClass=db.t3.micro&Engine=postgres&MasterUsername=postgres&MasterUserPassword=password&DBName=floci_test_dev&Version=2014-10-31" 2>&1)
echo "${RDS_RESULT}" | grep -q "DBInstanceIdentifier" && echo "✓ RDS instance: floci-test-db (PostgreSQL)" || echo "⚠ RDS: ${RDS_RESULT}"

# ElastiCache (Redis / Valkey) の seed は aws-console 側で実行
# (Floci の Query プロトコルは SigV4 でサービスを判定するので bare curl だと SQS にルーティングされてしまう)
echo "ℹ ElastiCache の seed は aws-console コンテナで実行されます (SigV4 ルーティング必須のため)"

# DynamoDB テーブル作成 (DynamoDB は JSON 1.0 プロトコル)
DDB_RESULT=$(curl -s -X POST "${ENDPOINT}/" \
  -H "X-Amz-Target: DynamoDB_20120810.CreateTable" \
  -H "Content-Type: application/x-amz-json-1.0" \
  -d '{
    "TableName": "floci-test-items",
    "AttributeDefinitions": [{"AttributeName":"id","AttributeType":"S"}],
    "KeySchema": [{"AttributeName":"id","KeyType":"HASH"}],
    "BillingMode": "PAY_PER_REQUEST"
  }' 2>&1)
echo "${DDB_RESULT}" | grep -q "TableName" && echo "✓ DynamoDB table: floci-test-items" || echo "⚠ DynamoDB: ${DDB_RESULT}"

# DynamoDB サンプルアイテム投入
DDB_PUT_RESULT=$(curl -s -X POST "${ENDPOINT}/" \
  -H "X-Amz-Target: DynamoDB_20120810.PutItem" \
  -H "Content-Type: application/x-amz-json-1.0" \
  -d '{
    "TableName": "floci-test-items",
    "Item": {"id":{"S":"item1"},"value":{"S":"hello from floci"}}
  }' 2>&1)
if [ -z "${DDB_PUT_RESULT}" ] || echo "${DDB_PUT_RESULT}" | grep -qiE '"(Attributes|ConsumedCapacity)"|^\{?\s*\}?$'; then
  echo "✓ DynamoDB item: floci-test-items / id=item1"
else
  echo "⚠ DynamoDB PutItem: ${DDB_PUT_RESULT}"
fi

# ECS クラスタ作成
ECS_RESULT=$(curl -s -X POST "${ENDPOINT}/" \
  -H "X-Amz-Target: AmazonEC2ContainerServiceV20141113.CreateCluster" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -d '{"clusterName":"floci-test-cluster"}' 2>&1)
echo "${ECS_RESULT}" | grep -q "clusterName" && echo "✓ ECS cluster: floci-test-cluster" || echo "⚠ ECS: ${ECS_RESULT}"

# ECS Fargate タスク定義
ECS_TD_RESULT=$(curl -s -X POST "${ENDPOINT}/" \
  -H "X-Amz-Target: AmazonEC2ContainerServiceV20141113.RegisterTaskDefinition" \
  -H "Content-Type: application/x-amz-json-1.1" \
  -d '{
    "family": "floci-test-task",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "containerDefinitions": [
      {
        "name": "app",
        "image": "public.ecr.aws/nginx/nginx:alpine",
        "essential": true,
        "portMappings": [{"containerPort": 80, "protocol": "tcp"}]
      }
    ]
  }' 2>&1)
echo "${ECS_TD_RESULT}" | grep -q "taskDefinitionArn" && echo "✓ ECS task definition: floci-test-task (Fargate)" || echo "⚠ ECS task def: ${ECS_TD_RESULT}"

# Athena 結果出力用 S3 バケット
curl -s -X PUT "${ENDPOINT}/athena-results" > /dev/null
echo "✓ S3 bucket: athena-results (Athena 結果出力用)"

# Lambda の seed は zip が必要なので aws-console 側で実行 (server.tsx の startup hook)
echo "ℹ Lambda seed は aws-console コンテナで実行されます (zip 必須のため)"

echo "=== All AWS resources created ==="
