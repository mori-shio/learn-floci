import type { HandleFn } from "./types";

export const handle: HandleFn = async (_request, _url) => {
  return new Response(JSON.stringify({ stub: "secrets-manager" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
};
