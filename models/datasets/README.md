# Kev decision dataset format (no training in this repo)

Apache-2.0 schema for labeled System One examples. Use with `kev eval dataset`.
**Kev does not train models.** This format is for evaluation, calibration notes, and future community fine-tunes elsewhere.

## File shape

```json
{
  "name": "my-set",
  "description": "optional",
  "examples": [
    {
      "id": "ex-1",
      "state": "string or object (may include images:[])",
      "questions": {
        "topic": {
          "type": "choice",
          "instructions": "...",
          "criteria": { "a": "desc", "b": "desc" }
        }
      },
      "expected": {
        "choice": { "topic": "a" },
        "noul": { "gate": { "min": 0.7, "max": 1.0 } }
      }
    }
  ]
}
```

See also: `packages/eval/fixtures/routing.json` and JSON Schema in `schema.json`.
