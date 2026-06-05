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
