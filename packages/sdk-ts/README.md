# @kev-ai/sdk

TypeScript client for **NotJev : Kev** System One decisions.

```bash
npm install @kev-ai/sdk
```

```ts
import { Choice, KevClient, Noul } from "@kev-ai/sdk";

const client = new KevClient({ baseUrl: "http://127.0.0.1:3000" });
const res = await client.systemOne({
  state: "Charged twice.",
  questions: {
    team: Choice("Route?", { billing: "charges", technical: "bugs" }),
    escalate: Noul("Human now?"),
  },
});
```

Adapters (no extra package):

```ts
import { createLangChainKevTool } from "@kev-ai/sdk/langchain";
import { createLlamaIndexKevTool } from "@kev-ai/sdk/llamaindex";
```

Requires a running `@kev-ai/server` (or self-hosted clone).
