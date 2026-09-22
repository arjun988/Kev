# Batch triage

```bash
curl -s http://127.0.0.1:3000/v1/systemone/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "concurrency": 8,
    "items": [
      { "id": "1", "state": "…", "questions": { "topic": { "type": "choice", "instructions": "…", "criteria": { } } } },
      { "id": "2", "state": "…", "questions": { "topic": { "type": "choice", "instructions": "…", "criteria": { } } } }
    ]
  }'
```

Or:

```ts
await client.batch({
  concurrency: 8,
  items: tickets.map((t) => ({
    id: t.id,
    state: t.body,
    questions: { /* … */ },
  })),
});
```
