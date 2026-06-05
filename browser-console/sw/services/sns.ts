import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { xmlResponse } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const action = params.get("Action");

  // CreateTopic
  if (action === "CreateTopic") {
    const topicName = params.get("Name")!;
    const arn = `arn:aws:sns:us-east-1:000000000000:${topicName}`;
    await put("sns-topics", arn, { name: topicName, arn });
    return xmlResponse(
      `<CreateTopicResponse><CreateTopicResult><TopicArn>${arn}</TopicArn></CreateTopicResult></CreateTopicResponse>`
    );
  }

  // ListTopics
  if (action === "ListTopics") {
    const topics = await getAll("sns-topics");
    const topicsXml = topics
      .map((t) => `<member><TopicArn>${t.arn}</TopicArn></member>`)
      .join("");
    return xmlResponse(
      `<ListTopicsResponse><ListTopicsResult><Topics>${topicsXml}</Topics></ListTopicsResult></ListTopicsResponse>`
    );
  }

  // Subscribe
  if (action === "Subscribe") {
    const topicArn = params.get("TopicArn")!;
    const protocol = params.get("Protocol")!;
    const endpoint = params.get("Endpoint")!;
    const subscriptionArn = `${topicArn}:${crypto.randomUUID()}`;

    await put("sns-subscriptions", subscriptionArn, {
      arn: subscriptionArn,
      topicArn,
      protocol,
      endpoint,
    });

    return xmlResponse(
      `<SubscribeResponse><SubscribeResult><SubscriptionArn>${subscriptionArn}</SubscriptionArn></SubscribeResult></SubscribeResponse>`
    );
  }

  // Publish
  if (action === "Publish") {
    const messageId = crypto.randomUUID();
    return xmlResponse(
      `<PublishResponse><PublishResult><MessageId>${messageId}</MessageId></PublishResult></PublishResponse>`
    );
  }

  // ListSubscriptions
  if (action === "ListSubscriptions") {
    const subscriptions = await getAll("sns-subscriptions");
    const subsXml = subscriptions
      .map(
        (s) =>
          `<member><SubscriptionArn>${s.arn}</SubscriptionArn><TopicArn>${s.topicArn}</TopicArn><Protocol>${s.protocol}</Protocol><Endpoint>${s.endpoint}</Endpoint></member>`
      )
      .join("");
    return xmlResponse(
      `<ListSubscriptionsResponse><ListSubscriptionsResult><Subscriptions>${subsXml}</Subscriptions></ListSubscriptionsResult></ListSubscriptionsResponse>`
    );
  }

  // DeleteTopic
  if (action === "DeleteTopic") {
    const topicArn = params.get("TopicArn")!;
    await del("sns-topics", topicArn);
    // Also delete all subscriptions for this topic
    const allSubs = await getAll("sns-subscriptions");
    for (const sub of allSubs.filter((s) => s.topicArn === topicArn)) {
      await del("sns-subscriptions", sub.arn);
    }
    return xmlResponse(
      `<DeleteTopicResponse><DeleteTopicResult/></DeleteTopicResponse>`
    );
  }

  return new Response("Unknown Action", { status: 400 });
};
