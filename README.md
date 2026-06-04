# Floci Test - ローカル AWS エミュレータ実験環境

ローカル AWS エミュレータ [Floci](https://floci.io/) を **CLI** と **Ruby SDK** の両方から触って挙動を比較できる実験環境。

## 構成

| コンテナ | URL | 役割 |
|---------|-----|------|
| **aws-console** | http://localhost:8000 | `aws-cli` を実行するブラウザダッシュボード（Bun + Hono + HTMX + Tailwind v4） |
| **ruby-sdk-console** | http://localhost:8001 | `aws-sdk-ruby` / `pg` を実行するブラウザダッシュボード（Sinatra + HTMX + Tailwind v4） |
| **floci** | http://localhost:4566 | ローカル AWS エミュレータ |
| **adminer** | http://localhost:9000 | RDS (PostgreSQL) 確認用 GUI |

Floci は内部的に Docker-in-Docker で PostgreSQL / Redis コンテナを起動します。

## 起動

```bash
docker compose up --build
```

初回ビルドは aws-cli / Ruby gem のダウンロード等で 3〜5 分かかります。

起動後、以下を開く:

- CLI 動作確認: http://localhost:8000
- SDK 動作確認: http://localhost:8001

## aws-console（CLI）で使えるサービス

- **S3** — list/create/put/get/list-objects/delete/delete-bucket
- **SQS** — list/create/send/receive/delete-queue
- **SNS** — list/create/publish
- **Secrets Manager** — list/create/get
- **SSM Parameter Store** — put/get/list/delete
- **RDS** — describe/create/delete (PostgreSQL コンテナを実起動)
- **Lambda** — list/create (Node.js / Python)/invoke/get/delete（zip はその場で生成。実 Docker で実行）
- **EC2** — describe-instances/images/vpcs/subnets/security-groups/run-instances/terminate-instances（`RunInstances` は実 Docker コンテナを起動）
- **ECS (Fargate)** — list-clusters/create-cluster/register-task-definition/list-task-definitions/run-task/list-tasks/describe-tasks/delete-cluster
- **DynamoDB** — list/create/describe/put-item/get-item/scan/query/delete-table
- **ElastiCache (Valkey / Redis / Memcached)** — describe-cache-clusters/describe-replication-groups/create-replication-group (Valkey/Redis)/create-cache-cluster (Memcached)/delete（Floci は実 AWS と同様、Redis/Valkey は ReplicationGroup を使う）
- **Athena** — start-query-execution/list-query-executions/get-query-execution/get-query-results（Floci 側は mock モード：クエリ ID は発行されるが結果は空。list-data-catalogs / list-work-groups / list-databases は Floci 未対応）
- **Custom** — 任意の `aws ...` コマンドを直接実行

### Preset 内のテンプレート記法

| 記法 | 用途 |
|------|------|
| `{name}` | フォーム値を引数に展開（`s3://{bucket}` のように部分展開も可） |
| `@{name}` | フォーム値を一時テキストファイルに書き出して、そのファイルパスに展開（`--cli-input-json file://@{def}` 等） |
| `@zip{name,filename}` | フォーム値を `filename` というファイル名で一時ディレクトリに書き出して zip 化し、zip パスに展開（Lambda `--zip-file fileb://@zip{code,index.js}`） |
| `@out{name}` | 一時出力パスに展開し、コマンド実行後にそのファイルの中身を stdout 末尾に表示（`aws lambda invoke ... @out{response}`） |

## ruby-sdk-console（SDK）で使えるサービス

- **S3** — list_buckets / create_bucket / put_object / list_objects_v2 / get_object / delete_object
- **SQS** — list_queues / create_queue / send_message / receive_message
- **SNS** — list_topics / create_topic / publish
- **Secrets Manager** — list_secrets / create_secret / get_secret_value
- **SSM Parameter Store** — put_parameter / get_parameter
- **RDS** — Describe DB instances（生 XML を Nokogiri で解析）/ Connect & SELECT 1（`pg` gem で実 PostgreSQL に接続）
- **Lambda** — list_functions / create_function (Node.js / Python、`rubyzip` でメモリ上で zip 化) / invoke (payload を `JSON.parse(resp.payload.read)` で取得) / get_function / delete_function
- **EC2** — describe_instances / describe_images / describe_vpcs / describe_subnets / describe_security_groups / run_instances / terminate_instances
- **ECS (Fargate)** — list_clusters / create_cluster / register_task_definition (JSON を `JSON.parse(..., symbolize_names: true)` で Hash 化) / list_task_definitions / run_task / list_tasks / delete_cluster
- **DynamoDB** — list_tables / create_table / describe_table / put_item / get_item / scan / delete_table
- **ElastiCache** — describe_cache_clusters / describe_replication_groups / create_replication_group (Valkey) / delete_replication_group / **PING via Redis gem** (`describe_replication_groups` の endpoint へ `redis` gem で直接接続して PING / SET / GET / INFO まで実行)
- **Athena** — start_query_execution / list_query_executions / get_query_execution / get_query_results

> RDS の Describe は `aws-sdk-rds` が Floci の XML レスポンス（`<Subnets><member>...`）と一部互換性がないため、`Net::HTTP` + `Nokogiri` で生 XML をパースする実装にしています。それ以外のサービスは `aws-sdk-*` がそのまま使えます。
>
> Lambda の create_function は `rubyzip` でメモリ上に zip を組み立てて `code: { zip_file: <binary> }` 形式で渡しています（CLI Console と違って一時ファイル不要）。
>
> ElastiCache の Valkey/Redis は Replication Group 単位で作成し、`describe_replication_groups` で取れる `configuration_endpoint` (例: `floci:6380`) に `redis` gem で直接接続することで、Floci 内の実 Valkey/Redis コンテナまで疎通確認できます。

## init スクリプト

`init/setup-aws-resources.sh` は Floci 起動時に自動実行され、デモ用のリソースを作成します:

- S3: `floci-test-bucket` / `athena-results`（Athena 出力先）
- SQS: `floci-test-queue`
- SNS: `floci-test-topic`
- Secrets Manager: `floci-test/rails-secret`
- SSM Parameter Store: `/floci-test/app/environment`
- RDS: `floci-test-db`（PostgreSQL コンテナ）
- ElastiCache: `floci-test-cache`（Redis ReplicationGroup）/ `floci-test-valkey`（Valkey ReplicationGroup）
- DynamoDB: `floci-test-items`（サンプルアイテム入り）
- ECS: `floci-test-cluster` + Fargate task definition `floci-test-task`
- Lambda: `floci-test-lambda`（Node.js 20.x）

> ElastiCache / Lambda は `aws-console` コンテナの起動時に seed されます（前者は SigV4 ルーティング、後者は zip 生成が必要なため、`floci` コンテナ内の curl ベース init では実行できないため）。

## ホストから直接 aws-cli を使いたい場合

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

aws s3 ls
aws rds describe-db-instances
```

## クリーンアップ

```bash
docker compose down -v
```
