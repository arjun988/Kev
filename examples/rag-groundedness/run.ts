/**
 * RAG groundedness judge — is the answer supported by the retrieved context?
 *
 *   npx tsx examples/rag-groundedness/run.ts
 */
import { KevClient, Noul, Score } from "@kev-ai/sdk";

async function main() {
  const client = new KevClient();

  const context = `
Product: Acme Plan Pro costs $49/month.
Refunds are available within 14 days of purchase.
Support email is help@acme.example.
`.trim();

  const answer =
    process.argv[2] ??
    "Acme Plan Pro is $49 per month and you can get a refund within 14 days.";

  const res = await client.systemOne({
    state: {
      retrieved_context: context,
      model_answer: answer,
    },
    questions: {
      grounded: Noul(
        "Is every factual claim in the model_answer supported by retrieved_context?",
        {
          true: "fully supported by the context",
          false: "contains claims not present in the context",
        },
      ),
      support: Score("How well does the context support the answer?", [
        "contradicted or unrelated",
        "partially supported",
        "mostly supported",
        "fully supported with no extras",
      ]),
    },
    trace: true,
  });

  console.log(JSON.stringify(res, null, 2));

  const grounded = res.answers.grounded;
  if (grounded?.type === "noul") {
    console.log(
      `\nGrounded → ${grounded.noul >= 0.7 ? "YES" : "NO"} (p=${grounded.noul.toFixed(2)})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
