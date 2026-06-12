# Floci ハンズオン

[Floci](https://floci.io/)（ローカル AWS エミュレータ）を **aws-cli / aws-sdk-ruby / AWS SDK v3 for JS** の 3 面から触り、挙動と差分を体感するためのハンズオン手順書です。

所要時間の目安: **60〜90 分**（初回ビルド除く）

---

## このハンズオンで学べること

- Floci が **LocalStack 互換**（`localhost:4566`、認証トークン不要）で動くこと
- **In-process** サービス（S3, DynamoDB 等）と **実 Docker コンテナ** サービス（Lambda, RDS, ElastiCache 等）の違い
- Terraform で Floci にリソースを宣言的に作成する方法
- 同じ操作を CLI / Ruby SDK / JS SDK で比較する方法

---

## 前提条件

| ツール | 用途 | 確認コマンド |
|---|---|---|
| Docker Desktop | コンテナ実行 | `docker --version` |
| Docker Compose v2 | スタック起動 | `docker compose version` |
| Terraform 1.x | リソース作成 | `terraform version` |
| aws-cli v2（任意） | ホストから直接操作・seed | `aws --version` |

> **注意**: Floci は `/var/run/docker.sock` をマウントして Lambda / RDS / ElastiCache 等の実コンテナを起動します。Docker Desktop が起動していることを確認してください。

---

## 全体像

```
ブラウザ
  ├─ CLI Console      :8000  (aws-cli)
  ├─ Ruby SDK Console :8001  (aws-sdk-ruby + pg + redis)
  ├─ JS SDK Console   :8002  (AWS SDK v3 for JS)
  └─ Adminer          :9000  (RDS MySQL GUI)
         │
         ▼
    Floci :4566  ← ローカル AWS エミュレータ
         │
         ▼ (DinD)
    Lambda / MySQL / Valkey 等の実コンテナ
```

| URL | 役割 |
|---|---|
| http://localhost:8000 | CLI Console |
| http://localhost:8001 | Ruby SDK Console |
| http://localhost:8002 | JS SDK Console |
| http://localhost:4566 | Floci API エンドポイント |
| http://localhost:9000 | Adminer（RDS 確認用） |

---

## Step 0: リポジトリの取得

```bash
git clone https://github.com/mori-shio/learn-floci.git
cd learn-floci
```

---

## Step 1: スタックの起動

```bash
docker compose up --build
```

初回は aws-cli / Ruby gem / Bun パッケージのダウンロードで **3〜5 分** かかります。以下が表示されれば準備完了です。

```
floci-1            | Floci started on http://0.0.0.0:4566
cli-console-1      | Listening on http://0.0.0.0:8000
ruby-sdk-console-1 | Listening on http://0.0.0.0:8001
js-sdk-console-1   | Listening on http://0.0.0.0:8002
```

バックグラウンドで起動する場合:

```bash
docker compose up --build -d
docker compose ps   # 全サービスが healthy / running であることを確認
```

Floci のヘルスチェック:

```bash
curl -f http://localhost:4566/_floci/health
```

---

## Step 2: Terraform でデモリソースを作成

別ターミナルで:

```bash
cd infra/terraform
terraform init
terraform plan    # 作成されるリソースを確認
terraform apply   # 確認プロンプトで yes
```

作成される主なリソース:

| サービス | リソース名 |
|---|---|
| S3 | `floci-test-bucket`, `athena-results` |
| SQS | `floci-test-queue` |
| SNS | `floci-test-topic` |
| Secrets Manager | `floci-test/rails-secret` |
| SSM | `/floci-test/app/environment` |
| RDS | `floci-test-db` (MySQL) |
| DynamoDB | `floci-test-items`（サンプル 1 件込み） |
| Lambda | `floci-test-lambda` (Node.js 20.x) |
| ElastiCache | `floci-test-cache` (Redis), `floci-test-valkey` (Valkey) |
| EC2 | `floci-test-instance` |
| ECS | `floci-test-cluster` + `floci-test-task` |

> ElastiCache / RDS の作成には **20〜30 秒** かかります。`terraform apply` が完了するまで待ちましょう。

---

## Step 3: サンプルデータの投入（推奨）

Terraform はインフラの「箱」を作ります。オブジェクトやメッセージなどのデータは seed スクリプトで投入します。

```bash
# リポジトリルートから
bash infra/seed/seed-sample-data.sh
```

成功時の出力例:

```
=== Seeding sample data ===
✓ S3 object: floci-test-bucket/sample.json
✓ SQS message: ca046d4e-253f-4dc8-9f41-80e6eb121156
✓ SNS publish: 8565cba4-16a1-4561-af74-caa9b19033d3
✓ RDS: users テーブル作成 + 3 件投入 (port=7001)
=== Done ===
```

---

## Console UI の使い方

http://localhost:8000 を開きます。

### 画面構成

1. **ヘッダ**: Console セレクタ（CLI / Ruby / JS を切り替え）、エンドポイント表示
2. **サービスタブ**: S3, SQS, SNS, … の 12 サービス + Custom（CLI のみ）
3. **左サイドバー**: 選択中サービスのオペレーション一覧
4. **中央カード**: フィールド入力 + **コマンド / コードのプレビュー** + **Run** ボタン
5. **History**: 実行結果が新しい順に積み上がる

### 操作の流れ

1. サービスタブを選ぶ（例: **S3**）
2. 左サイドバーからオペレーションを選ぶ（例: **List buckets**）
3. 必要ならフィールドを編集する → プレビューがリアルタイム更新
4. **Run** を押す → History に結果が表示される

> フィールドを編集すると、CLI なら `aws --endpoint-url ...` コマンド、SDK Console なら Ruby / JS コードがその場で書き換わります。これが本リポジトリの学習ポイントのひとつです。

---

## ハンズオン演習

各演習は **CLI Console (:8000)** を基準に書いています。演習の最後に「他の Console で試す」欄で SDK 版も案内します。

---

### 演習 1: S3 — オブジェクトのライフサイクル

**目的**: In-process サービスの基本操作を体験する。

| 手順 | オペレーション | フィールド | 期待される結果 |
|---|---|---|---|
| 1 | List buckets | （なし） | `floci-test-bucket`, `athena-results` が表示 |
| 2 | List objects | Bucket: `floci-test-bucket` | `sample.json` が表示（seed 済み） |
| 3 | Get object | Bucket: `floci-test-bucket`, Key: `sample.json` | `{"hello":"from floci"}` |
| 4 | Put object | Bucket: `floci-test-bucket`, Key: `hands-on.txt`, Body: 任意 | 成功（exit 0） |
| 5 | Get object | Key: `hands-on.txt` | 手順 4 で入力した本文 |

**他の Console で試す**: Ruby / JS Console でも同じ S3 タブから同様の操作ができます。プレビューが `Aws::S3::Client` / `S3Client` になる点に注目してください。

**ホストから直接**:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

aws s3 ls
aws s3 cp s3://floci-test-bucket/sample.json -
```

---

### 演習 2: DynamoDB — テーブルの読み書き

**目的**: Terraform で投入済みのデータを scan / put する。

| 手順 | オペレーション | フィールド | 期待される結果 |
|---|---|---|---|
| 1 | Scan | Table: `floci-test-items` | `item1` / `hello from floci` |
| 2 | Put item | Table: `floci-test-items`, ID: `item2`, Value: 任意 | 成功 |
| 3 | Get item | Table: `floci-test-items`, ID: `item2` | 手順 2 の値 |

> **Floci の癖**: DynamoDB は `Content-Type: application/x-amz-json-1.0` が必須です。Console 経由なら意識不要ですが、素の HTTP クライアントでは `Unknown operation` になることがあります。

---

### 演習 3: SQS / SNS — メッセージング

**目的**: キューとトピックの送受信を確認する。

#### SQS

| 手順 | オペレーション | フィールド |
|---|---|---|
| 1 | List queues | （なし）→ `floci-test-queue` を確認 |
| 2 | Receive message | Queue URL: `http://floci:4566/000000000000/floci-test-queue` |
| 3 | Send message | 任意の body を送信 |
| 4 | Receive message | 手順 3 のメッセージが受信できる |

> Queue URL のホスト名は Console 内では `floci:4566`（Docker ネットワーク内）です。ホストの aws-cli からは `http://localhost:4566/000000000000/floci-test-queue` でも同じキューにアクセスできます。

#### SNS

| 手順 | オペレーション | フィールド |
|---|---|---|
| 1 | List topics | `floci-test-topic` を確認 |
| 2 | Publish message | Topic ARN: `arn:aws:sns:us-east-1:000000000000:floci-test-topic` |

---

### 演習 4: Secrets Manager / SSM — 設定値の取得

**目的**: アプリが参照する秘密情報・パラメータを読む。

| サービス | オペレーション | 名前 |
|---|---|---|
| Secrets | Get secret | `floci-test/rails-secret` → `secret_key_base` を含む JSON |
| SSM | Get parameter | `/floci-test/app/environment` → `development` |

---

### 演習 5: Lambda — 実コンテナでの関数実行

**目的**: Floci が **本物の Lambda ランタイムイメージ** で関数を実行することを確認する。

| 手順 | オペレーション | フィールド | 期待される結果 |
|---|---|---|---|
| 1 | List functions | （なし） | `floci-test-lambda` |
| 2 | Invoke | Function: `floci-test-lambda`, Payload: `{}` | `{"message":"Hello from Floci Lambda!","event":{}}` |

**初回 invoke について**:

- 初回はランタイムイメージ（`public.ecr.aws/lambda/nodejs:20`）の pull で **〜60 秒** かかることがあります
- 2 回目以降はコンテナ再利用で **数百 ms〜数秒** に短縮されます

**ホストから直接**:

```bash
aws lambda invoke \
  --function-name floci-test-lambda \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' /tmp/out.json && cat /tmp/out.json
```

---

### 演習 6: RDS + Adminer — 実 MySQL への接続

**目的**: Floci の RDS が **本物の MySQL コンテナ** であることを Adminer で確認する。

#### 6a. CLI Console で RDS を確認

| 手順 | オペレーション | フィールド |
|---|---|---|
| 1 | Describe DB instances | Identifier: `floci-test-db` |

レスポンスに `Endpoint.Port`（例: `7001`）が含まれます。これがホストに公開される proxy ポートです。

#### 6b. Adminer でテーブルを見る

1. http://localhost:9000 を開く
2. ログイン画面で **Server** のドロップダウンから `Floci RDS (MySQL)` を選択
3. 以下は **事前入力済み**（prefill プラグイン）:
   - Username: `admin`
   - Password: `password`
   - Database: `floci_test_dev`
4. **Login** をクリック
5. 左ペインの `users` テーブルを開く

seed 済みなら Alice / Bob / Charlie の 3 件が表示されます。

> Adminer コンテナからは `floci:7001` で RDS proxy に接続します。ホストから直接 mysql クライアントを使う場合は `127.0.0.1:7001` です。

---

### 演習 7: ElastiCache — Valkey へのデータプレーン接続

**目的**: コントロールプレーン（AWS API）とデータプレーン（Redis プロトコル）の分離を理解する。

#### 7a. CLI Console

| 手順 | オペレーション |
|---|---|
| 1 | Describe replication groups → `floci-test-valkey` の endpoint を確認 |

#### 7b. Ruby SDK Console（推奨）

http://localhost:8001 → **ElastiCache** タブ → **PING via Redis gem**

| フィールド | デフォルト値 |
|---|---|
| Replication group ID | `floci-test-valkey` |
| Test key | `ruby-demo` |
| Test value | `hello floci` |

**Run** 後、History に以下のような JSON が表示されれば成功:

```json
{
  "endpoint": "floci:6380",
  "ping": "PONG",
  "set": { "key": "ruby-demo", "value": "hello floci" },
  "get": "hello floci",
  "version": "8.1.8",
  "server_mode": "standalone"
}
```

> Valkey は Redis 互換プロトコルのため `redis` gem でそのまま接続できます。これが Ruby Console 独自の Preset です。

---

### 演習 8: EC2 / ECS — 実コンテナのプロビジョニング

**目的**: Floci が EC2 インスタンスや ECS Fargate タスクを実 Docker で起動することを確認する。

#### EC2

| 手順 | オペレーション | 備考 |
|---|---|---|
| 1 | Describe instances | `floci-test-instance`（Terraform 作成済み） |
| 2 | Describe images | 事前定義 AMI 一覧（Amazon Linux 2 等） |
| 3 | Run instances（任意） | AMI: `ami-0abcdef1234567890` で新規起動 |

#### ECS

| 手順 | オペレーション | 備考 |
|---|---|---|
| 1 | List clusters | `floci-test-cluster` |
| 2 | List task definitions | `floci-test-task` |
| 3 | Run task（任意） | nginx イメージの Fargate タスクを起動 |

> 実コンテナの起動には数十秒かかります。History の実行時間に注目してください。

---

### 演習 9: Athena — mock mode の確認

**目的**: Floci の Athena が **API は動くがクエリ結果は空** であることを理解する。

| 手順 | オペレーション | 期待される結果 |
|---|---|---|
| 1 | Start query execution | `QueryExecutionId` が返る |
| 2 | Get query execution | `RUNNING` → 成功状態に遷移 |
| 3 | Get query results | **空の結果**（mock mode） |

`list-data-catalogs` 等の一部 API は未実装です。本番相当の SQL 実行は期待しないでください。

---

## 3 つの Console を比較する

同じ **S3 → List buckets** を 3 つの Console で実行し、プレビューの違いを観察してください。

| Console | プレビューの例 | 特徴 |
|---|---|---|
| CLI (:8000) | `aws --endpoint-url http://floci:4566 s3 ls` | Custom タブで任意コマンドも実行可 |
| Ruby (:8001) | `Aws::S3::Client.new ...` | RDS は Nokogiri フォールバック、ElastiCache は redis gem 疎通 |
| JS (:8002) | `new S3Client({ endpoint: ... })` | 全 12 サービスを SDK v3 で統一 |

ヘッダの **Console:** セレクタでページ遷移できます。

---

## よくあるトラブルと対処

| 症状 | 原因 | 対処 |
|---|---|---|
| `connection refused` on :4566 | Floci が未起動 | `docker compose ps` で `floci` が healthy か確認 |
| Terraform apply が RDS で失敗 | Floci 起動前に apply した | `docker compose up` 後に再実行 |
| Lambda invoke が 60 秒以上 | 初回イメージ pull | 待つ。2 回目以降は高速化 |
| Adminer で接続できない | RDS 未作成 / proxy ポート不一致 | `terraform apply` 完了を確認。Server は `Floci RDS (MySQL)` を選択 |
| seed の RDS 部分が skip | DB インスタンス未作成 | 先に `terraform apply` |
| DynamoDB で Unknown operation | Content-Type 不一致 | Console / aws-cli / SDK 経由で操作する |
| ElastiCache を curl で直接叩けない | SigV4 なしの POST は SQS にルーティング | `aws-cli` / SDK 経由で操作する |

### ログの確認

```bash
docker compose logs floci --tail 50
docker compose logs cli-console --tail 20
```

### データのリセット

Floci は `FLOCI_STORAGE_MODE=hybrid` で `./data/floci/` に状態を永続化します。

```bash
docker compose down
rm -rf data/floci
docker compose up --build -d
cd infra/terraform && terraform apply
bash infra/seed/seed-sample-data.sh
```

---

## クリーンアップ

**Floci が起動したまま** `terraform destroy` を実行してください（`docker compose down` より先）。

```bash
cd infra/terraform
terraform destroy
```

続けてコンテナと永続データを片付けます。

```bash
cd ../..
docker compose down -v   # ボリュームも削除
rm -rf data/floci        # Floci 永続データも消す場合
```

---

## 次のステップ

- [README.md](../README.md) の「Floci 挙動メモ」で実装中に踏んだ API 差分を確認
- [Floci 公式ドキュメント](https://floci.io/floci/) で 51 サービスの対応状況を調べる
- `consoles/*/server.tsx`（または `app.rb`）の `PRESETS` 配列を編集して、自分用のオペレーションを追加する
- ホストの aws-cli + 既存の Terraform モジュールを `endpoints = "http://localhost:4566"` に向けて試す

---

## クイックリファレンス（ホストから aws-cli）

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

aws s3 ls
aws dynamodb scan --table-name floci-test-items
aws sqs list-queues
aws lambda list-functions
aws rds describe-db-instances
aws elasticache describe-replication-groups
```
