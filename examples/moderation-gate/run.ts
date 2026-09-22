/**
 * Moderation gate — auto-allow / hold / block using noul + choice.
 *
 *   npx tsx examples/moderation-gate/run.ts
 */
import { Choice, KevClient, Noul } from "@kev-ai/sdk";

async function main() {
  const client = new KevClient();
  const message = process.argv[2] ?? "Buy cheap crypto now!!! guaranteed 1000% returns click here";

  const res = await client.systemOne({
    state: { channel: "chat", text: message },
    questions: {
      violation: Noul("Does this message violate spam or scam policy?"),
      category: Choice("If it is bad, what category fits best?", {
        spam: "unsolicited promotional spam",
        scam: "fraud or phishing",
        hate: "hate or harassment",
        clean: "none — message is fine",
      }),
      allow: Noul("Is it safe to deliver this message to other users without review?"),
    },
  });

  console.log(JSON.stringify(res, null, 2));

  const violation = res.answers.violation;
  const allow = res.answers.allow;
  if (violation?.type === "noul" && allow?.type === "noul") {
    if (violation.noul > 0.85) console.log("\nAction → BLOCK");
    else if (allow.noul < 0.5) console.log("\nAction → HOLD for review");
    else console.log("\nAction → ALLOW");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
