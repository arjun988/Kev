#!/usr/bin/env node
import { Choice, KevClient, Noul, Score } from "@kev-ai/sdk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const client = new KevClient({
  baseUrl: process.env.KEV_BASE_URL ?? "http://127.0.0.1:3000",
  apiKey: process.env.KEV_API_KEY,
});

const EvaluateSchema = z.object({
  state: z.union([z.string(), z.record(z.unknown())]),
  choice_instructions: z.string().optional(),
  choice_criteria: z.record(z.string().nullable()).optional(),
  score_instructions: z.string().optional(),
  score_criteria: z.array(z.string()).optional(),
  noul_instructions: z.string().optional(),
  trace: z.boolean().optional(),
});

const server = new Server(
  { name: "kev", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "kev_systemone",
      description:
        "Evaluate System One questions (choice / score / noul) against a state via the Kev Decision API.",
      inputSchema: {
        type: "object",
        required: ["state"],
        properties: {
          state: {
            description: "Context for the decision (string or object)",
          },
          choice_instructions: { type: "string" },
          choice_criteria: {
            type: "object",
            additionalProperties: { type: ["string", "null"] },
          },
          score_instructions: { type: "string" },
          score_criteria: {
            type: "array",
            items: { type: "string" },
          },
          noul_instructions: { type: "string" },
          trace: { type: "boolean" },
        },
      },
    },
    {
      name: "kev_health",
      description: "Check that the Kev Decision API is reachable.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  if (name === "kev_health") {
    const health = await client.health();
    return {
      content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
    };
  }

  if (name !== "kev_systemone") {
    throw new Error(`Unknown tool: ${name}`);
  }

  const args = EvaluateSchema.parse(req.params.arguments ?? {});
  const questions: Record<string, ReturnType<typeof Choice> | ReturnType<typeof Score> | ReturnType<typeof Noul>> = {};

  if (args.choice_instructions && args.choice_criteria) {
    questions.topic = Choice(args.choice_instructions, args.choice_criteria);
  }
  if (args.score_instructions && args.score_criteria) {
    questions.score = Score(args.score_instructions, args.score_criteria);
  }
  if (args.noul_instructions) {
    questions.gate = Noul(args.noul_instructions);
  }
  if (Object.keys(questions).length === 0) {
    questions.ok = Noul("Is the state coherent and actionable?");
  }

  const result = await client.systemOne({
    state: args.state,
    questions,
    trace: args.trace,
  });

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
