# @cliqo/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [cliqo.link](https://cliqo.link) — a pay-per-use (credits) link shortener.

It lets any MCP client (Claude Desktop, Claude Code, etc.) create short links, list/get/revoke them, and check your remaining credit balance.

The server is a thin wrapper over the public cliqo **v1 REST API** — see the machine-readable reference at <https://cliqo.link/llms.txt>.

## Prerequisites

- Node.js >= 18
- A cliqo API key. Create one in the dashboard under **API keys** — it is shown only once. The key's [scopes](https://cliqo.link/llms.txt) determine which tools work:
  - `links:read` — `list_links`, `get_link`
  - `links:write` — `shorten_url`
  - `links:delete` — `delete_link`
  - `billing:read` — `get_credits`

## Tools

| Tool | Description | Scope |
| --- | --- | --- |
| `shorten_url` | Create a short link for a URL. Consumes one credit. | `links:write` |
| `list_links` | List your links (newest first). Optionally include revoked links or filter by tag. | `links:read` |
| `get_link` | Fetch a single link by its numeric id. | `links:read` |
| `delete_link` | Revoke (delete) a link by id. Cannot be undone. | `links:delete` |
| `get_credits` | Check how many link credits remain. | `billing:read` |

## Usage

Set the `CLIQO_API_KEY` environment variable to your API key. The server speaks MCP over stdio.

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cliqo": {
      "command": "npx",
      "args": ["-y", "@cliqo/mcp"],
      "env": {
        "CLIQO_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add cliqo --env CLIQO_API_KEY=your-api-key -- npx -y @cliqo/mcp
```

### Run directly

```bash
CLIQO_API_KEY=your-api-key npx -y @cliqo/mcp
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `CLIQO_API_KEY` | yes | Your cliqo API key, sent as a Bearer token. |
| `CLIQO_BASE_URL` | no | Override the API base URL (defaults to `https://api.cliqo.link`). Useful for staging/self-hosted instances. |

## Development

```bash
npm install
npm run build      # compile TypeScript to dist/
npm run watch      # recompile on change
npm start          # run the built server
```

The source lives in `src/`:

- `client.ts` — thin HTTP client for the cliqo REST API.
- `index.ts` — MCP server wiring and tool definitions.

## License

MIT