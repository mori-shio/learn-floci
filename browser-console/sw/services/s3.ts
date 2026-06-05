import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { xmlResponse, errorResponse } from "../response";

export const handle: HandleFn = async (request, url) => {
  const path = url.pathname.replace("/mock-api/", "");
  const method = request.method;

  // ListBuckets: GET /mock-api/
  if (method === "GET" && path === "") {
    const buckets = await getAll("s3-buckets");
    const bucketsXml = buckets
      .map((b) => `<Bucket><Name>${b.name}</Name><CreationDate>${b.creationDate}</CreationDate></Bucket>`)
      .join("");
    return xmlResponse(
      `<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Buckets>${bucketsXml}</Buckets><Owner><ID>000000000000</ID><DisplayName>floci</DisplayName></Owner></ListAllMyBucketsResult>`
    );
  }

  const parts = path.split("/");
  const bucket = parts[0];
  const key = parts.slice(1).join("/");

  // CreateBucket: PUT /mock-api/{bucket}
  if (method === "PUT" && key === "") {
    await put("s3-buckets", bucket, {
      name: bucket,
      creationDate: new Date().toISOString(),
    });
    return new Response(null, { status: 200 });
  }

  // DeleteBucket: DELETE /mock-api/{bucket}
  if (method === "DELETE" && key === "") {
    await del("s3-buckets", bucket);
    return new Response(null, { status: 204 });
  }

  // ListObjectsV2: GET /mock-api/{bucket} or GET /mock-api/{bucket}?list-type=2
  if (method === "GET" && key === "") {
    const allObjects = await getAll("s3-objects");
    const objects = allObjects.filter((obj) => obj.bucket === bucket);
    const prefix = url.searchParams.get("prefix") || "";
    const filteredObjects = objects.filter((obj) => obj.key.startsWith(prefix));

    const contentsXml = filteredObjects
      .map(
        (obj) =>
          `<Contents><Key>${obj.key}</Key><Size>${obj.size}</Size><LastModified>${obj.lastModified}</LastModified><ETag>${obj.etag}</ETag><StorageClass>STANDARD</StorageClass></Contents>`
      )
      .join("");

    return xmlResponse(
      `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${bucket}</Name><Prefix>${prefix}</Prefix><KeyCount>${filteredObjects.length}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>${contentsXml}</ListBucketResult>`
    );
  }

  // PutObject: PUT /mock-api/{bucket}/{key...}
  if (method === "PUT" && key !== "") {
    const body = await request.text();
    const contentType = request.headers.get("Content-Type") || "application/octet-stream";
    const etag = `"${crypto.randomUUID().replace(/-/g, "")}"`;
    const lastModified = new Date().toISOString();

    await put("s3-objects", `${bucket}/${key}`, {
      bucket,
      key,
      body,
      contentType,
      size: body.length,
      lastModified,
      etag,
    });

    return new Response(null, {
      status: 200,
      headers: { ETag: etag },
    });
  }

  // GetObject: GET /mock-api/{bucket}/{key...}
  if (method === "GET" && key !== "") {
    const obj = await get("s3-objects", `${bucket}/${key}`);
    if (!obj) {
      return errorResponse("NoSuchKey", "The specified key does not exist.", 404);
    }
    return new Response(obj.body, {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        ETag: obj.etag,
        "Last-Modified": obj.lastModified,
      },
    });
  }

  // DeleteObject: DELETE /mock-api/{bucket}/{key...}
  if (method === "DELETE" && key !== "") {
    await del("s3-objects", `${bucket}/${key}`);
    return new Response(null, { status: 204 });
  }

  return new Response("Not Found", { status: 404 });
};
