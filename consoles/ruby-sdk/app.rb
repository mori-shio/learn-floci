require "sinatra/base"
require "json"
require "aws-sdk-s3"
require "aws-sdk-sqs"
require "aws-sdk-sns"
require "aws-sdk-secretsmanager"
require "aws-sdk-ssm"
require "aws-sdk-rds"
require "aws-sdk-lambda"
require "aws-sdk-ec2"
require "aws-sdk-ecs"
require "aws-sdk-dynamodb"
require "aws-sdk-elasticache"
require "aws-sdk-athena"
require "nokogiri"
require "net/http"
require "uri"
require "pg"
require "zip"
require "redis"
require "stringio"

FLOCI_ENDPOINT = ENV.fetch("FLOCI_ENDPOINT", "http://floci:4566")

Aws.config.update(
  endpoint: FLOCI_ENDPOINT,
  region: "us-east-1",
  credentials: Aws::Credentials.new("test", "test"),
)

def s3_client
  Aws::S3::Client.new(force_path_style: true)
end

def sqs_client      = Aws::SQS::Client.new
def sns_client      = Aws::SNS::Client.new
def sm_client       = Aws::SecretsManager::Client.new
def ssm_client      = Aws::SSM::Client.new
def rds_client      = Aws::RDS::Client.new
def lambda_client   = Aws::Lambda::Client.new
def ec2_client      = Aws::EC2::Client.new
def ecs_client      = Aws::ECS::Client.new
def ddb_client      = Aws::DynamoDB::Client.new
def ec_client       = Aws::ElastiCache::Client.new
def athena_client   = Aws::Athena::Client.new

# 与えられたファイル名 → 内容のハッシュからメモリ上で zip を組み立てて
# binary String を返す (Lambda create_function の code: { zip_file: ... } 用)。
def build_zip(entries)
  buffer = Zip::OutputStream.write_buffer do |zos|
    entries.each do |name, content|
      zos.put_next_entry(name)
      zos.write(content)
    end
  end
  buffer.rewind
  buffer.read
end

# プリセット定義
# code_template の {name} はクライアントサイド JS で置換される（プレビュー用）。
# runner は実際のSDK実行ロジック（params を受け取り、結果のハッシュ／配列を返す）。
PRESETS = [
  # ─── S3 ───
  {
    id: "s3-list-buckets", service: "S3", label: "List buckets",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      s3 = Aws::S3::Client.new
      s3.list_buckets.buckets.map { |b| { name: b.name, created: b.creation_date } }
    RUBY
    runner: ->(_v) {
      s3_client.list_buckets.buckets.map { |b| { name: b.name, created: b.creation_date.iso8601 } }
    },
  },
  {
    id: "s3-mb", service: "S3", label: "Create bucket",
    description: nil,
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    code_template: <<~RUBY.strip,
      s3 = Aws::S3::Client.new
      s3.create_bucket(bucket: "{bucket}")
    RUBY
    runner: ->(v) { s3_client.create_bucket(bucket: v["bucket"]).to_h },
  },
  {
    id: "s3-put", service: "S3", label: "Put object",
    description: "Body はそのまま String として SDK に渡されます",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello-ruby.txt" },
      { name: "body", label: "Body", type: "textarea", default: "Hello from Ruby SDK!" },
    ],
    code_template: <<~RUBY.strip,
      s3 = Aws::S3::Client.new
      s3.put_object(
        bucket: "{bucket}",
        key:    "{key}",
        body:   "{body}"
      )
    RUBY
    runner: ->(v) {
      s3_client.put_object(bucket: v["bucket"], key: v["key"], body: v["body"]).to_h
    },
  },
  {
    id: "s3-ls", service: "S3", label: "List objects",
    description: nil,
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    code_template: <<~RUBY.strip,
      s3 = Aws::S3::Client.new
      s3.list_objects_v2(bucket: "{bucket}").contents.map { |o| { key: o.key, size: o.size } }
    RUBY
    runner: ->(v) {
      s3_client.list_objects_v2(bucket: v["bucket"]).contents.map { |o|
        { key: o.key, size: o.size, last_modified: o.last_modified.iso8601 }
      }
    },
  },
  {
    id: "s3-get", service: "S3", label: "Get object (content)",
    description: "ボディを文字列として取得",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello-ruby.txt" },
    ],
    code_template: <<~RUBY.strip,
      s3 = Aws::S3::Client.new
      s3.get_object(bucket: "{bucket}", key: "{key}").body.read
    RUBY
    runner: ->(v) {
      obj = s3_client.get_object(bucket: v["bucket"], key: v["key"])
      { content_type: obj.content_type, content_length: obj.content_length, body: obj.body.read }
    },
  },
  {
    id: "s3-rm", service: "S3", label: "Delete object",
    description: nil,
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello-ruby.txt" },
    ],
    code_template: <<~RUBY.strip,
      s3 = Aws::S3::Client.new
      s3.delete_object(bucket: "{bucket}", key: "{key}")
    RUBY
    runner: ->(v) { s3_client.delete_object(bucket: v["bucket"], key: v["key"]).to_h },
  },

  # ─── SQS ───
  {
    id: "sqs-list", service: "SQS", label: "List queues",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      sqs = Aws::SQS::Client.new
      sqs.list_queues.queue_urls
    RUBY
    runner: ->(_v) { sqs_client.list_queues.queue_urls },
  },
  {
    id: "sqs-create", service: "SQS", label: "Create queue",
    description: nil,
    fields: [{ name: "name", label: "Queue name", default: "demo-queue" }],
    code_template: <<~RUBY.strip,
      sqs = Aws::SQS::Client.new
      sqs.create_queue(queue_name: "{name}").queue_url
    RUBY
    runner: ->(v) { { queue_url: sqs_client.create_queue(queue_name: v["name"]).queue_url } },
  },
  {
    id: "sqs-send", service: "SQS", label: "Send message",
    description: nil,
    fields: [
      { name: "url", label: "Queue URL", default: "http://floci:4566/000000000000/demo-queue" },
      { name: "body", label: "Body", default: "hello from ruby" },
    ],
    code_template: <<~RUBY.strip,
      sqs = Aws::SQS::Client.new
      sqs.send_message(queue_url: "{url}", message_body: "{body}")
    RUBY
    runner: ->(v) {
      sqs_client.send_message(queue_url: v["url"], message_body: v["body"]).to_h
    },
  },
  {
    id: "sqs-receive", service: "SQS", label: "Receive messages",
    description: nil,
    fields: [
      { name: "url", label: "Queue URL", default: "http://floci:4566/000000000000/demo-queue" },
      { name: "max", label: "Max", default: "10", type: "number" },
    ],
    code_template: <<~RUBY.strip,
      sqs = Aws::SQS::Client.new
      sqs.receive_message(queue_url: "{url}", max_number_of_messages: {max}).messages
    RUBY
    runner: ->(v) {
      sqs_client.receive_message(
        queue_url: v["url"],
        max_number_of_messages: v["max"].to_i,
        wait_time_seconds: 1,
      ).messages.map { |m| { id: m.message_id, body: m.body } }
    },
  },

  # ─── SNS ───
  {
    id: "sns-list", service: "SNS", label: "List topics",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      sns = Aws::SNS::Client.new
      sns.list_topics.topics.map(&:topic_arn)
    RUBY
    runner: ->(_v) { sns_client.list_topics.topics.map(&:topic_arn) },
  },
  {
    id: "sns-create", service: "SNS", label: "Create topic",
    description: nil,
    fields: [{ name: "name", label: "Topic name", default: "demo-topic" }],
    code_template: <<~RUBY.strip,
      sns = Aws::SNS::Client.new
      sns.create_topic(name: "{name}").topic_arn
    RUBY
    runner: ->(v) { { topic_arn: sns_client.create_topic(name: v["name"]).topic_arn } },
  },
  {
    id: "sns-publish", service: "SNS", label: "Publish message",
    description: nil,
    fields: [
      { name: "arn", label: "Topic ARN", default: "arn:aws:sns:us-east-1:000000000000:demo-topic" },
      { name: "message", label: "Message", default: "hello from ruby" },
    ],
    code_template: <<~RUBY.strip,
      sns = Aws::SNS::Client.new
      sns.publish(topic_arn: "{arn}", message: "{message}")
    RUBY
    runner: ->(v) {
      sns_client.publish(topic_arn: v["arn"], message: v["message"]).to_h
    },
  },

  # ─── Secrets Manager ───
  {
    id: "sm-list", service: "Secrets", label: "List secrets",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      sm = Aws::SecretsManager::Client.new
      sm.list_secrets.secret_list.map(&:name)
    RUBY
    runner: ->(_v) { sm_client.list_secrets.secret_list.map(&:name) },
  },
  {
    id: "sm-create", service: "Secrets", label: "Create secret",
    description: nil,
    fields: [
      { name: "name", label: "Name", default: "demo/ruby-secret" },
      { name: "value", label: "Secret string", default: '{"foo":"bar"}' },
    ],
    code_template: <<~RUBY.strip,
      sm = Aws::SecretsManager::Client.new
      sm.create_secret(name: "{name}", secret_string: "{value}")
    RUBY
    runner: ->(v) {
      sm_client.create_secret(name: v["name"], secret_string: v["value"]).to_h
    },
  },
  {
    id: "sm-get", service: "Secrets", label: "Get secret value",
    description: nil,
    fields: [{ name: "name", label: "Secret ID", default: "demo/ruby-secret" }],
    code_template: <<~RUBY.strip,
      sm = Aws::SecretsManager::Client.new
      sm.get_secret_value(secret_id: "{name}").secret_string
    RUBY
    runner: ->(v) {
      { secret_string: sm_client.get_secret_value(secret_id: v["name"]).secret_string }
    },
  },

  # ─── SSM ───
  {
    id: "ssm-put", service: "SSM", label: "Put parameter",
    description: nil,
    fields: [
      { name: "name", label: "Name", default: "/demo/ruby" },
      { name: "value", label: "Value", default: "hello" },
    ],
    code_template: <<~RUBY.strip,
      ssm = Aws::SSM::Client.new
      ssm.put_parameter(
        name: "{name}", value: "{value}", type: "String", overwrite: true
      )
    RUBY
    runner: ->(v) {
      ssm_client.put_parameter(
        name: v["name"], value: v["value"], type: "String", overwrite: true,
      ).to_h
    },
  },
  {
    id: "ssm-get", service: "SSM", label: "Get parameter",
    description: nil,
    fields: [{ name: "name", label: "Name", default: "/demo/ruby" }],
    code_template: <<~RUBY.strip,
      ssm = Aws::SSM::Client.new
      ssm.get_parameter(name: "{name}").parameter.value
    RUBY
    runner: ->(v) {
      p = ssm_client.get_parameter(name: v["name"]).parameter
      { name: p.name, value: p.value, type: p.type }
    },
  },

  # ─── RDS ───
  # NOTE: aws-sdk-rds の XML パーサは Floci の RDS XML スキーマ
  # (例: <Subnets><member>...) と一部互換性がないため、ここでは
  # `Aws::RDS::Client#describe_db_instances` のレスポンス XML を
  # Net::HTTP + Nokogiri で直接パースして endpoint を取り出している。
  # 接続は pg gem で実施しており、SDK の credential 設定機構は共通。
  {
    id: "rds-describe", service: "RDS", label: "Describe DB instances (raw XML)",
    description: "aws-sdk-rds の XML 解釈は一部 Floci 非互換のため Net::HTTP + Nokogiri で生 XML を解析",
    fields: [],
    code_template: <<~RUBY.strip,
      uri = URI("#{FLOCI_ENDPOINT}/")
      res = Net::HTTP.post_form(uri,
        "Action" => "DescribeDBInstances", "Version" => "2014-10-31")
      doc = Nokogiri::XML(res.body).remove_namespaces!
      doc.xpath("//DBInstance").map { |i|
        {
          id: i.at_xpath("DBInstanceIdentifier")&.text,
          status: i.at_xpath("DBInstanceStatus")&.text,
          engine: i.at_xpath("Engine")&.text,
          endpoint: "\#{i.at_xpath('Endpoint/Address')&.text}:\#{i.at_xpath('Endpoint/Port')&.text}",
        }
      }
    RUBY
    runner: ->(_v) {
      uri = URI("#{FLOCI_ENDPOINT}/")
      res = Net::HTTP.post_form(uri, "Action" => "DescribeDBInstances", "Version" => "2014-10-31")
      doc = Nokogiri::XML(res.body).remove_namespaces!
      doc.xpath("//DBInstance").map { |i|
        {
          id: i.at_xpath("DBInstanceIdentifier")&.text,
          status: i.at_xpath("DBInstanceStatus")&.text,
          engine: i.at_xpath("Engine")&.text,
          db_name: i.at_xpath("DBName")&.text,
          endpoint: "#{i.at_xpath('Endpoint/Address')&.text}:#{i.at_xpath('Endpoint/Port')&.text}",
        }
      }
    },
  },
  {
    id: "rds-connect", service: "RDS", label: "Connect & SELECT 1",
    description: "pg gem で実 PostgreSQL コンテナに接続して SELECT を実行",
    fields: [
      { name: "host", label: "Host", default: "floci" },
      { name: "port", label: "Port", default: "7001" },
      { name: "user", label: "User", default: "postgres" },
      { name: "password", label: "Password", default: "password" },
      { name: "dbname", label: "Database", default: "floci_test_dev" },
    ],
    code_template: <<~RUBY.strip,
      conn = PG.connect(
        host: "{host}", port: {port},
        user: "{user}", password: "{password}", dbname: "{dbname}"
      )
      conn.exec("SELECT 1 AS one, NOW() AS now, version() AS version").to_a
    RUBY
    runner: ->(v) {
      conn = PG.connect(
        host: v["host"], port: v["port"].to_i,
        user: v["user"], password: v["password"], dbname: v["dbname"],
      )
      rows = conn.exec("SELECT 1 AS one, NOW() AS now, version() AS version").to_a
      conn.close
      { endpoint: "#{v["host"]}:#{v["port"]}", rows: rows }
    },
  },

  # ─── Lambda ───
  {
    id: "lambda-list", service: "Lambda", label: "List functions",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      lambda = Aws::Lambda::Client.new
      lambda.list_functions.functions.map { |f|
        { name: f.function_name, runtime: f.runtime, handler: f.handler }
      }
    RUBY
    runner: ->(_v) {
      lambda_client.list_functions.functions.map { |f|
        { name: f.function_name, runtime: f.runtime, handler: f.handler, last_modified: f.last_modified }
      }
    },
  },
  {
    id: "lambda-create-node", service: "Lambda", label: "Create function (Node.js)",
    description: "rubyzip でメモリ上に zip を組み立てて code: { zip_file: ... } で渡します (handler は index.handler 固定)",
    fields: [
      { name: "name", label: "Function name", default: "demo-fn-ruby-node" },
      {
        name: "code", label: "index.js", type: "textarea",
        default: 'exports.handler = async (event) => {\n  return { message: "Hello from Floci (Ruby SDK + Node)!", event };\n};',
      },
    ],
    code_template: <<~'RUBY'.strip,
      zip_bytes = Zip::OutputStream.write_buffer { |zos|
        zos.put_next_entry("index.js")
        zos.write("{code}")
      }.tap(&:rewind).read

      lambda = Aws::Lambda::Client.new
      lambda.create_function(
        function_name: "{name}",
        runtime:       "nodejs20.x",
        handler:       "index.handler",
        role:          "arn:aws:iam::000000000000:role/lambda-role",
        code:          { zip_file: zip_bytes },
      )
    RUBY
    runner: ->(v) {
      zip_bytes = build_zip("index.js" => v["code"])
      resp = lambda_client.create_function(
        function_name: v["name"],
        runtime: "nodejs20.x",
        handler: "index.handler",
        role: "arn:aws:iam::000000000000:role/lambda-role",
        code: { zip_file: zip_bytes },
      )
      { function_arn: resp.function_arn, runtime: resp.runtime, handler: resp.handler, code_size: resp.code_size }
    },
  },
  {
    id: "lambda-create-python", service: "Lambda", label: "Create function (Python)",
    description: "rubyzip でメモリ上に zip を組み立てて code: { zip_file: ... } で渡します (handler は lambda_function.lambda_handler 固定)",
    fields: [
      { name: "name", label: "Function name", default: "demo-fn-ruby-py" },
      {
        name: "code", label: "lambda_function.py", type: "textarea",
        default: "def lambda_handler(event, context):\n    return {\"message\": \"Hello from Floci (Ruby SDK + Python)!\", \"event\": event}",
      },
    ],
    code_template: <<~'RUBY'.strip,
      zip_bytes = Zip::OutputStream.write_buffer { |zos|
        zos.put_next_entry("lambda_function.py")
        zos.write("{code}")
      }.tap(&:rewind).read

      lambda = Aws::Lambda::Client.new
      lambda.create_function(
        function_name: "{name}",
        runtime:       "python3.12",
        handler:       "lambda_function.lambda_handler",
        role:          "arn:aws:iam::000000000000:role/lambda-role",
        code:          { zip_file: zip_bytes },
      )
    RUBY
    runner: ->(v) {
      zip_bytes = build_zip("lambda_function.py" => v["code"])
      resp = lambda_client.create_function(
        function_name: v["name"],
        runtime: "python3.12",
        handler: "lambda_function.lambda_handler",
        role: "arn:aws:iam::000000000000:role/lambda-role",
        code: { zip_file: zip_bytes },
      )
      { function_arn: resp.function_arn, runtime: resp.runtime, handler: resp.handler, code_size: resp.code_size }
    },
  },
  {
    id: "lambda-invoke", service: "Lambda", label: "Invoke function",
    description: "payload は JSON 文字列。戻り値は response.payload.read で取得",
    fields: [
      { name: "name", label: "Function name", default: "floci-test-lambda" },
      { name: "payload", label: "Payload (JSON)", default: '{"hello":"floci ruby"}' },
    ],
    code_template: <<~RUBY.strip,
      lambda = Aws::Lambda::Client.new
      resp = lambda.invoke(function_name: "{name}", payload: '{payload}')
      { status: resp.status_code, body: JSON.parse(resp.payload.read) }
    RUBY
    runner: ->(v) {
      resp = lambda_client.invoke(function_name: v["name"], payload: v["payload"])
      body_raw = resp.payload.read
      body = (JSON.parse(body_raw) rescue body_raw)
      {
        status_code: resp.status_code,
        executed_version: resp.executed_version,
        function_error: resp.function_error,
        body: body,
      }
    },
  },
  {
    id: "lambda-get", service: "Lambda", label: "Get function",
    description: nil,
    fields: [{ name: "name", label: "Function name", default: "floci-test-lambda" }],
    code_template: <<~RUBY.strip,
      lambda = Aws::Lambda::Client.new
      lambda.get_function(function_name: "{name}").to_h
    RUBY
    runner: ->(v) {
      r = lambda_client.get_function(function_name: v["name"])
      {
        configuration: {
          name: r.configuration.function_name,
          arn: r.configuration.function_arn,
          runtime: r.configuration.runtime,
          handler: r.configuration.handler,
          code_size: r.configuration.code_size,
          state: r.configuration.state,
        },
        code: { repository_type: r.code.repository_type, location: r.code.location },
      }
    },
  },
  {
    id: "lambda-delete", service: "Lambda", label: "Delete function",
    description: nil,
    fields: [{ name: "name", label: "Function name", default: "demo-fn-ruby-node" }],
    code_template: <<~RUBY.strip,
      lambda = Aws::Lambda::Client.new
      lambda.delete_function(function_name: "{name}")
    RUBY
    runner: ->(v) {
      lambda_client.delete_function(function_name: v["name"]).to_h
      { deleted: v["name"] }
    },
  },

  # ─── EC2 ───
  {
    id: "ec2-describe-instances", service: "EC2", label: "Describe instances",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.describe_instances.reservations.flat_map { |r|
        r.instances.map { |i| { id: i.instance_id, state: i.state.name, type: i.instance_type } }
      }
    RUBY
    runner: ->(_v) {
      ec2_client.describe_instances.reservations.flat_map { |r|
        r.instances.map { |i|
          { id: i.instance_id, state: i.state.name, type: i.instance_type, ami: i.image_id }
        }
      }
    },
  },
  {
    id: "ec2-describe-images", service: "EC2", label: "Describe images (AMIs)",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.describe_images.images.map { |i| { id: i.image_id, name: i.name } }
    RUBY
    runner: ->(_v) {
      ec2_client.describe_images.images.map { |i|
        { id: i.image_id, name: i.name, arch: i.architecture, state: i.state }
      }
    },
  },
  {
    id: "ec2-describe-vpcs", service: "EC2", label: "Describe VPCs",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.describe_vpcs.vpcs.map { |v| { id: v.vpc_id, cidr: v.cidr_block, default: v.is_default } }
    RUBY
    runner: ->(_v) {
      ec2_client.describe_vpcs.vpcs.map { |v|
        { id: v.vpc_id, cidr: v.cidr_block, default: v.is_default, state: v.state }
      }
    },
  },
  {
    id: "ec2-describe-subnets", service: "EC2", label: "Describe subnets",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.describe_subnets.subnets.map { |s| { id: s.subnet_id, az: s.availability_zone, cidr: s.cidr_block } }
    RUBY
    runner: ->(_v) {
      ec2_client.describe_subnets.subnets.map { |s|
        { id: s.subnet_id, vpc: s.vpc_id, az: s.availability_zone, cidr: s.cidr_block }
      }
    },
  },
  {
    id: "ec2-describe-sg", service: "EC2", label: "Describe security groups",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.describe_security_groups.security_groups.map { |s|
        { id: s.group_id, name: s.group_name, vpc: s.vpc_id }
      }
    RUBY
    runner: ->(_v) {
      ec2_client.describe_security_groups.security_groups.map { |s|
        { id: s.group_id, name: s.group_name, vpc: s.vpc_id, desc: s.description }
      }
    },
  },
  {
    id: "ec2-run-instances", service: "EC2", label: "Run instances",
    description: "Floci の EC2 は実 Docker コンテナを起動します",
    fields: [
      { name: "ami", label: "AMI ID", default: "ami-0abcdef1234567891" },
      { name: "type", label: "Instance type", default: "t3.micro" },
      { name: "count", label: "Count", default: "1", type: "number" },
    ],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.run_instances(
        image_id: "{ami}", instance_type: "{type}",
        min_count: {count}, max_count: {count},
      ).instances.map { |i| i.instance_id }
    RUBY
    runner: ->(v) {
      cnt = v["count"].to_i
      ids = ec2_client.run_instances(
        image_id: v["ami"], instance_type: v["type"],
        min_count: cnt, max_count: cnt,
      ).instances.map(&:instance_id)
      { instance_ids: ids }
    },
  },
  {
    id: "ec2-terminate-instances", service: "EC2", label: "Terminate instances",
    description: nil,
    fields: [{ name: "id", label: "Instance ID", default: "i-xxxxxxxxxxxxxxxxx" }],
    code_template: <<~RUBY.strip,
      ec2 = Aws::EC2::Client.new
      ec2.terminate_instances(instance_ids: ["{id}"])
    RUBY
    runner: ->(v) {
      ec2_client.terminate_instances(instance_ids: [v["id"]]).terminating_instances.map { |t|
        { id: t.instance_id, current_state: t.current_state.name, previous_state: t.previous_state.name }
      }
    },
  },

  # ─── ECS (Fargate) ───
  {
    id: "ecs-list-clusters", service: "ECS", label: "List clusters",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      ecs.list_clusters.cluster_arns
    RUBY
    runner: ->(_v) { ecs_client.list_clusters.cluster_arns },
  },
  {
    id: "ecs-create-cluster", service: "ECS", label: "Create cluster",
    description: nil,
    fields: [{ name: "name", label: "Cluster name", default: "demo-cluster" }],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      ecs.create_cluster(cluster_name: "{name}").cluster
    RUBY
    runner: ->(v) {
      c = ecs_client.create_cluster(cluster_name: v["name"]).cluster
      { name: c.cluster_name, arn: c.cluster_arn, status: c.status }
    },
  },
  {
    id: "ecs-register-task-def", service: "ECS", label: "Register task definition (Fargate)",
    description: "JSON は JSON.parse(text, symbolize_names: true) で Hash 化して渡します",
    fields: [
      {
        name: "def", label: "Task definition JSON", type: "textarea",
        default: '{"family":"demo-task","networkMode":"awsvpc","requiresCompatibilities":["FARGATE"],"cpu":"256","memory":"512","containerDefinitions":[{"name":"app","image":"public.ecr.aws/nginx/nginx:alpine","essential":true,"portMappings":[{"containerPort":80,"protocol":"tcp"}]}]}',
      },
    ],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      params = JSON.parse(<<~JSON, symbolize_names: true)
        {def}
      JSON
      ecs.register_task_definition(params).task_definition
    RUBY
    runner: ->(v) {
      params = JSON.parse(v["def"], symbolize_names: true)
      td = ecs_client.register_task_definition(params).task_definition
      { family: td.family, revision: td.revision, arn: td.task_definition_arn, status: td.status }
    },
  },
  {
    id: "ecs-list-task-defs", service: "ECS", label: "List task definitions",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      ecs.list_task_definitions.task_definition_arns
    RUBY
    runner: ->(_v) { ecs_client.list_task_definitions.task_definition_arns },
  },
  {
    id: "ecs-run-task", service: "ECS", label: "Run task (Fargate)",
    description: "subnet-id / sg-id は describe_subnets / describe_security_groups で確認",
    fields: [
      { name: "cluster", label: "Cluster name", default: "demo-cluster" },
      { name: "taskdef", label: "Task definition", default: "demo-task" },
      { name: "subnet", label: "Subnet ID", default: "subnet-xxx" },
      { name: "sg", label: "Security group ID", default: "sg-xxx" },
    ],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      ecs.run_task(
        cluster: "{cluster}",
        task_definition: "{taskdef}",
        launch_type: "FARGATE",
        network_configuration: {
          awsvpc_configuration: {
            subnets: ["{subnet}"],
            security_groups: ["{sg}"],
            assign_public_ip: "ENABLED",
          },
        },
      ).tasks.map(&:task_arn)
    RUBY
    runner: ->(v) {
      arns = ecs_client.run_task(
        cluster: v["cluster"],
        task_definition: v["taskdef"],
        launch_type: "FARGATE",
        network_configuration: {
          awsvpc_configuration: {
            subnets: [v["subnet"]],
            security_groups: [v["sg"]],
            assign_public_ip: "ENABLED",
          },
        },
      ).tasks.map(&:task_arn)
      { task_arns: arns }
    },
  },
  {
    id: "ecs-list-tasks", service: "ECS", label: "List tasks",
    description: nil,
    fields: [{ name: "cluster", label: "Cluster name", default: "demo-cluster" }],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      ecs.list_tasks(cluster: "{cluster}").task_arns
    RUBY
    runner: ->(v) { ecs_client.list_tasks(cluster: v["cluster"]).task_arns },
  },
  {
    id: "ecs-delete-cluster", service: "ECS", label: "Delete cluster",
    description: nil,
    fields: [{ name: "name", label: "Cluster name", default: "demo-cluster" }],
    code_template: <<~RUBY.strip,
      ecs = Aws::ECS::Client.new
      ecs.delete_cluster(cluster: "{name}")
    RUBY
    runner: ->(v) {
      c = ecs_client.delete_cluster(cluster: v["name"]).cluster
      { name: c.cluster_name, status: c.status }
    },
  },

  # ─── DynamoDB ───
  {
    id: "ddb-list", service: "DynamoDB", label: "List tables",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.list_tables.table_names
    RUBY
    runner: ->(_v) { ddb_client.list_tables.table_names },
  },
  {
    id: "ddb-create", service: "DynamoDB", label: "Create table (PAY_PER_REQUEST)",
    description: nil,
    fields: [
      { name: "name", label: "Table name", default: "demo-table" },
      { name: "pk", label: "Partition key name", default: "id" },
      { name: "pktype", label: "Partition key type (S/N/B)", default: "S" },
    ],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.create_table(
        table_name: "{name}",
        attribute_definitions: [{ attribute_name: "{pk}", attribute_type: "{pktype}" }],
        key_schema:            [{ attribute_name: "{pk}", key_type: "HASH" }],
        billing_mode: "PAY_PER_REQUEST",
      )
    RUBY
    runner: ->(v) {
      td = ddb_client.create_table(
        table_name: v["name"],
        attribute_definitions: [{ attribute_name: v["pk"], attribute_type: v["pktype"] }],
        key_schema: [{ attribute_name: v["pk"], key_type: "HASH" }],
        billing_mode: "PAY_PER_REQUEST",
      ).table_description
      { name: td.table_name, arn: td.table_arn, status: td.table_status }
    },
  },
  {
    id: "ddb-describe", service: "DynamoDB", label: "Describe table",
    description: nil,
    fields: [{ name: "name", label: "Table name", default: "floci-test-items" }],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.describe_table(table_name: "{name}").table
    RUBY
    runner: ->(v) {
      t = ddb_client.describe_table(table_name: v["name"]).table
      {
        name: t.table_name, status: t.table_status, item_count: t.item_count,
        size_bytes: t.table_size_bytes,
        keys: t.key_schema.map { |k| { name: k.attribute_name, type: k.key_type } },
      }
    },
  },
  {
    id: "ddb-put", service: "DynamoDB", label: "Put item",
    description: "aws-sdk-dynamodb は Ruby Hash を受け取れるので型タグ不要 (例: {\"id\":\"a\",\"value\":\"hello\"})",
    fields: [
      { name: "name", label: "Table name", default: "floci-test-items" },
      { name: "item", label: "Item (JSON)", type: "textarea",
        default: '{"id":"ruby-item-1","value":"hello from ruby"}' },
    ],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.put_item(table_name: "{name}", item: JSON.parse(<<~JSON))
        {item}
      JSON
    RUBY
    runner: ->(v) {
      item = JSON.parse(v["item"])
      ddb_client.put_item(table_name: v["name"], item: item).to_h
      { put: item }
    },
  },
  {
    id: "ddb-get", service: "DynamoDB", label: "Get item",
    description: nil,
    fields: [
      { name: "name", label: "Table name", default: "floci-test-items" },
      { name: "key", label: "Key (JSON)", default: '{"id":"ruby-item-1"}' },
    ],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.get_item(table_name: "{name}", key: JSON.parse('{key}')).item
    RUBY
    runner: ->(v) {
      key = JSON.parse(v["key"])
      { item: ddb_client.get_item(table_name: v["name"], key: key).item }
    },
  },
  {
    id: "ddb-scan", service: "DynamoDB", label: "Scan table",
    description: nil,
    fields: [{ name: "name", label: "Table name", default: "floci-test-items" }],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.scan(table_name: "{name}").items
    RUBY
    runner: ->(v) {
      r = ddb_client.scan(table_name: v["name"])
      { count: r.count, scanned: r.scanned_count, items: r.items }
    },
  },
  {
    id: "ddb-delete", service: "DynamoDB", label: "Delete table",
    description: nil,
    fields: [{ name: "name", label: "Table name", default: "demo-table" }],
    code_template: <<~RUBY.strip,
      ddb = Aws::DynamoDB::Client.new
      ddb.delete_table(table_name: "{name}")
    RUBY
    runner: ->(v) {
      td = ddb_client.delete_table(table_name: v["name"]).table_description
      { name: td.table_name, status: td.table_status }
    },
  },

  # ─── ElastiCache ───
  {
    id: "ec-describe", service: "ElastiCache", label: "Describe cache clusters",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec = Aws::ElastiCache::Client.new
      ec.describe_cache_clusters.cache_clusters.map { |c|
        { id: c.cache_cluster_id, engine: c.engine, status: c.cache_cluster_status }
      }
    RUBY
    runner: ->(_v) {
      ec_client.describe_cache_clusters.cache_clusters.map { |c|
        { id: c.cache_cluster_id, engine: c.engine, status: c.cache_cluster_status }
      }
    },
  },
  {
    id: "ec-describe-rg", service: "ElastiCache", label: "Describe replication groups",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      ec = Aws::ElastiCache::Client.new
      ec.describe_replication_groups.replication_groups.map { |rg|
        {
          id: rg.replication_group_id,
          status: rg.status,
          endpoint: "\#{rg.configuration_endpoint&.address}:\#{rg.configuration_endpoint&.port}",
        }
      }
    RUBY
    runner: ->(_v) {
      ec_client.describe_replication_groups.replication_groups.map { |rg|
        ep = rg.configuration_endpoint
        {
          id: rg.replication_group_id,
          description: rg.description,
          status: rg.status,
          endpoint: ep ? "#{ep.address}:#{ep.port}" : nil,
        }
      }
    },
  },
  {
    id: "ec-create-valkey", service: "ElastiCache", label: "Create replication group (Valkey)",
    description: "Floci (実 AWS と同じ) は Redis/Valkey を CreateReplicationGroup で作成",
    fields: [
      { name: "id", label: "Replication group ID", default: "demo-ruby-valkey" },
      { name: "desc", label: "Description", default: "Demo Valkey from Ruby SDK" },
    ],
    code_template: <<~RUBY.strip,
      ec = Aws::ElastiCache::Client.new
      ec.create_replication_group(
        replication_group_id:          "{id}",
        replication_group_description: "{desc}",
        engine:                        "valkey",
        num_cache_clusters:            1,
        cache_node_type:               "cache.t3.micro",
      )
    RUBY
    runner: ->(v) {
      rg = ec_client.create_replication_group(
        replication_group_id: v["id"],
        replication_group_description: v["desc"],
        engine: "valkey",
        num_cache_clusters: 1,
        cache_node_type: "cache.t3.micro",
      ).replication_group
      { id: rg.replication_group_id, status: rg.status, description: rg.description }
    },
  },
  {
    id: "ec-delete-rg", service: "ElastiCache", label: "Delete replication group",
    description: nil,
    fields: [{ name: "id", label: "Replication group ID", default: "demo-ruby-valkey" }],
    code_template: <<~RUBY.strip,
      ec = Aws::ElastiCache::Client.new
      ec.delete_replication_group(replication_group_id: "{id}")
    RUBY
    runner: ->(v) {
      rg = ec_client.delete_replication_group(replication_group_id: v["id"]).replication_group
      { id: rg.replication_group_id, status: rg.status }
    },
  },
  {
    id: "ec-ping-valkey", service: "ElastiCache", label: "PING via Redis gem",
    description: "describe_replication_groups で取得した endpoint へ redis gem で接続し、PING / SET / GET を実行 (Valkey は Redis 互換プロトコル)",
    fields: [
      { name: "id", label: "Replication group ID", default: "floci-test-valkey" },
      { name: "key", label: "Test key", default: "ruby-demo" },
      { name: "value", label: "Test value", default: "hello floci" },
    ],
    code_template: <<~RUBY.strip,
      ec = Aws::ElastiCache::Client.new
      ep = ec.describe_replication_groups(replication_group_id: "{id}")
            .replication_groups.first.configuration_endpoint
      r = Redis.new(host: ep.address, port: ep.port)
      r.set("{key}", "{value}")
      { ping: r.ping, get: r.get("{key}"), info: r.info["redis_version"] || r.info["valkey_version"] }
    RUBY
    runner: ->(v) {
      ep = ec_client.describe_replication_groups(replication_group_id: v["id"])
                    .replication_groups.first&.configuration_endpoint
      raise "no endpoint for replication group #{v["id"]}" unless ep
      r = Redis.new(host: ep.address, port: ep.port, timeout: 3)
      r.set(v["key"], v["value"])
      info = r.info
      ret = {
        endpoint: "#{ep.address}:#{ep.port}",
        ping: r.ping,
        set: { key: v["key"], value: v["value"] },
        get: r.get(v["key"]),
        version: info["valkey_version"] || info["redis_version"],
        server_mode: info["redis_mode"] || info["server_mode"],
      }
      r.close
      ret
    },
  },

  # ─── Athena ───
  # NOTE: Floci の Athena は mock mode で結果は空。list_data_catalogs / list_work_groups
  # / list_databases は Floci 未対応。
  {
    id: "athena-start-query", service: "Athena", label: "Start query execution",
    description: "クエリ ID は発行されるが get_query_results は空 (Floci mock mode)。OutputLocation の S3 バケットを先に作っておく",
    fields: [
      { name: "query", label: "SQL", type: "textarea", default: "SELECT 1" },
      { name: "output", label: "Output location", default: "s3://athena-results/" },
      { name: "database", label: "Database", default: "default" },
    ],
    code_template: <<~RUBY.strip,
      athena = Aws::Athena::Client.new
      athena.start_query_execution(
        query_string: "{query}",
        result_configuration: { output_location: "{output}" },
        query_execution_context: { database: "{database}" },
      ).query_execution_id
    RUBY
    runner: ->(v) {
      id = athena_client.start_query_execution(
        query_string: v["query"],
        result_configuration: { output_location: v["output"] },
        query_execution_context: { database: v["database"] },
      ).query_execution_id
      { query_execution_id: id }
    },
  },
  {
    id: "athena-list-executions", service: "Athena", label: "List query executions",
    description: nil, fields: [],
    code_template: <<~RUBY.strip,
      athena = Aws::Athena::Client.new
      athena.list_query_executions.query_execution_ids
    RUBY
    runner: ->(_v) { athena_client.list_query_executions.query_execution_ids },
  },
  {
    id: "athena-get-execution", service: "Athena", label: "Get query execution",
    description: nil,
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
    code_template: <<~RUBY.strip,
      athena = Aws::Athena::Client.new
      athena.get_query_execution(query_execution_id: "{id}").query_execution
    RUBY
    runner: ->(v) {
      qe = athena_client.get_query_execution(query_execution_id: v["id"]).query_execution
      {
        id: qe.query_execution_id,
        query: qe.query,
        state: qe.status.state,
        output_location: qe.result_configuration.output_location,
        database: qe.query_execution_context&.database,
        work_group: qe.work_group,
      }
    },
  },
  {
    id: "athena-get-results", service: "Athena", label: "Get query results",
    description: "Floci mock mode のため結果セットは空",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
    code_template: <<~RUBY.strip,
      athena = Aws::Athena::Client.new
      athena.get_query_results(query_execution_id: "{id}").result_set
    RUBY
    runner: ->(v) {
      rs = athena_client.get_query_results(query_execution_id: v["id"]).result_set
      {
        column_info: rs.result_set_metadata.column_info.map { |c| { name: c.name, type: c.type } },
        rows: rs.rows.map { |row| row.data.map(&:var_char_value) },
      }
    },
  },
].freeze

SERVICES = PRESETS.map { |p| p[:service] }.uniq.freeze
FIRST_OF_SERVICE = SERVICES.each_with_object({}) { |s, h|
  h[s] = PRESETS.find { |p| p[:service] == s }[:id]
}.freeze

class App < Sinatra::Base
  set :bind, "0.0.0.0"
  set :port, 8001
  set :show_exceptions, false
  set :raise_errors, false

  helpers do
    def h(s)
      Rack::Utils.escape_html(s.to_s)
    end

    def render_card(p)
      erb :_card, locals: { p: p }, layout: false
    end
  end

  get "/" do
    erb :index
  end

  post "/run" do
    preset_id = params["_preset"]
    preset = PRESETS.find { |p| p[:id] == preset_id }
    halt 404, "unknown preset" unless preset

    values = params.reject { |k, _| k.start_with?("_") }

    start = Time.now
    error = nil
    result = nil
    begin
      result = preset[:runner].call(values)
    rescue StandardError, NotImplementedError => e
      bt = e.backtrace&.first(5)&.join("\n") || ""
      error = "#{e.class}: #{e.message.empty? ? "(no message)" : e.message}\n#{bt}"
    end
    duration_ms = ((Time.now - start) * 1000).to_i

    output =
      if error
        ""
      else
        JSON.pretty_generate(result)
      end

    code = preset[:code_template].gsub(/\{(\w+)\}/) { values[$1].to_s }

    erb :_history_entry, locals: {
      label: "#{preset[:service]} / #{preset[:label]}",
      code: code,
      output: output,
      error: error,
      duration_ms: duration_ms,
    }, layout: false
  end

end

App.run! if __FILE__ == $PROGRAM_NAME

