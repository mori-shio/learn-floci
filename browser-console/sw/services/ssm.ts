import type { HandleFn } from "./types";
import { get, getAll, put, del } from "../store";
import { jsonResponse11 } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("X-Amz-Target") || "";
  const operation = target.split(".")[1];
  const body = await request.json();

  // PutParameter
  if (operation === "PutParameter") {
    const name = body.Name;
    const type = body.Type || "String";
    const value = body.Value;

    const existing = await get("ssm-parameters", name);
    const version = existing ? existing.version + 1 : 1;

    const parameter = {
      name,
      type,
      value,
      version,
      lastModifiedDate: Date.now(),
    };

    await put("ssm-parameters", name, parameter);

    return jsonResponse11({
      Version: version,
      Tier: "Standard",
    });
  }

  // GetParameter
  if (operation === "GetParameter") {
    const name = body.Name;
    const parameter = await get("ssm-parameters", name);

    if (!parameter) {
      return jsonResponse11(
        {
          __type: "ParameterNotFound",
          message: `Parameter ${name} not found.`,
        },
        400
      );
    }

    return jsonResponse11({
      Parameter: {
        Name: parameter.name,
        Type: parameter.type,
        Value: parameter.value,
        Version: parameter.version,
        LastModifiedDate: parameter.lastModifiedDate / 1000,
        ARN: `arn:aws:ssm:us-east-1:000000000000:parameter${parameter.name}`,
      },
    });
  }

  // GetParametersByPath
  if (operation === "GetParametersByPath") {
    const path = body.Path;
    const allParams = await getAll("ssm-parameters");
    const filtered = allParams.filter((p) => p.name.startsWith(path));

    return jsonResponse11({
      Parameters: filtered.map((p) => ({
        Name: p.name,
        Type: p.type,
        Value: p.value,
        Version: p.version,
        LastModifiedDate: p.lastModifiedDate / 1000,
        ARN: `arn:aws:ssm:us-east-1:000000000000:parameter${p.name}`,
      })),
    });
  }

  // DeleteParameter
  if (operation === "DeleteParameter") {
    const name = body.Name;
    await del("ssm-parameters", name);
    return jsonResponse11({});
  }

  return new Response("Unknown Operation", { status: 400 });
};
