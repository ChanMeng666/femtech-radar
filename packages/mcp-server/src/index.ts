#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleCollect, handleSources } from "./tools.js";
import { Section } from "./schema.js";

const server = new McpServer({ name: "femtech-radar", version: "0.1.0" });

server.tool(
  "radar_collect",
  { section: Section, since: z.string().optional(), limit: z.number().optional() },
  async (args) => {
    const out = await handleCollect(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(out) }] };
  },
);

server.tool("radar_sources", {}, async () => ({
  content: [{ type: "text" as const, text: JSON.stringify(handleSources()) }],
}));

await server.connect(new StdioServerTransport());
