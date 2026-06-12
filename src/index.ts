#!/usr/bin/env node
/**
 * cliqo-mcp — Model Context Protocol server for cliqo.link.
 *
 * Exposes the cliqo link shortener as MCP tools so an MCP client (e.g. Claude
 * Desktop) can create, list, fetch and revoke short links and check the
 * remaining credit balance.
 *
 * Auth: set the CLIQO_API_KEY environment variable to your API key.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CliqoClient, CliqoApiError } from "./client.js";

const apiKey = process.env.CLIQO_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "cliqo-mcp: CLIQO_API_KEY environment variable is required.\n" +
      "Get an API key at https://cliqo.link and set CLIQO_API_KEY before starting the server.\n",
  );
  process.exit(1);
}

// CLIQO_BASE_URL is undocumented/optional — handy for self-hosted or staging instances.
const client = new CliqoClient(apiKey, process.env.CLIQO_BASE_URL);

const server = new McpServer({
  name: "cliqo-mcp",
  version: "0.1.0",
});

/** Wrap a tool body so API/runtime errors come back as MCP error results instead of crashing. */
async function run(
  fn: () => Promise<unknown>,
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  try {
    const result = await fn();
    const text =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message =
      err instanceof CliqoApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}

server.registerTool(
  "shorten_url",
  {
    title: "Shorten URL",
    description:
      "Create a short link for a URL. Consumes one credit. Returns the created link including its short URL and id.",
    inputSchema: {
      url: z.string().url().describe("The destination URL to shorten."),
      name: z.string().optional().describe("Optional human-friendly label for the link."),
      utmSource: z.string().optional().describe("Optional utm_source value appended to the destination URL."),
      utmCampaign: z.string().optional().describe("Optional utm_campaign value appended to the destination URL."),
    },
  },
  ({ url, name, utmSource, utmCampaign }) =>
    run(() => client.createLink({ url, name, utmSource, utmCampaign })),
);

server.registerTool(
  "list_links",
  {
    title: "List links",
    description:
      "List your short links (newest first). By default only active links are returned.",
    inputSchema: {
      includeRevoked: z
        .boolean()
        .optional()
        .describe("Include revoked/deleted links in the results."),
      tag: z.string().optional().describe("Filter to links with this exact tag name."),
    },
  },
  ({ includeRevoked, tag }) => run(() => client.listLinks({ includeRevoked, tag })),
);

server.registerTool(
  "get_link",
  {
    title: "Get link",
    description: "Fetch a single short link by its numeric id.",
    inputSchema: {
      id: z.number().int().describe("The numeric id of the link."),
    },
  },
  ({ id }) => run(() => client.getLink(id)),
);

server.registerTool(
  "delete_link",
  {
    title: "Revoke link",
    description:
      "Revoke (delete) a short link by its numeric id. The short URL stops resolving. This cannot be undone.",
    inputSchema: {
      id: z.number().int().describe("The numeric id of the link to revoke."),
    },
  },
  ({ id }) =>
    run(async () => {
      await client.deleteLink(id);
      return `Link ${id} revoked.`;
    }),
);

server.registerTool(
  "get_credits",
  {
    title: "Get credit balance",
    description: "Check how many link credits remain on your account.",
    inputSchema: {},
  },
  () =>
    run(async () => {
      const { links } = await client.getCredits();
      return `You have ${links} link credit${links === 1 ? "" : "s"} remaining.`;
    }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr — stdout is reserved for the MCP protocol stream.
  process.stderr.write("cliqo-mcp running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`cliqo-mcp fatal error: ${err}\n`);
  process.exit(1);
});
