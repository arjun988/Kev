# Ollama · Llama 3.2

**Backend:** `KEV_BACKEND=ollama`  
**Model:** `llama3.2` (or `llama3.2:3b` / `llama3.1:8b`)

```bash
ollama pull llama3.2
```

```env
KEV_BACKEND=ollama
KEV_OLLAMA_BASE_URL=http://127.0.0.1:11434
KEV_OLLAMA_MODEL=llama3.2
KEV_STRATEGY=auto
```

**Capabilities:** no OpenAI-style logprobs → constrained JSON / parallel micro-score.  
**Good for:** laptop demos, offline routing, moderation gates.
