import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { jsonResponse, jsonErrorResponse } from "../response";

function extractPrimaryKey(
  item: Record<string, unknown>,
  keySchema: Array<{ attributeName: string; keyType: string }>
): string {
  const pkAttr = keySchema.find((k) => k.keyType === "HASH");
  if (!pkAttr) return "";

  const attrValue = item[pkAttr.attributeName] as Record<string, unknown> | undefined;
  if (!attrValue) return "";

  // Extract value from attribute type (S or N)
  if (attrValue.S) return String(attrValue.S);
  if (attrValue.N) return String(attrValue.N);

  return "";
}

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("X-Amz-Target") || "";
  const operation = target.split(".")[1];
  const body = await request.json();

  // CreateTable
  if (operation === "CreateTable") {
    const tableName = body.TableName;
    const keySchema = body.KeySchema || [];
    const attributeDefinitions = body.AttributeDefinitions || [];
    const billingMode = body.BillingMode || "PAY_PER_REQUEST";

    const table = {
      tableName,
      keySchema,
      attributeDefinitions,
      billingMode,
      tableStatus: "ACTIVE",
      creationDateTime: Date.now(),
      itemCount: 0,
    };

    await put("dynamodb-tables", tableName, table);

    return jsonResponse({
      TableDescription: {
        TableName: tableName,
        TableStatus: "ACTIVE",
        CreationDateTime: table.creationDateTime / 1000,
        KeySchema: keySchema,
        AttributeDefinitions: attributeDefinitions,
        BillingModeSummary: { BillingMode: billingMode },
        ItemCount: 0,
      },
    });
  }

  // ListTables
  if (operation === "ListTables") {
    const tables = await getAll("dynamodb-tables");
    return jsonResponse({
      TableNames: tables.map((t) => t.tableName),
    });
  }

  // DescribeTable
  if (operation === "DescribeTable") {
    const tableName = body.TableName;
    const table = await get("dynamodb-tables", tableName);
    if (!table) {
      return jsonErrorResponse(
        "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
        "Requested resource not found",
        400
      );
    }

    return jsonResponse({
      Table: {
        TableName: table.tableName,
        TableStatus: table.tableStatus,
        CreationDateTime: table.creationDateTime / 1000,
        KeySchema: table.keySchema,
        AttributeDefinitions: table.attributeDefinitions,
        BillingModeSummary: { BillingMode: table.billingMode },
        ItemCount: table.itemCount,
      },
    });
  }

  // PutItem
  if (operation === "PutItem") {
    const tableName = body.TableName;
    const item = body.Item;

    const table = await get("dynamodb-tables", tableName);
    if (!table) {
      return jsonErrorResponse(
        "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
        "Requested resource not found",
        400
      );
    }

    const pkValue = extractPrimaryKey(item, table.keySchema);
    const itemKey = `${tableName}::${table.keySchema[0].attributeName}::${pkValue}`;

    await put("dynamodb-items", itemKey, { tableName, item });

    return jsonResponse({});
  }

  // GetItem
  if (operation === "GetItem") {
    const tableName = body.TableName;
    const key = body.Key;

    const table = await get("dynamodb-tables", tableName);
    if (!table) {
      return jsonErrorResponse(
        "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
        "Requested resource not found",
        400
      );
    }

    const pkAttr = table.keySchema.find((k) => k.keyType === "HASH");
    if (!pkAttr) {
      return jsonResponse({});
    }

    const keyValue = key[pkAttr.attributeName];
    const pkValue = keyValue?.S || keyValue?.N || "";
    const itemKey = `${tableName}::${pkAttr.attributeName}::${pkValue}`;

    const record = await get("dynamodb-items", itemKey);
    if (!record) {
      return jsonResponse({});
    }

    return jsonResponse({ Item: record.item });
  }

  // Scan
  if (operation === "Scan") {
    const tableName = body.TableName;
    const allItems = await getAll("dynamodb-items");
    const items = allItems.filter((i) => i.tableName === tableName);

    return jsonResponse({
      Items: items.map((i) => i.item),
      Count: items.length,
      ScannedCount: items.length,
    });
  }

  // Query
  if (operation === "Query") {
    const tableName = body.TableName;
    const allItems = await getAll("dynamodb-items");
    const items = allItems.filter((i) => i.tableName === tableName);

    // Simple filter by key condition expression attribute values
    const expressionAttributeValues = body.ExpressionAttributeValues || {};
    let filtered = items;

    if (Object.keys(expressionAttributeValues).length > 0) {
      const firstValue = Object.values(expressionAttributeValues)[0] as Record<string, unknown>;
      const searchValue = firstValue.S || firstValue.N || "";

      filtered = items.filter((i) => {
        const itemValues = Object.values(i.item).map((attr: unknown) => {
          const a = attr as Record<string, unknown>;
          return a.S || a.N || "";
        });
        return itemValues.some((v) => v === searchValue);
      });
    }

    return jsonResponse({
      Items: filtered.map((i) => i.item),
      Count: filtered.length,
      ScannedCount: items.length,
    });
  }

  // DeleteItem
  if (operation === "DeleteItem") {
    const tableName = body.TableName;
    const key = body.Key;

    const table = await get("dynamodb-tables", tableName);
    if (!table) {
      return jsonErrorResponse(
        "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
        "Requested resource not found",
        400
      );
    }

    const pkAttr = table.keySchema.find((k) => k.keyType === "HASH");
    if (pkAttr) {
      const keyValue = key[pkAttr.attributeName];
      const pkValue = keyValue?.S || keyValue?.N || "";
      const itemKey = `${tableName}::${pkAttr.attributeName}::${pkValue}`;
      await del("dynamodb-items", itemKey);
    }

    return jsonResponse({});
  }

  // DeleteTable
  if (operation === "DeleteTable") {
    const tableName = body.TableName;
    await del("dynamodb-tables", tableName);

    // Delete all items for this table
    const allItems = await getAll("dynamodb-items");
    for (const item of allItems.filter((i) => i.tableName === tableName)) {
      const table = await get("dynamodb-tables", tableName);
      if (table) {
        const pkValue = extractPrimaryKey(item.item, table.keySchema);
        const itemKey = `${tableName}::${table.keySchema[0].attributeName}::${pkValue}`;
        await del("dynamodb-items", itemKey);
      }
    }

    return jsonResponse({
      TableDescription: {
        TableName: tableName,
        TableStatus: "DELETING",
      },
    });
  }

  return new Response("Unknown Operation", { status: 400 });
};
