# Recommended models for Kev

Kev does **not** ship or train weights. Point `KEV_BACKEND` at a local or hosted model.

## Quick picks

| Profile | Runtime | Size (approx) | Notes |
| --- | --- | --- | --- |
| [ollama-llama3.2](./ollama-llama3.2.md) | Ollama | 2–3 GB | Default local path |
| [gguf-qwen2.5-7b](./gguf-qwen2.5-7b.md) | llama.cpp / Ollama | ~4–5 GB Q4 | Good readout / JSON discipline |
| [mlx-qwen2.5-7b](./mlx-qwen2.5-7b.md) | Apple MLX | ~4–8 GB | Mac Silicon |
| [vllm-fp8-notes](./vllm-fp8-notes.md) | vLLM | GPU | OpenAI-compatible + logprobs |

## Strategy tips

- Prefer providers that return `top_logprobs` → Kev uses **readout**.
- Ollama → auto **constrained** / **parallel**.
- Keep calibration at `default` unless you measure on your labels.
