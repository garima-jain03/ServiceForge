# ServiceForge parts-stock MCP tool

A minimal MCP server (stdio transport, `@modelcontextprotocol/sdk`) exposing exactly one tool —
`reserve_part_for_job` — designed per [tool-design.md](tool-design.md) and documented in
[tools/parts-stock-tool.md](tools/parts-stock-tool.md).

## Run

```bash
# 1. ServiceForge backend must be running (from /backend)
mvn spring-boot:run

# 2. Install and smoke-test the MCP server (from /mcp)
npm install
node test/test-error-cases.js   # calls the tool function directly: 201 + 400/404/404/409
node test/test-stdio-smoke.js   # real MCP client <-> server over stdio
```

## Wiring it into a host

```json
{
  "mcpServers": {
    "serviceforge-parts-stock": {
      "command": "node",
      "args": ["mcp/src/server.js"],
      "env": {
        "SERVICEFORGE_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

## Scope note

This directory implements only the parts-stock tool kata (design + one working tool), not the
full ServiceForge Dispatcher MCP server (availability tool, resources, prompts) described in the
broader home-task brief. The backend's parts-reservation endpoint
(`POST /api/parts/{sku}/reservations`) did not exist before this change — it was added
minimally and additively (`Part`, `PartReservation`, `PartController`) so the tool calls a real
system instead of a stub; see `tool-design.md` §4.
