/**
 * Ticket routing example — run against a local Kev server.
 *
 *   pnpm --filter @kev-ai/sdk build
 *   npx tsx examples/ticket-routing/run.ts
 */
import { Choice, KevClient, Noul, Score } from "@kev-ai/sdk";

async function main() {
  const client = new KevClient();

  const res = await client.systemOne({
    state:
      "Hi, I've been charged twice for order #18422 and nobody has replied in 3 days. I want a refund NOW or I will cancel.",
    questions: {
      topic: Choice("Which team should handle this support ticket?", {
        billing: "Charges, refunds, invoices, payments",
        shipping: "Delivery delays, lost packages, tracking",
        technical: "Bugs, outages, product not working",
      }),
      severity: Score("How urgent is this ticket?", [
        "can wait several days",
        "handle this week",
        "handle today",
        "customer about to churn — act now",
      ]),
      escalate: Noul("Should this be escalated to a human agent immediately?"),
    },
    trace: true,
  });

  console.log(JSON.stringify(res, null, 2));

  const topic = res.answers.topic;
  const escalate = res.answers.escalate;
  if (topic?.type === "choice") {
    console.log(`\nRoute → ${topic.choice} (confidence ${topic.confidence.toFixed(2)})`);
  }
  if (escalate?.type === "noul") {
    console.log(`Escalate → ${escalate.noul > 0.7 ? "YES" : "no"} (p=${escalate.noul.toFixed(2)})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
