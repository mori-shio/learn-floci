# Floci Browser Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Pages で配信するブラウザ完結型の AWS 学習コンソール。Service Worker が Mock AWS API として動作し、JS AWS SDK v3 のリクエストをインターセプトしてモックレスポンスを返す。

**Architecture:** SPA (Vite + vanilla TS + Tailwind CSS v4) がメインスレッドで動作。AWS SDK v3 が `/mock-api/` に向けて fetch() を発行し、Service Worker がインターセプト。サービス別ハンドラがリクエストをパースして IndexedDB でデータを永続化し、AWS 互換レスポンス (XML/JSON) を返却する。

**Tech Stack:** Vite, TypeScript, Tailwind CSS v4, @aws-sdk/client-* v3, idb, Shiki

**Spec:** `docs/superpowers/specs/2026-06-05-browser-console-design.md`

---

## File Map

```
browser-console/
├── package.json                    # 依存定義 + scripts
├── tsconfig.json                   # TS 設定 (strict, ESNext)
├── tsconfig.sw.json                # Service Worker 用 TS 設定
├── vite.config.ts                  # Vite ビルド設定 (SPA + SW 別バンドル)
├── tailwind.config.ts              # Tailwind v4 設定
├── index.html                      # SPA エントリ HTML
├── .github/workflows/deploy.yml    # GitHub Pages デプロイ
├── src/
│   ├── main.ts                     # SPA エントリ: SW 登録 + UI 初期化
│   ├── types.ts                    # Preset / Field 型定義
│   ├── presets/
│   │   ├── index.ts                # 全プリセット集約 + SERVICES 定数
│   │   ├── s3.ts                   # S3 プリセット群
│   │   ├── sqs.ts                  # SQS プリセット群
│   │   ├── sns.ts                  # SNS プリセット群
│   │   ├── dynamodb.ts             # DynamoDB プリセット群
│   │   ├── secrets-manager.ts      # Secrets Manager プリセット群
│   │   ├── ssm.ts                  # SSM プリセット群
│   │   └── athena.ts               # Athena プリセット群
│   ├── executor.ts                 # プリセット実行: AWS SDK コマンド実行 + 結果取得
│   ├── ui/
│   │   ├── layout.ts               # 全体レイアウト構築
│   │   ├── sidebar.ts              # 左パネル: サービスツリー + 操作一覧
│   │   ├── code-preview.ts         # 右上: SDK コードプレビュー (Shiki ハイライト)
│   │   └── result-panel.ts         # 右下: 実行結果 JSON 表示
│   └── sw-register.ts              # Service Worker 登録 + シード状態チェック
├── sw/
│   ├── index.ts                    # SW エントリ: install/activate/fetch イベント
│   ├── router.ts                   # サービス判別 + ハンドラディスパッチ
│   ├── store.ts                    # IndexedDB ラッパー (idb)
│   ├── seed.ts                     # 初期データ投入
│   ├── response.ts                 # AWS XML/JSON レスポンスビルダー
│   └── services/
│       ├── s3.ts                   # S3 モックハンドラ
│       ├── sqs.ts                  # SQS モックハンドラ
│       ├── sns.ts                  # SNS モックハンドラ
│       ├── dynamodb.ts             # DynamoDB モックハンドラ
│       ├── secrets-manager.ts      # Secrets Manager モックハンドラ
│       ├── ssm.ts                  # SSM モックハンドラ
│       └── athena.ts               # Athena モックハンドラ
└── README.md
```

---

## Task 1: プロジェクトスキャフォールド

**Files:**
- Create: `browser-console/package.json`
- Create: `browser-console/tsconfig.json`
- Create: `browser-console/tsconfig.sw.json`
- Create: `browser-console/vite.config.ts`
- Create: `browser-console/index.html`
- Create: `browser-console/src/main.ts`

- [ ] **Step 1: package.json 作成**

```json
{
  "name": "floci-browser-console",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && tsc -p tsconfig.sw.json && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/client-sqs": "^3.700.0",
    "@aws-sdk/client-sns": "^3.700.0",
    "@aws-sdk/client-dynamodb": "^3.700.0",
    "@aws-sdk/client-secrets-manager": "^3.700.0",
    "@aws-sdk/client-ssm": "^3.700.0",
    "@aws-sdk/client-athena": "^3.700.0",
    "idb": "^8.0.0",
    "shiki": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json 作成（メインアプリ用）**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 3: tsconfig.sw.json 作成（Service Worker 用）**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ESNext", "WebWorker"],
    "types": []
  },
  "include": ["sw"]
}
```

- [ ] **Step 4: vite.config.ts 作成**

SW を別エントリポイントとしてビルドする設定。`vite-plugin-static-copy` 等は使わず、`build.rollupOptions` でマルチエントリにする。

```ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        sw: "sw/index.ts",
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "sw") return "sw.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
```

- [ ] **Step 5: index.html 作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Floci Browser Console</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: src/style.css 作成**

```css
@import "tailwindcss";
```

- [ ] **Step 7: src/main.ts 作成（スタブ）**

```ts
const app = document.getElementById("app")!;
app.textContent = "Floci Browser Console - loading...";
```

- [ ] **Step 8: npm install して dev server 起動確認**

```bash
cd browser-console
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、テキストが表示されることを確認。

- [ ] **Step 9: コミット**

```bash
git add browser-console/
git commit -m "feat: browser-console プロジェクトスキャフォールド"
```

---

## Task 2: IndexedDB ストア + シードデータ

**Files:**
- Create: `browser-console/sw/store.ts`
- Create: `browser-console/sw/seed.ts`

- [ ] **Step 1: sw/store.ts 作成**

IndexedDB のスキーマ定義と CRUD 共通操作を実装。`idb` ライブラリを使用。

```ts
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "floci-browser";
const DB_VERSION = 1;

interface FlociDB {
  "s3-buckets": { key: string; value: { name: string; creationDate: string } };
  "s3-objects": {
    key: string;
    value: {
      bucket: string;
      key: string;
      body: string;
      contentType: string;
      size: number;
      lastModified: string;
      etag: string;
    };
  };
  "sqs-queues": {
    key: string;
    value: {
      name: string;
      url: string;
      arn: string;
      attributes: Record<string, string>;
      createdTimestamp: string;
    };
  };
  "sqs-messages": {
    key: string;
    value: {
      queueUrl: string;
      messageId: string;
      body: string;
      receiptHandle: string;
      md5OfBody: string;
      sentTimestamp: string;
    };
  };
  "sns-topics": {
    key: string;
    value: { name: string; arn: string };
  };
  "sns-subscriptions": {
    key: string;
    value: {
      arn: string;
      topicArn: string;
      protocol: string;
      endpoint: string;
    };
  };
  "dynamodb-tables": {
    key: string;
    value: {
      tableName: string;
      keySchema: Array<{ attributeName: string; keyType: string }>;
      attributeDefinitions: Array<{
        attributeName: string;
        attributeType: string;
      }>;
      billingMode: string;
      tableStatus: string;
      creationDateTime: number;
      itemCount: number;
    };
  };
  "dynamodb-items": {
    key: string;
    value: { tableName: string; item: Record<string, unknown> };
  };
  secrets: {
    key: string;
    value: {
      name: string;
      arn: string;
      secretString: string;
      versionId: string;
      createdDate: number;
    };
  };
  "ssm-parameters": {
    key: string;
    value: {
      name: string;
      type: string;
      value: string;
      version: number;
      lastModifiedDate: number;
    };
  };
  "athena-queries": {
    key: string;
    value: {
      queryExecutionId: string;
      query: string;
      database: string;
      outputLocation: string;
      state: string;
      submissionDateTime: number;
    };
  };
}

type StoreName = keyof FlociDB;

let dbPromise: Promise<IDBPDatabase<FlociDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FlociDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FlociDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const stores: StoreName[] = [
          "s3-buckets",
          "s3-objects",
          "sqs-queues",
          "sqs-messages",
          "sns-topics",
          "sns-subscriptions",
          "dynamodb-tables",
          "dynamodb-items",
          "secrets",
          "ssm-parameters",
          "athena-queries",
        ];
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll<T extends StoreName>(
  store: T
): Promise<FlociDB[T]["value"][]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function get<T extends StoreName>(
  store: T,
  key: string
): Promise<FlociDB[T]["value"] | undefined> {
  const db = await getDB();
  return db.get(store, key);
}

export async function put<T extends StoreName>(
  store: T,
  key: string,
  value: FlociDB[T]["value"]
): Promise<void> {
  const db = await getDB();
  await db.put(store, value, key);
}

export async function del(store: StoreName, key: string): Promise<void> {
  const db = await getDB();
  await db.delete(store, key);
}

export async function clear(store: StoreName): Promise<void> {
  const db = await getDB();
  await db.clear(store);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);
  const tx = db.transaction(storeNames as StoreName[], "readwrite");
  await Promise.all(storeNames.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}

export type { FlociDB, StoreName };
```

- [ ] **Step 2: sw/seed.ts 作成**

`init/setup-aws-resources.sh` と同等の初期データを投入する関数。

```ts
import { put, getAll } from "./store";

export async function seedInitialData(): Promise<void> {
  const existing = await getAll("s3-buckets");
  if (existing.length > 0) return;

  const now = new Date().toISOString();

  await put("s3-buckets", "floci-test-bucket", {
    name: "floci-test-bucket",
    creationDate: now,
  });
  await put("s3-buckets", "athena-results", {
    name: "athena-results",
    creationDate: now,
  });

  const queueUrl = "/mock-api/000000000000/floci-test-queue";
  await put("sqs-queues", "floci-test-queue", {
    name: "floci-test-queue",
    url: queueUrl,
    arn: "arn:aws:sqs:us-east-1:000000000000:floci-test-queue",
    attributes: {},
    createdTimestamp: String(Date.now()),
  });

  await put("sns-topics", "floci-test-topic", {
    name: "floci-test-topic",
    arn: "arn:aws:sns:us-east-1:000000000000:floci-test-topic",
  });

  await put("secrets", "floci-test/rails-secret", {
    name: "floci-test/rails-secret",
    arn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:floci-test/rails-secret-AbCdEf",
    secretString: '{"secret_key_base":"dummy-secret-key-for-local-dev"}',
    versionId: "00000000-0000-0000-0000-000000000001",
    createdDate: Date.now(),
  });

  await put("ssm-parameters", "/floci-test/app/environment", {
    name: "/floci-test/app/environment",
    type: "String",
    value: "development",
    version: 1,
    lastModifiedDate: Date.now(),
  });

  await put("dynamodb-tables", "floci-test-items", {
    tableName: "floci-test-items",
    keySchema: [{ attributeName: "id", keyType: "HASH" }],
    attributeDefinitions: [{ attributeName: "id", attributeType: "S" }],
    billingMode: "PAY_PER_REQUEST",
    tableStatus: "ACTIVE",
    creationDateTime: Date.now(),
    itemCount: 1,
  });

  await put("dynamodb-items", "floci-test-items::id::item1", {
    tableName: "floci-test-items",
    item: { id: { S: "item1" }, value: { S: "hello from floci" } },
  });
}
```

- [ ] **Step 3: コミット**

```bash
git add browser-console/sw/store.ts browser-console/sw/seed.ts
git commit -m "feat: IndexedDB ストア + シードデータ"
```

---

## Task 3: Service Worker エントリ + ルーター

**Files:**
- Create: `browser-console/sw/response.ts`
- Create: `browser-console/sw/router.ts`
- Create: `browser-console/sw/index.ts`

- [ ] **Step 1: sw/response.ts 作成**

AWS 互換レスポンスを構築するユーティリティ。

```ts
export function xmlResponse(body: string, status = 200): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n${body}`,
    {
      status,
      headers: {
        "Content-Type": "application/xml",
        "x-amzn-requestid": crypto.randomUUID(),
      },
    }
  );
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/x-amz-json-1.0",
      "x-amzn-requestid": crypto.randomUUID(),
    },
  });
}

export function jsonResponse11(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "x-amzn-requestid": crypto.randomUUID(),
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return xmlResponse(
    `<ErrorResponse><Error><Code>${code}</Code><Message>${message}</Message></Error></ErrorResponse>`,
    status
  );
}

export function jsonErrorResponse(
  type: string,
  message: string,
  status: number
): Response {
  return new Response(
    JSON.stringify({ __type: type, message }),
    {
      status,
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        "x-amzn-requestid": crypto.randomUUID(),
      },
    }
  );
}
```

- [ ] **Step 2: sw/router.ts 作成**

リクエストからサービスを判別し、対応するハンドラにディスパッチ。最初は全サービスをスタブで返す。

```ts
import type { HandleFn } from "./services/types";

type ServiceHandler = { handle: HandleFn };

const handlers: Record<string, () => Promise<ServiceHandler>> = {
  s3: () => import("./services/s3"),
  sqs: () => import("./services/sqs"),
  sns: () => import("./services/sns"),
  dynamodb: () => import("./services/dynamodb"),
  secretsmanager: () => import("./services/secrets-manager"),
  ssm: () => import("./services/ssm"),
  athena: () => import("./services/athena"),
};

function detectService(request: Request, url: URL): string | null {
  const target = request.headers.get("x-amz-target") || "";

  if (target.startsWith("DynamoDB_20120810")) return "dynamodb";
  if (target.startsWith("secretsmanager")) return "secretsmanager";
  if (target.startsWith("AmazonSSM")) return "ssm";
  if (target.startsWith("AmazonAthena")) return "athena";

  const authHeader = request.headers.get("authorization") || "";
  const serviceMatch = authHeader.match(/Credential=[^/]+\/[^/]+\/[^/]+\/(\w+)\//);
  if (serviceMatch) {
    const service = serviceMatch[1];
    if (handlers[service]) return service;
  }

  const path = url.pathname.replace(/^\/mock-api/, "");
  if (path === "/" || path === "") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("x-www-form-urlencoded")) return "sqs";
    return null;
  }

  return "s3";
}

export async function routeRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const service = detectService(request, url);

  if (!service || !handlers[service]) {
    return new Response(
      JSON.stringify({ error: `Unknown service for ${url.pathname}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const handler = await handlers[service]();
  return handler.handle(request, url);
}
```

- [ ] **Step 3: sw/services/types.ts 作成**

```ts
export type HandleFn = (request: Request, url: URL) => Promise<Response>;
```

- [ ] **Step 4: 全7サービスのスタブハンドラ作成**

各 `sw/services/<service>.ts` に最小限のスタブを配置。例として `sw/services/s3.ts`:

```ts
import type { HandleFn } from "./types";

export const handle: HandleFn = async (_request, _url) => {
  return new Response(JSON.stringify({ stub: "s3" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
};
```

同様に `sqs.ts`, `sns.ts`, `dynamodb.ts`, `secrets-manager.ts`, `ssm.ts`, `athena.ts` を作成（`stub:` の値だけ変える）。

- [ ] **Step 5: sw/index.ts 作成**

```ts
import { seedInitialData } from "./seed";
import { routeRequest } from "./router";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", (event) => {
  event.waitUntil(
    seedInitialData().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/mock-api")) {
    event.respondWith(routeRequest(event.request));
  }
});
```

- [ ] **Step 6: src/sw-register.ts 作成**

```ts
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.error("Service Worker not supported");
    return;
  }
  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  if (reg.installing) {
    await new Promise<void>((resolve) => {
      reg.installing!.addEventListener("statechange", function handler() {
        if (this.state === "activated") {
          this.removeEventListener("statechange", handler);
          resolve();
        }
      });
    });
  }
}
```

- [ ] **Step 7: src/main.ts を更新して SW 登録**

```ts
import { registerServiceWorker } from "./sw-register";

async function init() {
  const app = document.getElementById("app")!;
  app.textContent = "Service Worker を登録中...";

  await registerServiceWorker();
  app.textContent = "Floci Browser Console - 準備完了";

  const res = await fetch("/mock-api/");
  const json = await res.json();
  console.log("Mock API response:", json);
}

init();
```

- [ ] **Step 8: dev server で SW 登録 + mock-api 応答を確認**

```bash
cd browser-console && npm run dev
```

ブラウザの DevTools Console に `Mock API response:` が表示されることを確認。

- [ ] **Step 9: コミット**

```bash
git add browser-console/sw/ browser-console/src/
git commit -m "feat: Service Worker エントリ + ルーター + スタブハンドラ"
```

---

## Task 4: S3 モックサービス実装

**Files:**
- Modify: `browser-console/sw/services/s3.ts`

- [ ] **Step 1: S3 ハンドラ実装**

S3 はパスベースでオペレーションを判別する。`PUT /mock-api/{bucket}` → CreateBucket, `GET /mock-api/` → ListBuckets, `PUT /mock-api/{bucket}/{key}` → PutObject, etc.

```ts
import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { xmlResponse, errorResponse } from "../response";

export const handle: HandleFn = async (request, url) => {
  const path = url.pathname.replace(/^\/mock-api\/?/, "");
  const parts = path.split("/").filter(Boolean);
  const method = request.method;

  if (parts.length === 0 && method === "GET") return listBuckets();
  if (parts.length === 1 && method === "PUT") return createBucket(parts[0]);
  if (parts.length === 1 && method === "DELETE") return deleteBucket(parts[0]);

  if (parts.length === 1 && method === "GET") {
    const params = url.searchParams;
    if (params.has("list-type")) return listObjectsV2(parts[0], params);
    return listObjectsV2(parts[0], params);
  }

  if (parts.length >= 2 && method === "PUT") {
    const bucket = parts[0];
    const key = parts.slice(1).join("/");
    const body = await request.text();
    return putObject(bucket, key, body);
  }

  if (parts.length >= 2 && method === "GET") {
    const bucket = parts[0];
    const key = parts.slice(1).join("/");
    return getObject(bucket, key);
  }

  if (parts.length >= 2 && method === "DELETE") {
    const bucket = parts[0];
    const key = parts.slice(1).join("/");
    return deleteObject(bucket, key);
  }

  return errorResponse("NotImplemented", "Operation not supported", 501);
};

async function listBuckets(): Promise<Response> {
  const buckets = await getAll("s3-buckets");
  const xml = buckets
    .map(
      (b) =>
        `<Bucket><Name>${b.name}</Name><CreationDate>${b.creationDate}</CreationDate></Bucket>`
    )
    .join("");
  return xmlResponse(
    `<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Buckets>${xml}</Buckets><Owner><ID>000000000000</ID><DisplayName>floci</DisplayName></Owner></ListAllMyBucketsResult>`
  );
}

async function createBucket(name: string): Promise<Response> {
  await put("s3-buckets", name, {
    name,
    creationDate: new Date().toISOString(),
  });
  return new Response(null, {
    status: 200,
    headers: { Location: `/${name}` },
  });
}

async function deleteBucket(name: string): Promise<Response> {
  await del("s3-buckets", name);
  return new Response(null, { status: 204 });
}

async function putObject(
  bucket: string,
  key: string,
  body: string
): Promise<Response> {
  const etag = `"${crypto.randomUUID().replace(/-/g, "")}"`;
  await put("s3-objects", `${bucket}/${key}`, {
    bucket,
    key,
    body,
    contentType: "application/octet-stream",
    size: new Blob([body]).size,
    lastModified: new Date().toISOString(),
    etag,
  });
  return new Response(null, {
    status: 200,
    headers: { ETag: etag },
  });
}

async function getObject(bucket: string, key: string): Promise<Response> {
  const obj = await get("s3-objects", `${bucket}/${key}`);
  if (!obj) return errorResponse("NoSuchKey", `The specified key does not exist.`, 404);
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      ETag: obj.etag,
      "Last-Modified": obj.lastModified,
    },
  });
}

async function listObjectsV2(
  bucket: string,
  params: URLSearchParams
): Promise<Response> {
  const prefix = params.get("prefix") || "";
  const allObjects = await getAll("s3-objects");
  const objects = allObjects.filter(
    (o) => o.bucket === bucket && o.key.startsWith(prefix)
  );
  const contentsXml = objects
    .map(
      (o) =>
        `<Contents><Key>${o.key}</Key><Size>${o.size}</Size><LastModified>${o.lastModified}</LastModified><ETag>${o.etag}</ETag><StorageClass>STANDARD</StorageClass></Contents>`
    )
    .join("");
  return xmlResponse(
    `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${bucket}</Name><Prefix>${prefix}</Prefix><KeyCount>${objects.length}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>${contentsXml}</ListBucketResult>`
  );
}

async function deleteObject(
  bucket: string,
  key: string
): Promise<Response> {
  await del("s3-objects", `${bucket}/${key}`);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: dev server で S3 操作をテスト**

ブラウザの DevTools Console で:
```js
await fetch("/mock-api/test-bucket", { method: "PUT" });
await fetch("/mock-api/").then(r => r.text());
```

ListBuckets の XML レスポンスに `test-bucket` が含まれることを確認。

- [ ] **Step 3: コミット**

```bash
git add browser-console/sw/services/s3.ts
git commit -m "feat: S3 モックサービス実装"
```

---

## Task 5: SQS モックサービス実装

**Files:**
- Modify: `browser-console/sw/services/sqs.ts`

- [ ] **Step 1: SQS ハンドラ実装**

SQS は Query プロトコル (URL-encoded form body) を使う。`Action` パラメータでオペレーションを判別。

```ts
import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { xmlResponse, errorResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const action = params.get("Action");

  switch (action) {
    case "CreateQueue": return createQueue(params);
    case "ListQueues": return listQueues();
    case "GetQueueUrl": return getQueueUrl(params);
    case "SendMessage": return sendMessage(params);
    case "ReceiveMessage": return receiveMessage(params);
    case "DeleteMessage": return deleteMessage(params);
    case "DeleteQueue": return deleteQueue(params);
    default:
      return errorResponse("InvalidAction", `Action ${action} not supported`, 400);
  }
};

async function createQueue(params: URLSearchParams): Promise<Response> {
  const name = params.get("QueueName")!;
  const queueUrl = `/mock-api/000000000000/${name}`;
  await put("sqs-queues", name, {
    name,
    url: queueUrl,
    arn: `arn:aws:sqs:us-east-1:000000000000:${name}`,
    attributes: {},
    createdTimestamp: String(Date.now()),
  });
  return xmlResponse(
    `<CreateQueueResponse><CreateQueueResult><QueueUrl>${queueUrl}</QueueUrl></CreateQueueResult></CreateQueueResponse>`
  );
}

async function listQueues(): Promise<Response> {
  const queues = await getAll("sqs-queues");
  const members = queues.map((q) => `<member>${q.url}</member>`).join("");
  return xmlResponse(
    `<ListQueuesResponse><ListQueuesResult><QueueUrls>${members}</QueueUrls></ListQueuesResult></ListQueuesResponse>`
  );
}

async function getQueueUrl(params: URLSearchParams): Promise<Response> {
  const name = params.get("QueueName")!;
  const queue = await get("sqs-queues", name);
  if (!queue) return errorResponse("AWS.SimpleQueueService.NonExistentQueue", "Queue not found", 400);
  return xmlResponse(
    `<GetQueueUrlResponse><GetQueueUrlResult><QueueUrl>${queue.url}</QueueUrl></GetQueueUrlResult></GetQueueUrlResponse>`
  );
}

async function sendMessage(params: URLSearchParams): Promise<Response> {
  const queueUrl = params.get("QueueUrl")!;
  const messageBody = params.get("MessageBody")!;
  const messageId = crypto.randomUUID();
  const md5 = messageId.replace(/-/g, "").slice(0, 32);
  const receiptHandle = crypto.randomUUID();

  await put("sqs-messages", messageId, {
    queueUrl,
    messageId,
    body: messageBody,
    receiptHandle,
    md5OfBody: md5,
    sentTimestamp: String(Date.now()),
  });

  return xmlResponse(
    `<SendMessageResponse><SendMessageResult><MessageId>${messageId}</MessageId><MD5OfMessageBody>${md5}</MD5OfMessageBody></SendMessageResult></SendMessageResponse>`
  );
}

async function receiveMessage(params: URLSearchParams): Promise<Response> {
  const queueUrl = params.get("QueueUrl")!;
  const max = parseInt(params.get("MaxNumberOfMessages") || "1", 10);
  const allMessages = await getAll("sqs-messages");
  const messages = allMessages.filter((m) => m.queueUrl === queueUrl).slice(0, max);

  const msgsXml = messages
    .map(
      (m) =>
        `<Message><MessageId>${m.messageId}</MessageId><ReceiptHandle>${m.receiptHandle}</ReceiptHandle><MD5OfBody>${m.md5OfBody}</MD5OfBody><Body>${m.body}</Body></Message>`
    )
    .join("");

  return xmlResponse(
    `<ReceiveMessageResponse><ReceiveMessageResult>${msgsXml}</ReceiveMessageResult></ReceiveMessageResponse>`
  );
}

async function deleteMessage(params: URLSearchParams): Promise<Response> {
  const receiptHandle = params.get("ReceiptHandle")!;
  const allMessages = await getAll("sqs-messages");
  const msg = allMessages.find((m) => m.receiptHandle === receiptHandle);
  if (msg) await del("sqs-messages", msg.messageId);
  return xmlResponse(
    `<DeleteMessageResponse><ResponseMetadata><RequestId>${crypto.randomUUID()}</RequestId></ResponseMetadata></DeleteMessageResponse>`
  );
}

async function deleteQueue(params: URLSearchParams): Promise<Response> {
  const queueUrl = params.get("QueueUrl")!;
  const queues = await getAll("sqs-queues");
  const queue = queues.find((q) => q.url === queueUrl);
  if (queue) await del("sqs-queues", queue.name);
  return xmlResponse(
    `<DeleteQueueResponse><ResponseMetadata><RequestId>${crypto.randomUUID()}</RequestId></ResponseMetadata></DeleteQueueResponse>`
  );
}
```

- [ ] **Step 2: dev server で動作確認**
- [ ] **Step 3: コミット**

```bash
git add browser-console/sw/services/sqs.ts
git commit -m "feat: SQS モックサービス実装"
```

---

## Task 6: SNS モックサービス実装

**Files:**
- Modify: `browser-console/sw/services/sns.ts`

- [ ] **Step 1: SNS ハンドラ実装**

SQS と同様の Query プロトコル。`Action` パラメータで判別。

```ts
import type { HandleFn } from "./types";
import { getAll, put, del } from "../store";
import { xmlResponse, errorResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const action = params.get("Action");

  switch (action) {
    case "CreateTopic": return createTopic(params);
    case "ListTopics": return listTopics();
    case "Subscribe": return subscribe(params);
    case "Publish": return publish(params);
    case "ListSubscriptions": return listSubscriptions();
    case "DeleteTopic": return deleteTopic(params);
    default:
      return errorResponse("InvalidAction", `Action ${action} not supported`, 400);
  }
};

async function createTopic(params: URLSearchParams): Promise<Response> {
  const name = params.get("Name")!;
  const arn = `arn:aws:sns:us-east-1:000000000000:${name}`;
  await put("sns-topics", name, { name, arn });
  return xmlResponse(
    `<CreateTopicResponse><CreateTopicResult><TopicArn>${arn}</TopicArn></CreateTopicResult></CreateTopicResponse>`
  );
}

async function listTopics(): Promise<Response> {
  const topics = await getAll("sns-topics");
  const members = topics
    .map((t) => `<member><TopicArn>${t.arn}</TopicArn></member>`)
    .join("");
  return xmlResponse(
    `<ListTopicsResponse><ListTopicsResult><Topics>${members}</Topics></ListTopicsResult></ListTopicsResponse>`
  );
}

async function subscribe(params: URLSearchParams): Promise<Response> {
  const topicArn = params.get("TopicArn")!;
  const protocol = params.get("Protocol")!;
  const endpoint = params.get("Endpoint")!;
  const subArn = `${topicArn}:${crypto.randomUUID()}`;
  await put("sns-subscriptions", subArn, {
    arn: subArn,
    topicArn,
    protocol,
    endpoint,
  });
  return xmlResponse(
    `<SubscribeResponse><SubscribeResult><SubscriptionArn>${subArn}</SubscriptionArn></SubscribeResult></SubscribeResponse>`
  );
}

async function publish(params: URLSearchParams): Promise<Response> {
  const messageId = crypto.randomUUID();
  return xmlResponse(
    `<PublishResponse><PublishResult><MessageId>${messageId}</MessageId></PublishResult></PublishResponse>`
  );
}

async function listSubscriptions(): Promise<Response> {
  const subs = await getAll("sns-subscriptions");
  const members = subs
    .map(
      (s) =>
        `<member><SubscriptionArn>${s.arn}</SubscriptionArn><TopicArn>${s.topicArn}</TopicArn><Protocol>${s.protocol}</Protocol><Endpoint>${s.endpoint}</Endpoint><Owner>000000000000</Owner></member>`
    )
    .join("");
  return xmlResponse(
    `<ListSubscriptionsResponse><ListSubscriptionsResult><Subscriptions>${members}</Subscriptions></ListSubscriptionsResult></ListSubscriptionsResponse>`
  );
}

async function deleteTopic(params: URLSearchParams): Promise<Response> {
  const arn = params.get("TopicArn")!;
  const topics = await getAll("sns-topics");
  const topic = topics.find((t) => t.arn === arn);
  if (topic) await del("sns-topics", topic.name);
  return xmlResponse(
    `<DeleteTopicResponse><ResponseMetadata><RequestId>${crypto.randomUUID()}</RequestId></ResponseMetadata></DeleteTopicResponse>`
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add browser-console/sw/services/sns.ts
git commit -m "feat: SNS モックサービス実装"
```

---

## Task 7: DynamoDB モックサービス実装

**Files:**
- Modify: `browser-console/sw/services/dynamodb.ts`

- [ ] **Step 1: DynamoDB ハンドラ実装**

DynamoDB は JSON プロトコル。`X-Amz-Target: DynamoDB_20120810.<Operation>` で判別。

```ts
import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { jsonResponse, jsonErrorResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("x-amz-target") || "";
  const operation = target.replace("DynamoDB_20120810.", "");
  const body = await request.json();

  switch (operation) {
    case "CreateTable": return createTable(body);
    case "ListTables": return listTables();
    case "DescribeTable": return describeTable(body);
    case "PutItem": return putItem(body);
    case "GetItem": return getItem(body);
    case "Scan": return scan(body);
    case "Query": return query(body);
    case "DeleteItem": return deleteItem(body);
    case "DeleteTable": return deleteTable(body);
    default:
      return jsonErrorResponse(
        "com.amazonaws.dynamodb.v20120810#UnknownOperationException",
        `Operation ${operation} not supported`,
        400
      );
  }
};

async function createTable(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const tableData = {
    tableName,
    keySchema: (body.KeySchema as Array<{ AttributeName: string; KeyType: string }>).map(
      (k) => ({ attributeName: k.AttributeName, keyType: k.KeyType })
    ),
    attributeDefinitions: (
      body.AttributeDefinitions as Array<{ AttributeName: string; AttributeType: string }>
    ).map((a) => ({ attributeName: a.AttributeName, attributeType: a.AttributeType })),
    billingMode: (body.BillingMode as string) || "PROVISIONED",
    tableStatus: "ACTIVE",
    creationDateTime: Date.now(),
    itemCount: 0,
  };
  await put("dynamodb-tables", tableName, tableData);
  return jsonResponse({
    TableDescription: {
      TableName: tableName,
      TableStatus: "ACTIVE",
      KeySchema: body.KeySchema,
      AttributeDefinitions: body.AttributeDefinitions,
      BillingModeSummary: { BillingMode: tableData.billingMode },
      CreationDateTime: tableData.creationDateTime / 1000,
      ItemCount: 0,
      TableArn: `arn:aws:dynamodb:us-east-1:000000000000:table/${tableName}`,
    },
  });
}

async function listTables(): Promise<Response> {
  const tables = await getAll("dynamodb-tables");
  return jsonResponse({ TableNames: tables.map((t) => t.tableName) });
}

async function describeTable(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const table = await get("dynamodb-tables", tableName);
  if (!table)
    return jsonErrorResponse(
      "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
      `Table ${tableName} not found`,
      400
    );
  return jsonResponse({
    Table: {
      TableName: table.tableName,
      TableStatus: table.tableStatus,
      KeySchema: table.keySchema.map((k) => ({
        AttributeName: k.attributeName,
        KeyType: k.keyType,
      })),
      AttributeDefinitions: table.attributeDefinitions.map((a) => ({
        AttributeName: a.attributeName,
        AttributeType: a.attributeType,
      })),
      BillingModeSummary: { BillingMode: table.billingMode },
      CreationDateTime: table.creationDateTime / 1000,
      ItemCount: table.itemCount,
      TableArn: `arn:aws:dynamodb:us-east-1:000000000000:table/${table.tableName}`,
    },
  });
}

async function putItem(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const item = body.Item as Record<string, unknown>;
  const table = await get("dynamodb-tables", tableName);
  if (!table)
    return jsonErrorResponse(
      "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
      `Table ${tableName} not found`,
      400
    );
  const pk = table.keySchema[0].attributeName;
  const pkValue = (item[pk] as Record<string, string>)?.S ||
    (item[pk] as Record<string, string>)?.N || "";
  const itemKey = `${tableName}::${pk}::${pkValue}`;
  await put("dynamodb-items", itemKey, { tableName, item });
  return jsonResponse({});
}

async function getItem(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const key = body.Key as Record<string, Record<string, string>>;
  const table = await get("dynamodb-tables", tableName);
  if (!table)
    return jsonErrorResponse(
      "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
      `Table ${tableName} not found`,
      400
    );
  const pk = table.keySchema[0].attributeName;
  const pkValue = key[pk]?.S || key[pk]?.N || "";
  const itemKey = `${tableName}::${pk}::${pkValue}`;
  const stored = await get("dynamodb-items", itemKey);
  if (!stored) return jsonResponse({});
  return jsonResponse({ Item: stored.item });
}

async function scan(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const allItems = await getAll("dynamodb-items");
  const items = allItems
    .filter((i) => i.tableName === tableName)
    .map((i) => i.item);
  return jsonResponse({ Items: items, Count: items.length, ScannedCount: items.length });
}

async function query(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const exprValues = (body.ExpressionAttributeValues || {}) as Record<
    string,
    Record<string, string>
  >;
  const table = await get("dynamodb-tables", tableName);
  if (!table)
    return jsonErrorResponse(
      "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
      `Table ${tableName} not found`,
      400
    );

  const pk = table.keySchema[0].attributeName;
  const pkPlaceholder = `:${pk}`;
  const queryPkValue = exprValues[pkPlaceholder]?.S || exprValues[pkPlaceholder]?.N;

  const allItems = await getAll("dynamodb-items");
  const items = allItems
    .filter((i) => {
      if (i.tableName !== tableName) return false;
      if (!queryPkValue) return true;
      const itemPk = i.item[pk] as Record<string, string> | undefined;
      return itemPk?.S === queryPkValue || itemPk?.N === queryPkValue;
    })
    .map((i) => i.item);

  return jsonResponse({ Items: items, Count: items.length, ScannedCount: items.length });
}

async function deleteItem(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const key = body.Key as Record<string, Record<string, string>>;
  const table = await get("dynamodb-tables", tableName);
  if (!table)
    return jsonErrorResponse(
      "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
      `Table ${tableName} not found`,
      400
    );
  const pk = table.keySchema[0].attributeName;
  const pkValue = key[pk]?.S || key[pk]?.N || "";
  await del("dynamodb-items", `${tableName}::${pk}::${pkValue}`);
  return jsonResponse({});
}

async function deleteTable(body: Record<string, unknown>): Promise<Response> {
  const tableName = body.TableName as string;
  const table = await get("dynamodb-tables", tableName);
  if (!table)
    return jsonErrorResponse(
      "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
      `Table ${tableName} not found`,
      400
    );
  await del("dynamodb-tables", tableName);
  const allItems = await getAll("dynamodb-items");
  for (const item of allItems) {
    if (item.tableName === tableName) {
      const pk = table.keySchema[0].attributeName;
      const pkValue = (item.item[pk] as Record<string, string>)?.S ||
        (item.item[pk] as Record<string, string>)?.N || "";
      await del("dynamodb-items", `${tableName}::${pk}::${pkValue}`);
    }
  }
  return jsonResponse({
    TableDescription: {
      TableName: tableName,
      TableStatus: "DELETING",
    },
  });
}
```

- [ ] **Step 2: コミット**

```bash
git add browser-console/sw/services/dynamodb.ts
git commit -m "feat: DynamoDB モックサービス実装"
```

---

## Task 8: Secrets Manager / SSM / Athena モックサービス実装

**Files:**
- Modify: `browser-console/sw/services/secrets-manager.ts`
- Modify: `browser-console/sw/services/ssm.ts`
- Modify: `browser-console/sw/services/athena.ts`

- [ ] **Step 1: Secrets Manager ハンドラ実装**

JSON プロトコル。`X-Amz-Target: secretsmanager.<Operation>` で判別。

```ts
import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { jsonResponse11, jsonErrorResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("x-amz-target") || "";
  const operation = target.replace("secretsmanager.", "");
  const body = await request.json();

  switch (operation) {
    case "CreateSecret": return createSecret(body);
    case "ListSecrets": return listSecrets();
    case "GetSecretValue": return getSecretValue(body);
    case "UpdateSecret": return updateSecret(body);
    case "DeleteSecret": return deleteSecret(body);
    default:
      return jsonErrorResponse("InvalidAction", `${operation} not supported`, 400);
  }
};

async function createSecret(body: Record<string, unknown>): Promise<Response> {
  const name = body.Name as string;
  const arn = `arn:aws:secretsmanager:us-east-1:000000000000:secret:${name}-${crypto.randomUUID().slice(0, 6)}`;
  const versionId = crypto.randomUUID();
  await put("secrets", name, {
    name,
    arn,
    secretString: (body.SecretString as string) || "",
    versionId,
    createdDate: Date.now(),
  });
  return jsonResponse11({ ARN: arn, Name: name, VersionId: versionId });
}

async function listSecrets(): Promise<Response> {
  const secrets = await getAll("secrets");
  return jsonResponse11({
    SecretList: secrets.map((s) => ({
      ARN: s.arn,
      Name: s.name,
      CreatedDate: s.createdDate / 1000,
    })),
  });
}

async function getSecretValue(body: Record<string, unknown>): Promise<Response> {
  const id = body.SecretId as string;
  const secret = await get("secrets", id);
  if (!secret)
    return jsonErrorResponse("ResourceNotFoundException", `Secret ${id} not found`, 400);
  return jsonResponse11({
    ARN: secret.arn,
    Name: secret.name,
    SecretString: secret.secretString,
    VersionId: secret.versionId,
    CreatedDate: secret.createdDate / 1000,
  });
}

async function updateSecret(body: Record<string, unknown>): Promise<Response> {
  const id = body.SecretId as string;
  const secret = await get("secrets", id);
  if (!secret)
    return jsonErrorResponse("ResourceNotFoundException", `Secret ${id} not found`, 400);
  const updated = {
    ...secret,
    secretString: (body.SecretString as string) || secret.secretString,
    versionId: crypto.randomUUID(),
  };
  await put("secrets", id, updated);
  return jsonResponse11({ ARN: updated.arn, Name: updated.name, VersionId: updated.versionId });
}

async function deleteSecret(body: Record<string, unknown>): Promise<Response> {
  const id = body.SecretId as string;
  await del("secrets", id);
  return jsonResponse11({ ARN: `arn:aws:secretsmanager:us-east-1:000000000000:secret:${id}`, Name: id });
}
```

- [ ] **Step 2: SSM ハンドラ実装**

```ts
import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { jsonResponse11, jsonErrorResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("x-amz-target") || "";
  const operation = target.replace("AmazonSSM.", "");
  const body = await request.json();

  switch (operation) {
    case "PutParameter": return putParameter(body);
    case "GetParameter": return getParameter(body);
    case "GetParametersByPath": return getParametersByPath(body);
    case "DeleteParameter": return deleteParameter(body);
    default:
      return jsonErrorResponse("InvalidAction", `${operation} not supported`, 400);
  }
};

async function putParameter(body: Record<string, unknown>): Promise<Response> {
  const name = body.Name as string;
  const existing = await get("ssm-parameters", name);
  const version = existing ? existing.version + 1 : 1;
  await put("ssm-parameters", name, {
    name,
    type: (body.Type as string) || "String",
    value: body.Value as string,
    version,
    lastModifiedDate: Date.now(),
  });
  return jsonResponse11({ Version: version });
}

async function getParameter(body: Record<string, unknown>): Promise<Response> {
  const name = body.Name as string;
  const param = await get("ssm-parameters", name);
  if (!param)
    return jsonErrorResponse("ParameterNotFound", `Parameter ${name} not found`, 400);
  return jsonResponse11({
    Parameter: {
      Name: param.name,
      Type: param.type,
      Value: param.value,
      Version: param.version,
      LastModifiedDate: param.lastModifiedDate / 1000,
      ARN: `arn:aws:ssm:us-east-1:000000000000:parameter${param.name}`,
    },
  });
}

async function getParametersByPath(body: Record<string, unknown>): Promise<Response> {
  const path = body.Path as string;
  const allParams = await getAll("ssm-parameters");
  const params = allParams.filter((p) => p.name.startsWith(path));
  return jsonResponse11({
    Parameters: params.map((p) => ({
      Name: p.name,
      Type: p.type,
      Value: p.value,
      Version: p.version,
      LastModifiedDate: p.lastModifiedDate / 1000,
      ARN: `arn:aws:ssm:us-east-1:000000000000:parameter${p.name}`,
    })),
  });
}

async function deleteParameter(body: Record<string, unknown>): Promise<Response> {
  const name = body.Name as string;
  await del("ssm-parameters", name);
  return jsonResponse11({});
}
```

- [ ] **Step 3: Athena ハンドラ実装**

Athena はモックモード。クエリIDは発行するが結果は常に空。

```ts
import type { HandleFn } from "./types";
import { get, getAll, put } from "../store";
import { jsonResponse11, jsonErrorResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("x-amz-target") || "";
  const operation = target.replace("AmazonAthena.", "");
  const body = await request.json();

  switch (operation) {
    case "StartQueryExecution": return startQueryExecution(body);
    case "GetQueryExecution": return getQueryExecution(body);
    case "GetQueryResults": return getQueryResults(body);
    case "ListQueryExecutions": return listQueryExecutions();
    default:
      return jsonErrorResponse("InvalidAction", `${operation} not supported`, 400);
  }
};

async function startQueryExecution(body: Record<string, unknown>): Promise<Response> {
  const id = crypto.randomUUID();
  const ctx = (body.QueryExecutionContext as Record<string, string>) || {};
  const resultConfig = (body.ResultConfiguration as Record<string, string>) || {};
  await put("athena-queries", id, {
    queryExecutionId: id,
    query: body.QueryString as string,
    database: ctx.Database || "default",
    outputLocation: resultConfig.OutputLocation || "",
    state: "SUCCEEDED",
    submissionDateTime: Date.now(),
  });
  return jsonResponse11({ QueryExecutionId: id });
}

async function getQueryExecution(body: Record<string, unknown>): Promise<Response> {
  const id = body.QueryExecutionId as string;
  const q = await get("athena-queries", id);
  if (!q)
    return jsonErrorResponse("InvalidRequestException", `Query ${id} not found`, 400);
  return jsonResponse11({
    QueryExecution: {
      QueryExecutionId: q.queryExecutionId,
      Query: q.query,
      QueryExecutionContext: { Database: q.database },
      ResultConfiguration: { OutputLocation: q.outputLocation },
      Status: { State: q.state, SubmissionDateTime: q.submissionDateTime / 1000 },
    },
  });
}

async function getQueryResults(_body: Record<string, unknown>): Promise<Response> {
  return jsonResponse11({
    ResultSet: {
      Rows: [],
      ResultSetMetadata: { ColumnInfo: [] },
    },
  });
}

async function listQueryExecutions(): Promise<Response> {
  const queries = await getAll("athena-queries");
  return jsonResponse11({
    QueryExecutionIds: queries.map((q) => q.queryExecutionId),
  });
}
```

- [ ] **Step 4: コミット**

```bash
git add browser-console/sw/services/secrets-manager.ts browser-console/sw/services/ssm.ts browser-console/sw/services/athena.ts
git commit -m "feat: Secrets Manager / SSM / Athena モックサービス実装"
```

---

## Task 9: プリセット定義 + 型定義

**Files:**
- Create: `browser-console/src/types.ts`
- Create: `browser-console/src/presets/s3.ts`
- Create: `browser-console/src/presets/sqs.ts`
- Create: `browser-console/src/presets/sns.ts`
- Create: `browser-console/src/presets/dynamodb.ts`
- Create: `browser-console/src/presets/secrets-manager.ts`
- Create: `browser-console/src/presets/ssm.ts`
- Create: `browser-console/src/presets/athena.ts`
- Create: `browser-console/src/presets/index.ts`

- [ ] **Step 1: src/types.ts 作成**

```ts
export type Field = {
  name: string;
  label: string;
  placeholder?: string;
  default?: string;
  type?: "text" | "textarea" | "number";
};

export type Preset = {
  id: string;
  service: string;
  label: string;
  description?: string;
  fields: Field[];
  code: (params: Record<string, string>) => string;
  run: (params: Record<string, string>) => Promise<unknown>;
};
```

- [ ] **Step 2: src/presets/s3.ts 作成**

各プリセットは `code()` (表示用 SDK コード文字列) と `run()` (実行関数) を持つ。

```ts
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import type { Preset } from "../types";

const client = new S3Client({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  forcePathStyle: true,
});

export const s3Presets: Preset[] = [
  {
    id: "s3-list-buckets",
    service: "S3",
    label: "List Buckets",
    fields: [],
    code: () =>
      `import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(new ListBucketsCommand({}));
console.log(result.Buckets);`,
    run: async () => {
      const result = await client.send(new ListBucketsCommand({}));
      return result;
    },
  },
  {
    id: "s3-create-bucket",
    service: "S3",
    label: "Create Bucket",
    fields: [{ name: "bucket", label: "Bucket name", default: "demo-bucket" }],
    code: (p) =>
      `import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new CreateBucketCommand({ Bucket: "${p.bucket}" })
);`,
    run: async (p) => {
      return client.send(new CreateBucketCommand({ Bucket: p.bucket }));
    },
  },
  {
    id: "s3-put-object",
    service: "S3",
    label: "Put Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
      { name: "body", label: "Body", type: "textarea", default: "Hello from browser console!" },
    ],
    code: (p) =>
      `import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new PutObjectCommand({
    Bucket: "${p.bucket}",
    Key: "${p.key}",
    Body: "${p.body}",
  })
);`,
    run: async (p) => {
      return client.send(
        new PutObjectCommand({ Bucket: p.bucket, Key: p.key, Body: p.body })
      );
    },
  },
  {
    id: "s3-get-object",
    service: "S3",
    label: "Get Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
    code: (p) =>
      `import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new GetObjectCommand({ Bucket: "${p.bucket}", Key: "${p.key}" })
);
const body = await result.Body.transformToString();`,
    run: async (p) => {
      const result = await client.send(
        new GetObjectCommand({ Bucket: p.bucket, Key: p.key })
      );
      const body = await result.Body?.transformToString();
      return { ...result, BodyText: body };
    },
  },
  {
    id: "s3-list-objects",
    service: "S3",
    label: "List Objects",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    code: (p) =>
      `import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const result = await client.send(
  new ListObjectsV2Command({ Bucket: "${p.bucket}" })
);
console.log(result.Contents);`,
    run: async (p) => {
      return client.send(new ListObjectsV2Command({ Bucket: p.bucket }));
    },
  },
  {
    id: "s3-delete-object",
    service: "S3",
    label: "Delete Object",
    fields: [
      { name: "bucket", label: "Bucket", default: "demo-bucket" },
      { name: "key", label: "Key", default: "hello.txt" },
    ],
    code: (p) =>
      `import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
await client.send(
  new DeleteObjectCommand({ Bucket: "${p.bucket}", Key: "${p.key}" })
);`,
    run: async (p) => {
      return client.send(
        new DeleteObjectCommand({ Bucket: p.bucket, Key: p.key })
      );
    },
  },
  {
    id: "s3-delete-bucket",
    service: "S3",
    label: "Delete Bucket",
    fields: [{ name: "bucket", label: "Bucket", default: "demo-bucket" }],
    code: (p) =>
      `import { S3Client, DeleteBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
await client.send(
  new DeleteBucketCommand({ Bucket: "${p.bucket}" })
);`,
    run: async (p) => {
      return client.send(new DeleteBucketCommand({ Bucket: p.bucket }));
    },
  },
];
```

- [ ] **Step 3: 残り6サービスのプリセット作成**

同じパターンで `sqs.ts`, `sns.ts`, `dynamodb.ts`, `secrets-manager.ts`, `ssm.ts`, `athena.ts` を作成。各ファイルは:
- サービスの SDK クライアントをインスタンス化（`endpoint: location.origin + "/mock-api"`）
- 設計ドキュメントに記載の各オペレーションに対応するプリセットを定義
- `code()` は本物のAWSで動くコードを返す（endpointの指定なし）
- `run()` はモックエンドポイント向きのクライアントで実行
- `fields` は既存 `server.tsx` の PRESETS から移植（デフォルト値含む）

各ファイルの export 名: `sqsPresets`, `snsPresets`, `dynamodbPresets`, `secretsManagerPresets`, `ssmPresets`, `athenaPresets`

- [ ] **Step 4: src/presets/index.ts 作成**

```ts
import { s3Presets } from "./s3";
import { sqsPresets } from "./sqs";
import { snsPresets } from "./sns";
import { dynamodbPresets } from "./dynamodb";
import { secretsManagerPresets } from "./secrets-manager";
import { ssmPresets } from "./ssm";
import { athenaPresets } from "./athena";
import type { Preset } from "../types";

export const ALL_PRESETS: Preset[] = [
  ...s3Presets,
  ...sqsPresets,
  ...snsPresets,
  ...dynamodbPresets,
  ...secretsManagerPresets,
  ...ssmPresets,
  ...athenaPresets,
];

export const SERVICES = [
  "S3", "SQS", "SNS", "DynamoDB", "Secrets Manager", "SSM", "Athena",
] as const;

export function getPresetsByService(service: string): Preset[] {
  return ALL_PRESETS.filter((p) => p.service === service);
}
```

- [ ] **Step 5: コミット**

```bash
git add browser-console/src/types.ts browser-console/src/presets/
git commit -m "feat: プリセット定義 (7サービス分)"
```

---

## Task 10: UI 実装 — レイアウト + サイドバー

**Files:**
- Create: `browser-console/src/ui/layout.ts`
- Create: `browser-console/src/ui/sidebar.ts`
- Modify: `browser-console/src/main.ts`

- [ ] **Step 1: src/ui/layout.ts 作成**

```ts
export function createLayout(): {
  sidebar: HTMLElement;
  codePanel: HTMLElement;
  resultPanel: HTMLElement;
  runButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  paramsPanel: HTMLElement;
} {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  app.innerHTML = `
    <div class="flex flex-col h-screen">
      <header class="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <h1 class="text-lg font-bold text-white">Floci Browser Console</h1>
        <button id="reset-btn" class="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300">Reset</button>
      </header>
      <div class="flex flex-1 overflow-hidden">
        <aside id="sidebar" class="w-64 overflow-y-auto border-r border-gray-800 bg-gray-900"></aside>
        <main class="flex-1 flex flex-col overflow-hidden">
          <div id="params-panel" class="border-b border-gray-800 p-4 bg-gray-900 hidden"></div>
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex-1 overflow-auto border-b border-gray-800 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-500 uppercase tracking-wide">Code Preview</span>
              </div>
              <pre id="code-panel" class="text-sm font-mono text-gray-300 whitespace-pre-wrap"></pre>
            </div>
            <div class="p-3 border-b border-gray-800 bg-gray-900">
              <button id="run-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50" disabled>▶ 実行</button>
            </div>
            <div class="flex-1 overflow-auto p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-500 uppercase tracking-wide">Result</span>
              </div>
              <pre id="result-panel" class="text-sm font-mono text-gray-400 whitespace-pre-wrap"></pre>
            </div>
          </div>
        </main>
      </div>
      <footer class="px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-600">
        ⚠ Lambda, RDS, ElastiCache, EC2, ECS はブラウザ版では利用できません (Docker コンテナが必要なため)
      </footer>
    </div>
  `;

  return {
    sidebar: document.getElementById("sidebar")!,
    codePanel: document.getElementById("code-panel")!,
    resultPanel: document.getElementById("result-panel")!,
    runButton: document.getElementById("run-btn") as HTMLButtonElement,
    resetButton: document.getElementById("reset-btn") as HTMLButtonElement,
    paramsPanel: document.getElementById("params-panel")!,
  };
}
```

- [ ] **Step 2: src/ui/sidebar.ts 作成**

```ts
import { SERVICES, getPresetsByService } from "../presets";
import type { Preset } from "../types";

export function renderSidebar(
  container: HTMLElement,
  onSelect: (preset: Preset) => void
): void {
  container.innerHTML = "";

  for (const service of SERVICES) {
    const presets = getPresetsByService(service);
    const section = document.createElement("div");
    section.className = "border-b border-gray-800";

    const header = document.createElement("button");
    header.className =
      "w-full text-left px-4 py-2 text-sm font-semibold text-gray-400 hover:bg-gray-800 flex items-center gap-1";
    header.textContent = service;

    const list = document.createElement("div");
    list.className = "hidden";

    header.addEventListener("click", () => {
      list.classList.toggle("hidden");
    });

    for (const preset of presets) {
      const item = document.createElement("button");
      item.className =
        "w-full text-left px-6 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white";
      item.textContent = preset.label;
      item.dataset.presetId = preset.id;
      item.addEventListener("click", () => {
        container
          .querySelectorAll("[data-preset-id]")
          .forEach((el) => el.classList.remove("bg-gray-800", "text-white"));
        item.classList.add("bg-gray-800", "text-white");
        onSelect(preset);
      });
      list.appendChild(item);
    }

    section.appendChild(header);
    section.appendChild(list);
    container.appendChild(section);
  }
}
```

- [ ] **Step 3: src/main.ts を更新**

```ts
import { registerServiceWorker } from "./sw-register";
import { createLayout } from "./ui/layout";
import { renderSidebar } from "./ui/sidebar";
import type { Preset } from "./types";

let currentPreset: Preset | null = null;
let currentParams: Record<string, string> = {};

async function init() {
  await registerServiceWorker();

  const { sidebar, codePanel, resultPanel, runButton, resetButton, paramsPanel } =
    createLayout();

  renderSidebar(sidebar, (preset) => {
    currentPreset = preset;
    currentParams = {};
    for (const f of preset.fields) {
      currentParams[f.name] = f.default || "";
    }
    renderParams(paramsPanel, preset);
    codePanel.textContent = preset.code(currentParams);
    resultPanel.textContent = "";
    runButton.disabled = false;
  });

  runButton.addEventListener("click", async () => {
    if (!currentPreset) return;
    runButton.disabled = true;
    resultPanel.textContent = "実行中...";
    try {
      const result = await currentPreset.run(currentParams);
      resultPanel.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
      resultPanel.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      runButton.disabled = false;
    }
  });

  resetButton.addEventListener("click", async () => {
    if (!confirm("データをリセットしますか？")) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "reset" });
    location.reload();
  });
}

function renderParams(container: HTMLElement, preset: Preset): void {
  if (preset.fields.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  container.innerHTML = "";

  for (const field of preset.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-2";

    const label = document.createElement("label");
    label.className = "block text-xs text-gray-500 mb-1";
    label.textContent = field.label;

    const input =
      field.type === "textarea"
        ? document.createElement("textarea")
        : document.createElement("input");
    input.className =
      "w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200";
    input.value = field.default || "";

    input.addEventListener("input", () => {
      currentParams[field.name] = input.value;
      const codePanel = document.getElementById("code-panel")!;
      codePanel.textContent = currentPreset!.code(currentParams);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }
}

init();
```

- [ ] **Step 4: ブラウザで動作確認**

サイドバーからサービスを展開 → 操作を選択 → コードプレビュー表示 → 実行 → 結果表示を一通り確認。

- [ ] **Step 5: コミット**

```bash
git add browser-console/src/
git commit -m "feat: UI レイアウト + サイドバー + メインループ"
```

---

## Task 11: コードハイライト (Shiki)

**Files:**
- Create: `browser-console/src/ui/code-preview.ts`
- Modify: `browser-console/src/main.ts`

- [ ] **Step 1: src/ui/code-preview.ts 作成**

```ts
import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript"],
    });
  }
  return highlighter;
}

export async function renderCode(
  container: HTMLElement,
  code: string
): Promise<void> {
  const hl = await getHighlighter();
  container.innerHTML = hl.codeToHtml(code, {
    lang: "typescript",
    theme: "github-dark",
  });
}
```

- [ ] **Step 2: src/main.ts を更新して Shiki ハイライトを使う**

`codePanel.textContent = ...` の箇所を `renderCode(codePanel, ...)` に変更。

```ts
import { renderCode } from "./ui/code-preview";

// サイドバー選択時:
renderCode(codePanel, preset.code(currentParams));

// パラメータ変更時:
renderCode(codePanel, currentPreset!.code(currentParams));
```

- [ ] **Step 3: 動作確認 + コミット**

```bash
git add browser-console/src/ui/code-preview.ts browser-console/src/main.ts
git commit -m "feat: Shiki によるコードハイライト"
```

---

## Task 12: Service Worker リセット機能

**Files:**
- Modify: `browser-console/sw/index.ts`

- [ ] **Step 1: SW に message ハンドラを追加**

```ts
import { clearAll } from "./store";
import { seedInitialData } from "./seed";

self.addEventListener("message", (event) => {
  if (event.data?.type === "reset") {
    event.waitUntil(
      clearAll().then(() => seedInitialData())
    );
  }
});
```

- [ ] **Step 2: 動作確認**

Reset ボタンを押して、データがリセットされシード状態に戻ることを確認。

- [ ] **Step 3: コミット**

```bash
git add browser-console/sw/index.ts
git commit -m "feat: Service Worker リセット機能"
```

---

## Task 13: GitHub Pages デプロイ設定

**Files:**
- Create: `browser-console/.github/workflows/deploy.yml`

- [ ] **Step 1: deploy.yml 作成**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths: [browser-console/**]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: browser-console/package-lock.json
      - run: npm ci
        working-directory: browser-console
      - run: npm run build
        working-directory: browser-console
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: browser-console/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: vite.config.ts に base パス追加**

GitHub Pages はリポジトリ名がパスに入るため:

```ts
export default defineConfig({
  base: "/learn-floci/",
  // ... existing config
});
```

- [ ] **Step 3: SW 登録パスも base を考慮するよう修正**

`src/sw-register.ts` の register パスを `/learn-floci/sw.js` に変更。

```ts
const base = import.meta.env.BASE_URL;
const reg = await navigator.serviceWorker.register(`${base}sw.js`, {
  scope: base,
});
```

- [ ] **Step 4: コミット**

```bash
git add browser-console/.github/ browser-console/vite.config.ts browser-console/src/sw-register.ts
git commit -m "feat: GitHub Pages デプロイ設定"
```

---

## Task 14: README + 最終動作確認

**Files:**
- Create: `browser-console/README.md`

- [ ] **Step 1: README.md 作成**

```markdown
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

\`\`\`bash
npm install
npm run dev
\`\`\`

## ビルド

\`\`\`bash
npm run build
npm run preview
\`\`\`

## デプロイ

main ブランチへの push で GitHub Pages に自動デプロイされます。
```

- [ ] **Step 2: 全体動作確認**

```bash
cd browser-console
npm run build
npm run preview
```

ブラウザで以下を確認:
1. 初回アクセスで SW 登録 + シードデータ投入
2. サイドバーから各サービスの操作を選択 → コードプレビュー表示
3. パラメータ変更 → コードプレビューにリアルタイム反映
4. 実行 → 結果 JSON 表示
5. Reset → データ初期化
6. 各サービス (S3, SQS, SNS, DynamoDB, Secrets Manager, SSM, Athena) で一通り操作

- [ ] **Step 3: コミット**

```bash
git add browser-console/README.md
git commit -m "docs: browser-console README 追加"
```
