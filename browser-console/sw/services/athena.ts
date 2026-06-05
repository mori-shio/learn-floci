import type { HandleFn } from "./types";
import { get, getAll, put } from "../store";
import { jsonResponse11 } from "../response";

export const handle: HandleFn = async (request, _url) => {
  const target = request.headers.get("X-Amz-Target") || "";
  const operation = target.split(".")[1];
  const body = await request.json();

  // StartQueryExecution
  if (operation === "StartQueryExecution") {
    const queryString = body.QueryString;
    const queryExecutionContext = body.QueryExecutionContext || {};
    const resultConfiguration = body.ResultConfiguration || {};

    const queryExecutionId = crypto.randomUUID();

    const query = {
      queryExecutionId,
      query: queryString,
      database: queryExecutionContext.Database || "default",
      outputLocation: resultConfiguration.OutputLocation || "s3://athena-results/",
      state: "SUCCEEDED",
      submissionDateTime: Date.now(),
    };

    await put("athena-queries", queryExecutionId, query);

    return jsonResponse11({
      QueryExecutionId: queryExecutionId,
    });
  }

  // GetQueryExecution
  if (operation === "GetQueryExecution") {
    const queryExecutionId = body.QueryExecutionId;
    const query = await get("athena-queries", queryExecutionId);

    if (!query) {
      return jsonResponse11(
        {
          __type: "InvalidRequestException",
          message: "Query execution not found",
        },
        400
      );
    }

    return jsonResponse11({
      QueryExecution: {
        QueryExecutionId: query.queryExecutionId,
        Query: query.query,
        Status: {
          State: query.state,
          SubmissionDateTime: query.submissionDateTime / 1000,
        },
        QueryExecutionContext: {
          Database: query.database,
        },
        ResultConfiguration: {
          OutputLocation: query.outputLocation,
        },
      },
    });
  }

  // GetQueryResults
  if (operation === "GetQueryResults") {
    const queryExecutionId = body.QueryExecutionId;
    const query = await get("athena-queries", queryExecutionId);

    if (!query) {
      return jsonResponse11(
        {
          __type: "InvalidRequestException",
          message: "Query execution not found",
        },
        400
      );
    }

    // Return empty result set (mock-only)
    return jsonResponse11({
      ResultSet: {
        Rows: [],
        ResultSetMetadata: {
          ColumnInfo: [],
        },
      },
    });
  }

  // ListQueryExecutions
  if (operation === "ListQueryExecutions") {
    const queries = await getAll("athena-queries");
    return jsonResponse11({
      QueryExecutionIds: queries.map((q) => q.queryExecutionId),
    });
  }

  return new Response("Unknown Operation", { status: 400 });
};
