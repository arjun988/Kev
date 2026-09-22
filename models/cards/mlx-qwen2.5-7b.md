# MLX · Qwen2.5 7B (Apple Silicon)

**Runtime:** [MLX](https://github.com/ml-explore/mlx) / MLX-LM OpenAI-compatible server

Expose an OpenAI-compatible endpoint, then:

```env
KEV_BACKEND=openai
KEV_OPENAI_BASE_URL=http://127.0.0.1:8080/v1
KEV_OPENAI_API_KEY=mlx
KEV_OPENAI_MODEL=qwen2.5-7b-instruct
KEV_STRATEGY=auto
```

**Notes:** enable logprobs on the server if available for readout. Otherwise constrained mode still works.
