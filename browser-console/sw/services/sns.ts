import type { HandleFn } from "./types";
import { getAll, put, del } from "../store";
import { xmlResponse, jsonResponse } from "../response";

function extractAction(request: Request): { action: string; isJson: boolean } {
  const target = request.headers.get("x-amz-target") || "";
  if (target.startsWith("AmazonSNS.")) {
    return { action: target.replace("AmazonSNS.", ""), isJson: true };
  }
  return { action: "", isJson: false };
}

export const handle: HandleFn = async (request, _url) => {
  const { action: targetAction, isJson } = extractAction(request);
  const bodyText = await request.text();

  if (isJson) {
    return handleJson(targetAction, bodyText);
  }

  const params = new URLSearchParams(bodyText);
  const action = params.get("Action") || "";
  return handleQuery(action, params);
};

async function handleJson(action: string, bodyText: string): Promise<Response> {
  const body = JSON.parse(bodyText || "{}");

  if (action === "CreateTopic") {
    const topicName = body.Name;
    const arn = `arn:aws:sns:us-east-1:000000000000:${topicName}`;
    await put("sns-topics", arn, { name: topicName, arn });
    return jsonResponse({ TopicArn: arn });
  }

  if (action === "ListTopics") {
    const topics = await getAll("sns-topics");
    return jsonResponse({
      Topics: topics.map((t) => ({ TopicArn: t.arn })),
    });
  }

  if (action === "Subscribe") {
    const subscriptionArn = `${body.TopicArn}:${crypto.randomUUID()}`;
    await put("sns-subscriptions", subscriptionArn, {
      arn: subscriptionArn,
      topicArn: body.TopicArn,
      protocol: body.Protocol,
      endpoint: body.Endpoint,
    });
    return jsonResponse({ SubscriptionArn: subscriptionArn });
  }

  if (action === "Publish") {
    return jsonResponse({ MessageId: crypto.randomUUID() });
  }

  if (action === "ListSubscriptions") {
    const subscriptions = await getAll("sns-subscriptions");
    return jsonResponse({
      Subscriptions: subscriptions.map((s) => ({
        SubscriptionArn: s.arn,
        TopicArn: s.topicArn,
        Protocol: s.protocol,
        Endpoint: s.endpoint,
      })),
    });
  }

  if (action === "DeleteTopic") {
    await del("sns-topics", body.TopicArn);
    const allSubs = await getAll("sns-subscriptions");
    for (const sub of allSubs.filter((s) => s.topicArn === body.TopicArn)) {
      await del("sns-subscriptions", sub.arn);
    }
    return jsonResponse({});
  }

  return new Response(JSON.stringify({ error: `Unknown SNS action: ${action}` }), {
    status: 400, headers: { "Content-Type": "application/json" },
  });
}

async function handleQuery(action: string, params: URLSearchParams): Promise<Response> {
  if (action === "CreateTopic") {
    const topicName = params.get("Name")!;
    const arn = `arn:aws:sns:us-east-1:000000000000:${topicName}`;
    await put("sns-topics", arn, { name: topicName, arn });
    return xmlResponse(
      `<CreateTopicResponse><CreateTopicResult><TopicArn>${arn}</TopicArn></CreateTopicResult></CreateTopicResponse>`
    );
  }

  if (action === "ListTopics") {
    const topics = await getAll("sns-topics");
    const topicsXml = topics
      .map((t) => `<member><TopicArn>${t.arn}</TopicArn></member>`)
      .join("");
    return xmlResponse(
      `<ListTopicsResponse><ListTopicsResult><Topics>${topicsXml}</Topics></ListTopicsResult></ListTopicsResponse>`
    );
  }

  return new Response("Unknown Action", { status: 400 });
}
