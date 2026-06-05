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
          "s3-buckets", "s3-objects",
          "sqs-queues", "sqs-messages",
          "sns-topics", "sns-subscriptions",
          "dynamodb-tables", "dynamodb-items",
          "secrets", "ssm-parameters", "athena-queries",
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

export async function getAll<T extends StoreName>(store: T): Promise<FlociDB[T]["value"][]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function get<T extends StoreName>(store: T, key: string): Promise<FlociDB[T]["value"] | undefined> {
  const db = await getDB();
  return db.get(store, key);
}

export async function put<T extends StoreName>(store: T, key: string, value: FlociDB[T]["value"]): Promise<void> {
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
  const storeNames = Array.from(db.objectStoreNames) as StoreName[];
  const tx = db.transaction(storeNames, "readwrite");
  await Promise.all(storeNames.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}

export type { FlociDB, StoreName };
