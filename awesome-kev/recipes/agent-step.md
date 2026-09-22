# Agent next step

Describe the screen in text; optionally attach `images[]`.

```ts
await client.systemOne({
  state: {
    text: "Checkout page with Pay now visible",
    images: [{ url: screenshotUrl, media_type: "image/png" }],
  },
  questions: {
    next: Choice("What should the agent click?", {
      pay: "Pay now",
      cancel: "Cancel",
      back: "Back",
    }),
    done: Noul("Is the task already finished?"),
  },
});
```

Always confirm `done` against your own success signal (URL change, toast, etc.).
