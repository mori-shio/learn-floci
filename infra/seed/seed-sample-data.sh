#!/bin/bash
set -e

# Terraform で作成済みのインフラにサンプルデータを投入するスクリプト。
# 使い方: terraform apply 後に実行
#   cd infra/seed && bash seed-sample-data.sh

export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

echo "=== Seeding sample data ==="

# S3: サンプルオブジェクト
echo '{"hello":"from floci"}' | aws s3 cp - s3://floci-test-bucket/sample.json
echo "✓ S3 object: floci-test-bucket/sample.json"

# SQS: サンプルメッセージ
aws sqs send-message \
  --queue-url "$(aws sqs get-queue-url --queue-name floci-test-queue --query QueueUrl --output text)" \
  --message-body '{"event":"test","source":"seed-script"}' \
  --output text --query MessageId | xargs -I{} echo "✓ SQS message: {}"

# SNS: サンプル publish
aws sns publish \
  --topic-arn "$(aws sns list-topics --query 'Topics[?ends_with(TopicArn,`:floci-test-topic`)].TopicArn' --output text)" \
  --message '{"event":"test","source":"seed-script"}' \
  --output text --query MessageId | xargs -I{} echo "✓ SNS publish: {}"

# RDS: サンプルテーブル & データ投入
# Floci の RDS proxy ポートを describe-db-instances から取得
RDS_PORT=$(aws rds describe-db-instances \
  --db-instance-identifier floci-test-db \
  --query 'DBInstances[0].Endpoint.Port' \
  --output text 2>/dev/null)

if [ -z "$RDS_PORT" ] || [ "$RDS_PORT" = "None" ]; then
  echo "⚠ RDS instance not found, skipping RDS seed"
else
  docker run --rm --network host mysql:8 \
    mysql -h 127.0.0.1 -P "$RDS_PORT" --protocol=tcp --ssl-mode=DISABLED -u admin -ppassword floci_test_dev -e "
CREATE TABLE IF NOT EXISTS users (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);
INSERT IGNORE INTO users (name, email) VALUES
  ('Alice',   'alice@example.com'),
  ('Bob',     'bob@example.com'),
  ('Charlie', 'charlie@example.com');
"
  echo "✓ RDS: users テーブル作成 + 3 件投入 (port=$RDS_PORT)"
fi

echo "=== Done ==="
