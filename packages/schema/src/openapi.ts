/**
 * OpenAPI 3.1 description of the Kev Decision API.
 * Kept as a const object so the server can serve it at GET /openapi.json.
 */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Kev Decision API",
    version: "1.0.0",
    description:
      "Open-source System One decision engine. Send a state and typed questions; get calibrated answers with probabilities.",
    license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  },
  servers: [{ url: "http://localhost:3000", description: "Local default" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        operationId: "health",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    version: { type: "string" },
                    backend: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/systemone": {
      post: {
        summary: "Evaluate System One questions",
        operationId: "systemOne",
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SystemOneRequest" },
              example: {
                model: "kev-latest",
                state: "Customer: I was charged twice and I am furious.",
                questions: {
                  topic: {
                    type: "choice",
                    instructions: "What is the issue about?",
                    criteria: {
                      billing: "money problems",
                      bug: "broken product",
                      account: "login or access",
                    },
                  },
                  escalate: {
                    type: "noul",
                    instructions: "Escalate to a human now?",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Typed answers with probabilities",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemOneResponse" },
              },
            },
          },
          "400": {
            description: "Invalid request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorBody" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "429": { description: "Rate limited" },
          "502": { description: "Upstream model error" },
        },
      },
    },
    "/v1/systemone/batch": {
      post: {
        summary: "Evaluate many System One items concurrently",
        operationId: "systemOneBatch",
        security: [{ bearerAuth: [] }, {}],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BatchRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Per-item results",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchResponse" },
              },
            },
          },
          "400": { description: "Invalid request" },
          "429": { description: "Rate limited" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Optional. Set KEV_API_KEY on the server to require this.",
      },
    },
    schemas: {
      SystemOneRequest: {
        type: "object",
        required: ["state", "questions"],
        properties: {
          model: { type: "string", default: "kev-latest" },
          state: {
            oneOf: [
              { type: "string" },
              { type: "object" },
              { type: "array" },
            ],
          },
          questions: {
            type: "object",
            additionalProperties: {
              oneOf: [
                { $ref: "#/components/schemas/ChoiceQuestion" },
                { $ref: "#/components/schemas/ScoreQuestion" },
                { $ref: "#/components/schemas/NoulQuestion" },
              ],
            },
          },
          trace: { type: "boolean" },
        },
      },
      ChoiceQuestion: {
        type: "object",
        required: ["type", "instructions", "criteria"],
        properties: {
          type: { const: "choice" },
          instructions: { type: "string" },
          criteria: {
            type: "object",
            additionalProperties: { type: ["string", "null"] },
          },
        },
      },
      ScoreQuestion: {
        type: "object",
        required: ["type", "instructions", "criteria"],
        properties: {
          type: { const: "score" },
          instructions: { type: "string" },
          criteria: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 10,
          },
        },
      },
      NoulQuestion: {
        type: "object",
        required: ["type", "instructions"],
        properties: {
          type: { const: "noul" },
          instructions: { type: "string" },
          criteria: {
            type: "object",
            properties: {
              true: { type: "string" },
              false: { type: "string" },
            },
          },
        },
      },
      SystemOneResponse: {
        type: "object",
        required: ["model", "answers", "usage"],
        properties: {
          model: { type: "string" },
          answers: {
            type: "object",
            additionalProperties: {
              oneOf: [
                { $ref: "#/components/schemas/ChoiceAnswer" },
                { $ref: "#/components/schemas/ScoreAnswer" },
                { $ref: "#/components/schemas/NoulAnswer" },
              ],
            },
          },
          usage: { $ref: "#/components/schemas/Usage" },
          trace: { type: "object" },
        },
      },
      ChoiceAnswer: {
        type: "object",
        required: ["type", "choice", "confidence", "probabilities"],
        properties: {
          type: { const: "choice" },
          choice: { type: "string" },
          confidence: { type: "number" },
          probabilities: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        },
      },
      ScoreAnswer: {
        type: "object",
        required: ["type", "score", "confidence", "legend", "probabilities"],
        properties: {
          type: { const: "score" },
          score: { type: "number" },
          confidence: { type: "number" },
          legend: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          probabilities: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        },
      },
      NoulAnswer: {
        type: "object",
        required: ["type", "noul"],
        properties: {
          type: { const: "noul" },
          noul: { type: "number", minimum: 0, maximum: 1 },
        },
      },
      Usage: {
        type: "object",
        required: ["input_tokens", "output_tokens"],
        properties: {
          input_tokens: { type: "integer" },
          output_tokens: { type: "integer" },
          latency_ms: { type: "number" },
          cache_hit: { type: "boolean" },
        },
      },
      BatchRequest: {
        type: "object",
        required: ["items"],
        properties: {
          model: { type: "string" },
          concurrency: { type: "integer", minimum: 1, maximum: 32 },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              required: ["state", "questions"],
              properties: {
                id: { type: "string" },
                state: {},
                questions: { type: "object" },
                trace: { type: "boolean" },
              },
            },
          },
        },
      },
      BatchResponse: {
        type: "object",
        required: ["model", "results", "usage"],
        properties: {
          model: { type: "string" },
          results: {
            type: "array",
            items: {
              type: "object",
              required: ["index", "ok"],
              properties: {
                id: { type: "string" },
                index: { type: "integer" },
                ok: { type: "boolean" },
                result: { $ref: "#/components/schemas/SystemOneResponse" },
                error: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    message: { type: "string" },
                    code: { type: "string" },
                  },
                },
              },
            },
          },
          usage: { $ref: "#/components/schemas/Usage" },
        },
      },
      ErrorBody: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["type", "message"],
            properties: {
              type: { type: "string" },
              message: { type: "string" },
              code: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
} as const;
