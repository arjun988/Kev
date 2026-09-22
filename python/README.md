# Kev Python SDK

Install from the repo:

```bash
cd python
pip install -e .
```

```python
from kev import KevClient, Choice, Noul, Score

client = KevClient(base_url="http://127.0.0.1:3000")
res = client.system_one(
    state="Customer charged twice and is furious.",
    questions={
        "topic": Choice(
            "Which team?",
            {"billing": "charges", "tech": "bugs"},
        ),
        "escalate": Noul("Escalate to a human?"),
    },
)
print(res.answers["topic"].choice)
print(res.answers["escalate"].noul)
```
