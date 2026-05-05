import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { afterEach, describe, it } from "node:test";

import { OllamaLlmProvider } from "./ollama-llm.provider";

const activeServers = new Set<ReturnType<typeof createServer>>();

const createProvider = (
  baseUrl: string,
  {
    model = "qwen3.5:9b",
    structuredOutputMode = "auto",
    timeoutMs = 300000,
  }: {
    model?: string;
    structuredOutputMode?: "auto" | "reasoning" | "schema";
    timeoutMs?: number;
  } = {},
) =>
  new OllamaLlmProvider({
    llm: {
      ollamaBaseUrl: baseUrl,
      ollamaModel: model,
      ollamaStructuredOutputMode: structuredOutputMode,
      ollamaTimeoutMs: timeoutMs,
    },
  } as never);

const withServer = async (
  handler: (
    request: IncomingMessage,
    response: ServerResponse<IncomingMessage>,
  ) => void,
): Promise<string> => {
  const server = createServer(handler);
  activeServers.add(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
  await Promise.all(
    [...activeServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            activeServers.delete(server);
            resolve();
          });
        }),
    ),
  );
});

void describe("OllamaLlmProvider", () => {
  void it("posts a streaming schema-formatted chat request for non-reasoning models", async () => {
    let requestBody = "";

    const baseUrl = await withServer((request, response) => {
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        requestBody += chunk;
      });
      request.on("end", () => {
        response.writeHead(200, {
          "Content-Type": "application/json",
        });
        response.end(
          JSON.stringify({
            message: {
              content: JSON.stringify({
                summary: "Local summary.",
                tasks: [],
              }),
            },
          }),
        );
      });
    });

    const provider = createProvider(baseUrl, {
      model: "llama3.2:3b",
    });
    const output = await provider.generateJson({
      schemaName: "meeting_artifacts",
      jsonSchema: { type: "object" },
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.deepEqual(output, {
      summary: "Local summary.",
      tasks: [],
    });

    const body = JSON.parse(requestBody) as {
      model: string;
      stream: boolean;
      format: unknown;
      options: {
        temperature: number;
      };
      messages: Array<{
        role: string;
        content: string;
      }>;
    };

    assert.equal(body.model, "llama3.2:3b");
    assert.equal(body.stream, true);
    assert.deepEqual(body.format, { type: "object" });
    assert.equal(body.options.temperature, 0.1);
    assert.deepEqual(body.messages, [
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ]);
  });

  void it("omits API format and parses fenced JSON for reasoning models", async () => {
    let requestBody = "";

    const baseUrl = await withServer((request, response) => {
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        requestBody += chunk;
      });
      request.on("end", () => {
        response.writeHead(200, {
          "Content-Type": "application/x-ndjson",
        });
        response.write(
          `${JSON.stringify({
            message: {
              thinking: "reviewing transcript",
            },
          })}\n`,
        );
        response.write(
          `${JSON.stringify({
            message: {
              content:
                "<think>reviewing transcript</think>\n```json\n{\"summary\":\"Local summary.\",\"tasks\":[]}\n```",
            },
          })}\n`,
        );
        response.end(`${JSON.stringify({ done: true })}\n`);
      });
    });

    const provider = createProvider(baseUrl);
    const output = await provider.generateJson({
      schemaName: "meeting_artifacts",
      jsonSchema: { type: "object", required: ["summary", "tasks"] },
      systemPrompt: "system",
      userPrompt: "user",
    });

    assert.deepEqual(output, {
      summary: "Local summary.",
      tasks: [],
    });

    const body = JSON.parse(requestBody) as {
      stream: boolean;
      format?: unknown;
      messages: Array<{
        role: string;
        content: string;
      }>;
    };

    assert.equal(body.stream, true);
    assert.equal("format" in body, false);
    assert.match(body.messages[0]?.content ?? "", /Ollama reasoning-mode response contract/i);
    assert.match(
      body.messages[0]?.content ?? "",
      /"required": \[\s*"summary",\s*"tasks"\s*\]/i,
    );
  });

  void it("rejects invalid JSON content", async () => {
    const baseUrl = await withServer((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "application/json",
      });
      response.end(
        JSON.stringify({
          message: {
            content: "not-json",
          },
        }),
      );
    });

    const provider = createProvider(baseUrl, {
      model: "llama3.2:3b",
    });

    await assert.rejects(
      () =>
        provider.generateJson({
          schemaName: "meeting_artifacts",
          jsonSchema: { type: "object" },
          systemPrompt: "system",
          userPrompt: "user",
        }),
      /invalid JSON/i,
    );
  });

  void it("reports the configured timeout when Ollama takes too long", async () => {
    const baseUrl = await withServer(() => {
      // Keep the socket open so the provider timeout controls the failure.
    });

    const provider = createProvider(baseUrl, {
      timeoutMs: 25,
    });

    await assert.rejects(
      () =>
        provider.generateJson({
          schemaName: "meeting_artifacts",
          jsonSchema: { type: "object" },
          systemPrompt: "system",
          userPrompt: "user",
        }),
      /Configured timeout: 25ms/i,
    );
  });
});
