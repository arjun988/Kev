/**
 * Cascade example — >255 options split into hierarchical choices.
 *
 *   pnpm exec tsx examples/cascade/run.ts
 */
import { DecisionEngine, cascadeChoice } from "@kev-ai/core";
import { MockBackend } from "@kev-ai/backends";

async function main() {
  const criteria: Record<string, string | null> = {};
  for (let i = 0; i < 300; i++) {
    criteria[`sku_${i}`] = i === 142 ? "blue running shoes refund" : `product ${i}`;
  }

  // Mock backend'complete' is unused — cascade uses DecisionEngine strategies.
  // For a deterministic demo, call cascade with engine; mock complete returns "A".
  // Prefer server + Ollama for real cascades. Here we show the API shape.
  const engine = new DecisionEngine(new MockBackend(), {
    modelName: "demo",
    strategy: "constrained",
  });

  try {
    const result = await cascadeChoice(
      engine,
      "Customer wants a refund on blue running shoes",
      {
        instructions: "Which SKU matches the customer request?",
        criteria,
      },
      { chunkSize: 52 },
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(
      "Cascade API ready. Constrained mock may not pick the semantic SKU; use Ollama/OpenAI for real runs.",
    );
    console.error(String(err));
  }
}

main();
