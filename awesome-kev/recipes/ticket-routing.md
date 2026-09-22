# Ticket routing

Send the ticket once. Get **team**, **severity**, and **escalate** back together.

```json
{
  "state": "Charged twice, furious, want a refund NOW",
  "questions": {
    "topic": {
      "type": "choice",
      "instructions": "Which team?",
      "criteria": {
        "billing": "charges, refunds",
        "shipping": "delivery",
        "technical": "bugs"
      }
    },
    "severity": {
      "type": "score",
      "instructions": "Urgency?",
      "criteria": ["can wait", "this week", "today", "churn risk"]
    },
    "escalate": {
      "type": "noul",
      "instructions": "Escalate to a human now?"
    }
  }
}
```

```ts
if (answers.escalate.noul > 0.7) routeToHuman();
else assign(answers.topic.choice);
```

See also `examples/ticket-routing/`.
