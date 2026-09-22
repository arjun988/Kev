/**
 * Multimodal / screenshot-style state (images[]).
 * Text backends summarize images in the prompt; vision providers can extend later.
 *
 *   pnpm exec tsx examples/agent-step/run.ts
 */
import { Choice, KevClient, Noul } from "@kev-ai/sdk";

async function main() {
  const client = new KevClient();

  const res = await client.systemOne({
    state: {
      text: "Desktop screenshot: a browser showing a checkout button labeled Pay now.",
      images: [
        {
          url: "https://example.com/screenshot.png",
          media_type: "image/png",
          detail: "low",
        },
      ],
      candidates: ["Pay now", "Cancel", "Back"],
    },
    questions: {
      next: Choice("Which UI element should the agent click next?", {
        pay: "Pay now / submit payment",
        cancel: "Cancel the flow",
        back: "Go back",
      }),
      done: Noul("Is the task already finished?"),
    },
    trace: true,
  });

  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
