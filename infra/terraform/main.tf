# ─── S3 ───

resource "aws_s3_bucket" "test" {
  bucket        = "floci-test-bucket"
  force_destroy = true # seed / ハンズオンで投入したオブジェクトを destroy 時にまとめて削除
}

resource "aws_s3_bucket" "athena_results" {
  bucket        = "athena-results"
  force_destroy = true
}

# ─── SQS ───

resource "aws_sqs_queue" "test" {
  name = "floci-test-queue"
}

# ─── SNS ───

resource "aws_sns_topic" "test" {
  name = "floci-test-topic"
}

# ─── Secrets Manager ───

resource "aws_secretsmanager_secret" "test" {
  name = "floci-test/rails-secret"
}

resource "aws_secretsmanager_secret_version" "test" {
  secret_id = aws_secretsmanager_secret.test.id
  secret_string = jsonencode({
    secret_key_base = "dummy-secret-key-for-local-dev"
  })
}

# ─── SSM Parameter Store ───

resource "aws_ssm_parameter" "test" {
  name  = "/floci-test/app/environment"
  type  = "String"
  value = "development"
}

# ─── RDS ───

resource "aws_db_instance" "test" {
  identifier                 = "floci-test-db"
  instance_class             = "db.t3.micro"
  engine                     = "mysql"
  allocated_storage          = 20
  username                   = "admin"
  password                   = "password"
  db_name                    = "floci_test_dev"
  auto_minor_version_upgrade = false

  skip_final_snapshot = true
}

# ─── DynamoDB ───

resource "aws_dynamodb_table" "test" {
  name         = "floci-test-items"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_dynamodb_table_item" "sample" {
  table_name = aws_dynamodb_table.test.name
  hash_key   = aws_dynamodb_table.test.hash_key

  item = jsonencode({
    id    = { S = "item1" }
    value = { S = "hello from floci" }
  })
}

# ─── EC2 ───

resource "aws_instance" "test" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t2.micro"

  tags = {
    Name = "floci-test-instance"
  }
}

# ─── ECS ───

resource "aws_ecs_cluster" "test" {
  name = "floci-test-cluster"
}

resource "aws_ecs_task_definition" "test" {
  family                   = "floci-test-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  container_definitions = jsonencode([
    {
      name         = "app"
      image        = "public.ecr.aws/nginx/nginx:alpine"
      essential    = true
      portMappings = [{ containerPort = 80, protocol = "tcp" }]
    }
  ])

  lifecycle {
    ignore_changes = [requires_compatibilities, container_definitions]
  }
}

# ─── Lambda ───

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.js"
  output_path = "${path.module}/lambda/index.zip"
}

resource "aws_lambda_function" "test" {
  function_name    = "floci-test-lambda"
  role             = "arn:aws:iam::000000000000:role/lambda-role"
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  lifecycle {
    ignore_changes = [environment]
  }
}

# ─── ElastiCache ───

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "floci-test-cache"
  description          = "Floci test redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 1

  lifecycle {
    ignore_changes = [engine, port, num_cache_clusters, member_clusters]
  }
}

resource "aws_elasticache_replication_group" "valkey" {
  replication_group_id = "floci-test-valkey"
  description          = "Floci test valkey"
  engine               = "valkey"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 1

  lifecycle {
    ignore_changes = [engine, port, num_cache_clusters, member_clusters]
  }
}
