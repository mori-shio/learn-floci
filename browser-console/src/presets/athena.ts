import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import type { Preset } from "../types";

const client = new AthenaClient({
  region: "us-east-1",
  endpoint: `${location.origin}/mock-api`,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

export const athenaPresets: Preset[] = [
  {
    id: "athena-start-query-execution",
    service: "Athena",
    label: "Start Query Execution",
    fields: [
      { name: "query", label: "Query", type: "textarea", default: "SELECT 1" },
      { name: "output", label: "Output location", default: "s3://athena-results/" },
      { name: "database", label: "Database", default: "default" },
    ],
    code: (p) =>
`import { AthenaClient, StartQueryExecutionCommand } from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: "us-east-1" });
const result = await client.send(
  new StartQueryExecutionCommand({
    QueryString: "${p.query}",
    ResultConfiguration: {
      OutputLocation: "${p.output}",
    },
    QueryExecutionContext: {
      Database: "${p.database}",
    },
  })
);
console.log(result.QueryExecutionId);`,
    run: async (p) =>
      client.send(
        new StartQueryExecutionCommand({
          QueryString: p.query,
          ResultConfiguration: {
            OutputLocation: p.output,
          },
          QueryExecutionContext: {
            Database: p.database,
          },
        })
      ),
  },
  {
    id: "athena-get-query-execution",
    service: "Athena",
    label: "Get Query Execution",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
    code: (p) =>
`import { AthenaClient, GetQueryExecutionCommand } from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: "us-east-1" });
const result = await client.send(
  new GetQueryExecutionCommand({ QueryExecutionId: "${p.id}" })
);
console.log(result.QueryExecution);`,
    run: async (p) => client.send(new GetQueryExecutionCommand({ QueryExecutionId: p.id })),
  },
  {
    id: "athena-get-query-results",
    service: "Athena",
    label: "Get Query Results",
    fields: [{ name: "id", label: "Query execution ID", default: "" }],
    code: (p) =>
`import { AthenaClient, GetQueryResultsCommand } from "@aws-sdk/client-athena";

const client = new AthenaClient({ region: "us-east-1" });
const result = await client.send(
  new GetQueryResultsCommand({ QueryExecutionId: "${p.id}" })
);
console.log(result.ResultSet);`,
    run: async (p) => client.send(new GetQueryResultsCommand({ QueryExecutionId: p.id })),
  },
];
