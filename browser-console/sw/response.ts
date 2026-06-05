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

export function errorResponse(code: string, message: string, status: number): Response {
  return xmlResponse(
    `<ErrorResponse><Error><Code>${code}</Code><Message>${message}</Message></Error></ErrorResponse>`,
    status
  );
}

export function jsonErrorResponse(type: string, message: string, status: number): Response {
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
