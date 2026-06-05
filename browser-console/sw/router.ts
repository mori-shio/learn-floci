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

  // URL path-based detection for SQS (form-encoded body with Action param)
  // and S3 (path-based bucket/key operations)
  const path = url.pathname.replace(/^\/mock-api/, "");
  if (path === "/" || path === "") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("x-www-form-urlencoded")) return "sqs";
    return "s3";
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
