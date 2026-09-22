# Cascade taxonomy

When a choice has more than 255 options, use `cascadeChoice` from `@kev-ai/core`.

```ts
import { DecisionEngine, cascadeChoice } from "@kev-ai/core";

const result = await cascadeChoice(engine, state, {
  instructions: "Which SKU?",
  criteria: hugeMap,
}, { chunkSize: 52 });

console.log(result.choice, result.path);
```

Coarse group → fine pick. Confidence is the min along the path.
