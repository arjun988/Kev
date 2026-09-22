# RAG groundedness

Put retrieved chunks and the model answer in `state`. Ask a **noul**.

```ts
await client.systemOne({
  state: { retrieved_context: ctx, model_answer: answer },
  questions: {
    grounded: Noul(
      "Is every factual claim in model_answer supported by retrieved_context?",
      {
        true: "fully supported",
        false: "unsupported or invented claims",
      },
    ),
  },
});
```

Threshold: auto-accept when `noul > 0.85`, regenerate or cite when `noul < 0.5`.
