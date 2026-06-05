import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { jsonResponse11 } from "../response";

function generateSecretArn(name: string): string {
  const suffix = crypto.randomUUID().substring(0, 6);
  return `arn:aws:secretsmanager:us-east-1:000000000000:secret:${name}-${suffix}`;
}

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("X-Amz-Target") || "";
  const operation = target.split(".")[1];
  const body = await request.json();

  // CreateSecret
  if (operation === "CreateSecret") {
    const name = body.Name;
    const secretString = body.SecretString || "";
    const arn = generateSecretArn(name);
    const versionId = crypto.randomUUID();
    const createdDate = Date.now();

    const secret = {
      name,
      arn,
      secretString,
      versionId,
      createdDate,
    };

    await put("secrets", name, secret);

    return jsonResponse11({
      ARN: arn,
      Name: name,
      VersionId: versionId,
    });
  }

  // ListSecrets
  if (operation === "ListSecrets") {
    const secrets = await getAll("secrets");
    return jsonResponse11({
      SecretList: secrets.map((s) => ({
        ARN: s.arn,
        Name: s.name,
        CreatedDate: s.createdDate / 1000,
      })),
    });
  }

  // GetSecretValue
  if (operation === "GetSecretValue") {
    const secretId = body.SecretId;
    const secret = await get("secrets", secretId);

    if (!secret) {
      return jsonResponse11(
        {
          __type: "ResourceNotFoundException",
          message: "Secrets Manager can't find the specified secret.",
        },
        400
      );
    }

    return jsonResponse11({
      ARN: secret.arn,
      Name: secret.name,
      SecretString: secret.secretString,
      VersionId: secret.versionId,
      CreatedDate: secret.createdDate / 1000,
    });
  }

  // UpdateSecret
  if (operation === "UpdateSecret") {
    const secretId = body.SecretId;
    const secretString = body.SecretString;

    const secret = await get("secrets", secretId);
    if (!secret) {
      return jsonResponse11(
        {
          __type: "ResourceNotFoundException",
          message: "Secrets Manager can't find the specified secret.",
        },
        400
      );
    }

    const newVersionId = crypto.randomUUID();
    const updatedSecret = {
      ...secret,
      secretString,
      versionId: newVersionId,
    };

    await put("secrets", secretId, updatedSecret);

    return jsonResponse11({
      ARN: updatedSecret.arn,
      Name: updatedSecret.name,
      VersionId: newVersionId,
    });
  }

  // DeleteSecret
  if (operation === "DeleteSecret") {
    const secretId = body.SecretId;
    await del("secrets", secretId);

    return jsonResponse11({
      ARN: `arn:aws:secretsmanager:us-east-1:000000000000:secret:${secretId}`,
      Name: secretId,
      DeletionDate: Date.now() / 1000,
    });
  }

  return new Response("Unknown Operation", { status: 400 });
};
