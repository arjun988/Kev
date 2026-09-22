# Moderation gate

Use **noul** for the policy question and **choice** for the category.

```ts
const res = await client.systemOne({
  state: { channel: "chat", text: message },
  questions: {
    violation: Noul("Does this violate spam or scam policy?"),
    category: Choice("Best category?", {
      spam: "promo spam",
      scam: "fraud",
      hate: "hate",
      clean: "fine",
    }),
    allow: Noul("Safe to deliver without review?"),
  },
});

const v = res.answers.violation;
const a = res.answers.allow;
if (v?.type === "noul" && v.noul > 0.85) return "block";
if (a?.type === "noul" && a.noul < 0.5) return "hold";
return "allow";
```
