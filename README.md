# learn-floci

ローカル AWS エミュレータ [**Floci**](https://floci.io/) を **`aws-cli`** と **`aws-sdk-ruby`** の両面から触って、挙動・差分・癖を比較しながら学ぶための実験環境。

[Floci](https://floci.io/) は GraalVM ネイティブビルドの軽量 AWS エミュレータ (MIT、51 サービス、24ms 起動 / 13MiB アイドル、`http://localhost:4566` 統一エンドポイント)。Lambda / RDS / ElastiCache / MSK / ECS / EC2 / EKS / OpenSearch 等は実 Docker コンテナで動作する。LocalStack のドロップイン互換 (同じポート 4566、認証トークン不要)。

---

## アーキテクチャ

```mermaid
graph LR
  subgraph host["ホスト (localhost)"]
    Browser[Browser]
  end

  subgraph compose["docker compose"]
    AC["aws-console:8000<br/>Bun + Hono + HTMX<br/>(aws-cli)"]
    RC["ruby-sdk-console:8001<br/>Sinatra + HTMX<br/>(aws-sdk-ruby + pg + rubyzip + redis)"]
    AD["adminer:9000<br/>PostgreSQL GUI"]
    F["floci:4566<br/>(GraalVM native)"]
  end

  subgraph dind["Floci が起動する実コンテナ群 (DinD)"]
    Lambda["Lambda runtime<br/>(node20 / py3.12)"]
    RDS["PostgreSQL<br/>(:7001+ proxy)"]
    EC["Valkey / Redis<br/>(:6379+ proxy)"]
    EC2["EC2 instances"]
    ECS["ECS tasks (Fargate)"]
  end

  Browser --> AC
  Browser --> RC
  Browser --> AD
  AC -- "AWS API" --> F
  RC -- "AWS API" --> F
  RC -- "pg gem" --> RDS
  RC -- "redis gem" --> EC
  AD --> RDS
  F -- "/var/run/docker.sock" --> Lambda
  F --> RDS
  F --> EC
  F --> EC2
  F --> ECS
```

| コンテナ | URL | スタック | 役割 |
|---|---|---|---|
| **aws-console** | http://localhost:8000 | Bun + Hono + HTMX + Tailwind v4 | `aws-cli` を実行するブラウザダッシュボード |
| **ruby-sdk-console** | http://localhost:8001 | Ruby 3.3 + Sinatra + HTMX + Tailwind v4 | `aws-sdk-*` / `pg` / `rubyzip` / `redis` を実行するダッシュボード |
| **floci** | http://localhost:4566 | `floci/floci:latest` | ローカル AWS エミュレータ本体 |
| **adminer** | http://localhost:9000 | `adminer:latest` | RDS (PostgreSQL) 確認用 GUI |

Floci は `/var/run/docker.sock` をマウントして DinD で実コンテナ (Lambda runtime / PostgreSQL / Valkey 等) を起動する。データプレーン (Redis プロトコル、PG プロトコル) は Floci のホストの 6379-6399 / 7001-7099 ポートに proxy 経由で公開される。

---

## スクリーンショット

<table>
  <tr>
    <td width="50%" align="center">
      <strong>aws-console (CLI)</strong><br/>
      <sub>http://localhost:8000 — dark theme</sub><br/>
      <img src="docs/images/cli-console.png" alt="CLI Console: EC2 タブで describe-instances を表示" />
      <br/><sub>EC2 タブ / コマンドプレビュー</sub>
    </td>
    <td width="50%" align="center">
      <strong>ruby-sdk-console (SDK)</strong><br/>
      <sub>http://localhost:8001 — light theme</sub><br/>
      <img src="docs/images/ruby-sdk-console.png" alt="Ruby SDK Console: S3 Put object と List buckets の実行履歴" />
      <br/><sub>S3 タブ / Ruby コードプレビュー / 実行履歴</sub>
    </td>
  </tr>
</table>

サービスタブを切り替えると、左サイドバーにそのサービスのオペレーション一覧が出る。中央のカードでフィールドを編集すると、その場で **コマンド (CLI) / Ruby コード (SDK) のプレビュー** が更新される。Run すると下の History エリアに結果が積み上がる (HTMX で部分更新)。

---

## Quick start

```bash
docker compose up --build
```

初回ビルドは aws-cli / Ruby gem のダウンロードで 3〜5 分。起動後:

- CLI Console: http://localhost:8000
- SDK Console: http://localhost:8001
- Adminer (RDS): http://localhost:9000 (login servers は事前設定済み)

ヘッダの「Console:」セレクタで両 Console を行き来できる。`init/setup-aws-resources.sh` と aws-console 起動フックで以下のデモリソースが seed される:

| サービス | リソース |
|---|---|
| S3 | `floci-test-bucket` / `athena-results` (Athena 出力先) |
| SQS | `floci-test-queue` |
| SNS | `floci-test-topic` |
| Secrets Manager | `floci-test/rails-secret` |
| SSM | `/floci-test/app/environment` |
| RDS | `floci-test-db` (PostgreSQL) |
| ElastiCache | `floci-test-cache` (Redis RG) / `floci-test-valkey` (Valkey RG) |
| DynamoDB | `floci-test-items` (1 件サンプル投入済み) |
| ECS | `floci-test-cluster` + Fargate task def `floci-test-task` |
| Lambda | `floci-test-lambda` (Node.js 20.x) |

> ElastiCache / Lambda は `aws-console` コンテナの起動フックで seed される。前者は SigV4 で service を判定する Query プロトコル、後者は zip 化が必要で、いずれも floci コンテナ内の素の `curl` では実行できないため。

---

## サービス対応表

両 Console で扱えるオペレーション一覧 (✓ = Preset 実装あり)。`aws-cli` / `aws-sdk-ruby` どちらも実エンドポイント (`http://floci:4566`) を叩く。

| Service | Operation | CLI | Ruby SDK | Floci 実装 |
|---|---|:-:|:-:|---|
| **S3** | list / create-bucket / put-object / get-object / head-object / delete-object / delete-bucket / list-objects | ✓ | ✓¹ | In-process |
| **SQS** | list / create / send-message / receive-message / delete-queue | ✓ | ✓² | In-process |
| **SNS** | list / create-topic / publish | ✓ | ✓ | In-process |
| **Secrets Manager** | list / create / get | ✓ | ✓ | In-process |
| **SSM Parameter Store** | put / get / list (get-by-path) / delete | ✓ | ✓² | In-process |
| **RDS** | describe / create / delete | ✓ | ✓³ | **Real Docker** (PostgreSQL/MySQL) + proxy :7001+ |
| **Lambda** | list / create (Node.js) / create (Python) / invoke / get / delete | ✓ | ✓ | **Real Docker** |
| **EC2** | describe-instances / describe-images / describe-vpcs / describe-subnets / describe-security-groups / run-instances / terminate-instances | ✓ | ✓ | **Real Docker** (`RunInstances`) |
| **ECS** (Fargate) | list-clusters / create-cluster / register-task-definition / list-task-definitions / run-task / list-tasks / describe-tasks / delete-cluster | ✓ | ✓² | **Real Docker** (タスク実行) |
| **DynamoDB** | list / create / describe / put-item / get-item / scan / query / delete-table | ✓ | ✓² | In-process |
| **ElastiCache** | describe-cache-clusters / describe-replication-groups / create-replication-group (Valkey/Redis) / create-cache-cluster (Memcached) / delete | ✓ | ✓⁴ | **Real Docker** (Valkey/Redis) + proxy :6379+ |
| **Athena** | start-query-execution / list-query-executions / get-query-execution / get-query-results | ✓ | ✓ | In-process (**mock mode**: クエリは受理されるが結果は空) |
| **Custom** | 任意の `aws ...` を直接実行 | ✓ | — | |

¹ 全部 `aws-sdk-s3`。`path_style` を強制。
² 一部オペレーション省略あり (CLI 側にあり SDK 側になし、またはその逆)。
³ aws-sdk-rds の XML パーサが Floci の `<Subnets><member>...` スキーマと一部非互換なため、`describe-db-instances` は `Net::HTTP + Nokogiri` で生 XML をパースしている。他のオペレーションと `pg` 接続は SDK のまま。
⁴ Ruby 側には **`describe_replication_groups` → 取得した endpoint へ `redis` gem で接続 → PING / SET / GET / INFO** という疎通テスト Preset (`ec-ping-valkey`) もある。Valkey 8.x は Redis 互換プロトコルなので `redis` gem でそのまま喋れる。

---

## CLI Console: テンプレート記法

`aws-console/server.tsx` の Preset テンプレートは以下の記法で展開される (`{}` 内はフィールド名):

| 記法 | 用途 | 例 |
|---|---|---|
| `{name}` | フォーム値で置換 (部分置換も可) | `s3 cp s3://{bucket}/{key} -` |
| `@{name}` | フォーム値を一時テキストファイルに書き出して、そのファイルパスに展開 | `ecs register-task-definition --cli-input-json file://@{def}` |
| `@zip{name,filename}` | フォーム値を `filename` というファイル名で一時ディレクトリに書き出し → `zip` 化 → zip パスに展開 | `lambda create-function ... --zip-file fileb://@zip{code,index.js}` |
| `@out{name}` | 一時出力パスに展開 → コマンド実行後にそのファイル内容を stdout 末尾に表示 | `lambda invoke ... @out{response}` |

実行は `aws --endpoint-url ${FLOCI_ENDPOINT} <展開後のトークン群>` を `Bun.spawn` で起動する。

## Ruby SDK Console: 実装メモ

- **Lambda の zip 生成は `rubyzip` でメモリ上で完結**。`Zip::OutputStream.write_buffer { ... }` で組み立てたバイナリ String をそのまま `code: { zip_file: bytes }` に渡す。一時ファイル経由しない。
- **Lambda invoke の戻り値**は `resp.payload.read` で IO 取得 → `JSON.parse`。CLI 側のように出力ファイルを介す必要がない。
- **DynamoDB の item / key は素の Ruby Hash でよい**。SDK が型推論する (`{ id: "abc", value: "hello" }` でも、明示的に `{ id: { s: "abc" } }` でもよい)。CLI 側は DynamoDB JSON 形式 (`{"id":{"S":"abc"}}`) が必須なので、SDK の方が書きやすい。
- **ECS の task definition** は textarea の JSON を `JSON.parse(..., symbolize_names: true)` で Hash 化して `register_task_definition` にそのまま渡せる。
- **ElastiCache の Valkey/Redis 疎通テスト**は `describe_replication_groups` で `configuration_endpoint` (例: `floci:6380`) を取得して `Redis.new(host:, port:)` で接続する。Valkey 8.x は Redis プロトコル互換。

---

## Floci 挙動メモ (実装中に踏んだ仕様)

> 公式ドキュメントだけだと拾いにくい挙動を整理。

| 観察 | 詳細 |
|---|---|
| **DynamoDB は JSON 1.0** | Floci 公式ドキュメントは "JSON 1.1" と書いているが、実際は AWS 本家と同じ `Content-Type: application/x-amz-json-1.0` でないと `Unknown operation: DynamoDB_20120810.CreateTable` になる。 |
| **ElastiCache Redis/Valkey は `CreateReplicationGroup`** | `CreateCacheCluster` で `engine=valkey` を指定すると `Engine must be 'memcached'. For Redis/Valkey use CreateReplicationGroup.` で弾かれる (これは実 AWS と同じ仕様)。Memcached だけが `CreateCacheCluster`。 |
| **bare `curl POST /` は SQS にルーティングされる** | Query プロトコルのサービス (ElastiCache 等) は SigV4 の `CredentialScope` (`.../us-east-1/elasticache/aws4_request`) でサービスを判定する。素の `curl` で `Action=CreateCacheCluster&...` を投げると **デフォルトで SQS に行く** ので、SigV4 を付ける `aws-cli` / `aws-sdk-*` 経由で seed する必要がある。 |
| **Athena は mock mode** | `start-query-execution` は `QueryExecutionId` を返し、`get-query-execution` は `RUNNING` → 最終的に成功っぽい状態に遷移するが、`get-query-results` は空のレスポンス。`list-data-catalogs` / `list-work-groups` / `list-databases` は `Action ... is not supported` で未実装。 |
| **EC2 は pre-defined AMI を返す** | `describe-images` で `ami-0abcdef1234567890` (Amazon Linux 2) / `ami-0abcdef1234567891` (Amazon Linux 2023) / `ami-0abcdef1234567892` (Ubuntu) / Windows Server などを返す。`run-instances` で指定するとそれぞれの実 Docker イメージが起動する。 |
| **Lambda 初回 invoke は ~60s、2 回目以降は数百 ms** | Floci がランタイムイメージ (`public.ecr.aws/lambda/nodejs:20` 等) を pull するため。pull 後はコンテナ再利用で速くなる。 |
| **RDS XML スキーマの非互換** | Floci の `DescribeDBInstances` レスポンスは `<Subnets><member>...` のような旧式構造で、`aws-sdk-rds` (Ruby) の XML パーサが解釈できないケースがある。CLI (`aws-cli` v2) と直接 XML パースは問題なく動く。Ruby Console では `Net::HTTP + Nokogiri` でフォールバック実装にしている。 |
| **データプレーンは proxy ポート** | ElastiCache: `floci:6379` ~ `6399` / RDS: `floci:7001` ~ `7099` (Compose で `FLOCI_SERVICES_RDS_PROXY_BASE_PORT=7001` 指定)。`describe-replication-groups` / `describe-db-instances` で実際のポートが返る。 |
| **永続化は `FLOCI_STORAGE_MODE=hybrid`** | `./data/floci/` 配下に `lambda-functions.json` / `dynamodb-items.json` / `sqs-queues.json` 等のサービス別 JSON が落ちる。`docker compose down -v` でボリュームを消すか、`./data/floci/` を消すとリセット。 |

---

## ディレクトリ構成

```
.
├── docker-compose.yml          # 4 サービス (floci / aws-console / ruby-sdk-console / adminer)
├── aws-console/                # Bun + Hono CLI Console
│   ├── Dockerfile              #   aws-cli v2 + zip + redis-tools 込み
│   ├── package.json
│   └── server.tsx              #   PRESETS 配列 + @zip / @out トークン展開
├── ruby-sdk-console/           # Sinatra Ruby SDK Console
│   ├── Dockerfile              #   ruby:3.3-slim + libpq-dev
│   ├── Gemfile                 #   aws-sdk-* / nokogiri / pg / rubyzip / redis
│   ├── app.rb                  #   PRESETS 配列 + ERB ビュー
│   └── views/
│       ├── index.erb           #   レイアウト + タブナビ
│       ├── _card.erb           #   Preset カード (フォーム + コードプレビュー)
│       └── _history_entry.erb  #   実行履歴エントリ
├── init/
│   └── setup-aws-resources.sh  # floci コンテナ起動時に curl で seed
├── adminer/                    # Adminer ログインサーバ事前設定
│   ├── login-servers.php
│   └── prefill.php
└── data/floci/                 # Floci 永続データ (gitignore)
```

---

## ホストから直接 aws-cli を叩く場合

`aws-console` を経由せず手元の `aws-cli` で直接触りたいとき:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

aws s3 ls
aws rds describe-db-instances
aws lambda invoke --function-name floci-test-lambda --cli-binary-format raw-in-base64-out --payload '{}' /tmp/out.json && cat /tmp/out.json
aws elasticache describe-replication-groups
```

---

## クリーンアップ

```bash
docker compose down -v   # ボリュームも削除
rm -rf data/floci         # 永続データもリセットしたい場合
```

---

## 参考

- Floci 公式: https://floci.io/floci/ — 51 services overview
- Floci サービス一覧: https://floci.io/floci/services/ — オペレーション数 / プロトコル / エンドポイント
- Floci GitHub: https://github.com/floci-io/floci
