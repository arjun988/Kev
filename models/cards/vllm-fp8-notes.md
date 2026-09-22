# vLLM · FP8 / OpenAI-compatible

**Runtime:** vLLM with `--max-logprobs` enabled

```bash
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --max-logprobs 20 \
  --port 8000
```

```env
KEV_BACKEND=openai
KEV_OPENAI_BASE_URL=http://127.0.0.1:8000/v1
KEV_OPENAI_API_KEY=dummy
KEV_OPENAI_MODEL=Qwen/Qwen2.5-7B-Instruct
KEV_STRATEGY=auto
```

**Why:** logprobs unlock letter-token **readout** (fastest, most System-One-like).  
**FP8:** use when your GPU / vLLM build supports it; measure accuracy on your fixtures before switching profiles.
