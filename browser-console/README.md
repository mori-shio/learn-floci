# Floci Browser Console

ブラウザだけで AWS SDK (JavaScript v3) の操作を体験できる学習ツール。

Service Worker がブラウザ内で Mock AWS API として動作するため、サーバ不要・インストール不要。

## 対応サービス

- S3
- SQS
- SNS
- DynamoDB
- Secrets Manager
- SSM Parameter Store
- Athena (モックモード)

> Lambda, RDS, ElastiCache, EC2, ECS は Docker コンテナが必要なためブラウザ版では利用できません。

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run preview
```

## デプロイ

main ブランチへの push で GitHub Pages に自動デプロイされます。
