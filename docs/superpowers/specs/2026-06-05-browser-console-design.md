# Floci Browser Console 設計

## 概要

learn-floci のブラウザ完結版。GitHub Pages で静的配信し、URLを共有するだけで仲間がブラウザ上でAWS SDK（JavaScript v3）の操作を体験できる学習ツール。

サーバ不要。各ユーザーのブラウザ内で Service Worker が Mock AWS API として動作し、AWS SDK v3 の HTTP リクエストをインターセプトしてモックレスポンスを返す。

## 動機

- Docker Compose のセットアップなしで、URLを開くだけで使えるようにしたい
- 仲間内への共有がゴール
- サーバは持ちたくない。個人のPC側に寄せる

## スコープ

### 対応サービス（7つ）

| サービス | オペレーション |
|---|---|
| S3 | CreateBucket, ListBuckets, PutObject, GetObject, ListObjectsV2, DeleteObject, DeleteBucket |
| SQS | CreateQueue, ListQueues, SendMessage, ReceiveMessage, DeleteMessage, DeleteQueue, GetQueueUrl |
| SNS | CreateTopic, ListTopics, Subscribe, Publish, ListSubscriptions, DeleteTopic |
| DynamoDB | CreateTable, ListTables, PutItem, GetItem, Query, Scan, DeleteItem, DeleteTable |
| Secrets Manager | CreateSecret, ListSecrets, GetSecretValue, UpdateSecret, DeleteSecret |
| SSM | PutParameter, GetParameter, GetParametersByPath, DeleteParameter |
| Athena | StartQueryExecution, GetQueryExecution, GetQueryResults |

### 対象外（Docker コンテナが必要）

Lambda, RDS, ElastiCache, EC2, ECS はブラウザ版では利用不可。UIにその旨を表示する。

### コンソール統一

CLI コンソール・Ruby SDK コンソールは廃止し、JavaScript AWS SDK v3 コンソール1本に統合する。

## アーキテクチャ

```
┌─ GitHub Pages ──────────────────────────────────────────────┐
│  https://<user>.github.io/learn-floci/                      │
│  index.html + JS bundle + sw.js                             │
└─────────────────────────────────────────────────────────────┘
        │ ブラウザがダウンロード
        ▼
┌─ ブラウザ ──────────────────────────────────────────────────┐
│                                                             │
│  ┌─ メインスレッド ────────────────────────────────────────┐│
│  │  SPA (Vite + vanilla TS + Tailwind CSS v4)              ││
│  │  ├─ プリセット選択 → JS SDK コード表示                  ││
│  │  ├─ 実行ボタン → AWS SDK v3 が fetch() 発行             ││
│  │  └─ 結果パネル（JSON レスポンス表示）                   ││
│  │        │                                                ││
│  │        │ fetch("/mock-api/...")                          ││
│  │        ▼                                                ││
│  ├─ Service Worker (sw.js) ────────────────────────────────┤│
│  │  ├─ リクエストをパース（サービス・オペレーション判別）   ││
│  │  ├─ サービス別ハンドラにルーティング                    ││
│  │  └─ AWS 互換レスポンスを返却                            ││
│  │        │                                                ││
│  │        ▼                                                ││
│  │  IndexedDB ("floci-browser")                            ││
│  │  ├─ s3-buckets / s3-objects                             ││
│  │  ├─ sqs-queues / sqs-messages                          ││
│  │  ├─ sns-topics / sns-subscriptions                     ││
│  │  ├─ dynamodb-tables / dynamodb-items                   ││
│  │  ├─ secrets                                             ││
│  │  ├─ ssm-parameters                                     ││
│  │  └─ athena-queries                                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Service Worker によるリクエスト判別

AWS SDK v3 が送信する HTTP リクエストからサービスを判別する:

AWS SDK v3 の `endpoint` を同一オリジンの `/mock-api/` に向ける。Service Worker は同一オリジンの fetch のみインターセプト可能なため、外部ドメインではなくパスベースでルーティングする。

- `/mock-api/` 配下のリクエストを Service Worker がキャッチ
- `X-Amz-Target` ヘッダ（例: `DynamoDB_20120810.PutItem` → DynamoDB）
- URL パスパターン（S3 のバケット/オブジェクト操作）
- Authorization ヘッダの SigV4 `service` フィールドで補助的に判別

### レスポンス形式

AWS SDK v3 がパースできる正確な形式で返す:

- S3, SQS, SNS: XML 形式
- DynamoDB: JSON（`Content-Type: application/x-amz-json-1.0`）
- Secrets Manager, SSM: JSON 形式
- Athena: JSON 形式（常にモック結果）

### データ永続化

IndexedDB にサービスごとのオブジェクトストアを作成。ブラウザを閉じてもデータは保持される。リセットボタンで全クリア＋再シード可能。

### 初期データシード

Service Worker の `install` イベント時に、現在の `init/setup-aws-resources.sh` と同等の初期データを IndexedDB に投入する（テスト用バケット、キュー、トピック等）。

## UI 設計

```
┌─────────────────────────────────────────────────────────────┐
│  Floci Browser Console                          [🔄 Reset]  │
├────────────────────┬────────────────────────────────────────┤
│                    │                                        │
│  サービス一覧       │  ┌─ コードプレビュー ───────────────┐  │
│                    │  │                                    │  │
│  ▸ S3             │  │  import { S3Client, ...} from ...  │  │
│  ▸ SQS            │  │  const client = new S3Client({})   │  │
│  ▸ SNS            │  │  const result = await client.send( │  │
│  ▸ DynamoDB       │  │    new ListBucketsCommand({})      │  │
│    ...             │  │  )                                 │  │
│                    │  │                                    │  │
│  ── 操作一覧 ──    │  └────────────────────────────────────┘  │
│                    │                                        │
│  • ListBuckets     │  [ ▶ 実行 ]                            │
│  • CreateBucket    │                                        │
│  • PutObject       │  ┌─ 実行結果 ─────────────────────────┐ │
│  • GetObject       │  │                                    │ │
│  • ...             │  │  { "Buckets": [                    │ │
│                    │  │      { "Name": "test-bucket", ... }│ │
│                    │  │    ] }                              │ │
│                    │  │                                    │ │
│                    │  └────────────────────────────────────┘ │
├────────────────────┴────────────────────────────────────────┤
│  ⚠ Lambda, RDS, ElastiCache, EC2, ECS はブラウザ版では     │
│  利用できません (Docker コンテナが必要なため)                │
└─────────────────────────────────────────────────────────────┘
```

- 左パネル: サービスツリー → 操作一覧
- 右上: JS SDK コードプレビュー（シンタックスハイライト付き）
- 右下: 実行結果（JSON）
- パラメータ入力欄の値はコードプレビューにリアルタイム反映
- 表示コードは endpoint 設定を変えるだけで本物の AWS でも動作する

## 技術スタック

| 領域 | 選定 | 理由 |
|---|---|---|
| ビルド | Vite | 高速、TS対応、GitHub Pages デプロイ容易 |
| UI | vanilla TS | フレームワーク不要な規模。現在のアプリの思想を維持 |
| スタイル | Tailwind CSS v4 | 現在のアプリと統一 |
| AWS SDK | @aws-sdk/client-*（v3） | サービスごとに個別パッケージ。Tree-shaking で軽量化 |
| コードハイライト | Shiki | JS/TS のシンタックスハイライト |
| データ永続化 | idb（IndexedDB wrapper） | 軽量で型安全な IndexedDB 操作 |
| デプロイ | GitHub Actions → GitHub Pages | push で自動デプロイ |

## ディレクトリ構成

`browser-console/` として自己完結させ、後で別リポジトリに切り出し可能にする。

```
learn-floci/
  ├── cli-console/                    （既存・変更なし）
  ├── ruby-sdk-console/               （既存・変更なし）
  ├── init/                           （既存・変更なし）
  │
  └── browser-console/                ← 新規（自己完結）
      ├── package.json
      ├── tsconfig.json
      ├── vite.config.ts
      ├── index.html
      ├── .github/
      │   └── workflows/
      │       └── deploy.yml
      ├── public/
      │   └── sw.js
      ├── src/
      │   ├── main.ts
      │   ├── ui/
      │   │   ├── layout.ts
      │   │   ├── sidebar.ts
      │   │   ├── code-preview.ts
      │   │   └── result-panel.ts
      │   ├── presets/
      │   │   ├── index.ts
      │   │   ├── s3.ts
      │   │   ├── sqs.ts
      │   │   ├── sns.ts
      │   │   ├── dynamodb.ts
      │   │   ├── secrets-manager.ts
      │   │   ├── ssm.ts
      │   │   └── athena.ts
      │   ├── executor.ts
      │   └── sw/
      │       ├── register.ts
      │       └── seed.ts
      ├── sw/
      │   ├── index.ts
      │   ├── router.ts
      │   ├── services/
      │   │   ├── s3.ts
      │   │   ├── sqs.ts
      │   │   ├── sns.ts
      │   │   ├── dynamodb.ts
      │   │   ├── secrets-manager.ts
      │   │   ├── ssm.ts
      │   │   └── athena.ts
      │   ├── store.ts
      │   └── response.ts
      └── README.md
```

## ビルド・デプロイ

### ローカル開発

```bash
cd browser-console
npm install
npm run dev          # Vite dev server (localhost:5173)
```

### ビルド

```bash
npm run build        # dist/ に静的ファイル一式を出力
npm run preview      # ビルド結果をローカルで確認
```

Vite が2つのバンドルを生成:
1. メインアプリ（`src/` → `dist/assets/`）
2. Service Worker（`sw/` → `dist/sw.js`）

### GitHub Pages デプロイ

main ブランチへの push で GitHub Actions が起動し、`dist/` を GitHub Pages に公開する。

### 初回アクセス時の体験

1. URL にアクセス
2. SPA ロード → Service Worker 登録
3. install イベントで初期データを IndexedDB にシード
4. 準備完了 → 操作可能

### リセット

ヘッダーの Reset ボタンで IndexedDB を全クリア → 再シード。各ブラウザ独立なので他人に影響しない。

## 別リポジトリへの切り出し

```bash
gh repo create floci-browser-console --public
cp -r browser-console/* ../floci-browser-console/
# .github/workflows/deploy.yml はそのまま動く
# GitHub Pages を有効化 → 公開完了
```
