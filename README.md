# Moodland（心境漫游）

English | 简体中文见文末

Browser-based experience that combines the webcam with a local or self-hosted LLM to suggest breathing rhythm and short on-screen coaching. Vision runs in the browser via ONNX Runtime Web; chat defaults to an [Ollama](https://ollama.com/)-compatible API. In development, Vite proxies `/api/ollama` to `127.0.0.1:11434` to avoid CORS issues.

## Features

- Lightweight object detection on video frames to build a compact visual summary.
- Sends mood plus summary to the assistant and parses structured rhythm parameters (inhale/hold/exhale ratios, etc.) to drive the UI.
- Works with Ollama on the same machine by default; optional OpenAI-compatible endpoints via environment variables.

## Requirements

- **Node.js** 20+ (current LTS recommended)
- **Ollama** running locally with a model that matches `VITE_CHAT_MODEL` (default: `qwen2.5:0.5b-instruct`)

## Development

```bash
npm install
npm run download:yolo   # downloads vision weights to public/models/app.bin (several MB)
npm run dev
```

Open the URL printed in the terminal. Ensure Ollama listens on port `11434`, or point `VITE_ASSISTANT_URL` at your backend.

## Production build

```bash
npm run build
npm run preview
```

`npm run build` runs TypeScript, copies ONNX Runtime WASM into `public/ort/`, and emits static assets to `dist/`. Serve `dist/` from any static host. In production you must handle CORS or reverse-proxy the assistant if the browser cannot call Ollama directly.

## Environment variables

Create `.env`, `.env.local`, or `.env.production` in the project root (Vite convention).

| Variable | Description |
|----------|-------------|
| `VITE_ASSISTANT_BACKEND` | `ollama` (default) or `openai` (OpenAI-style `/v1/chat/completions`) |
| `VITE_ASSISTANT_URL` | Assistant base URL when not using the dev proxy |
| `VITE_CHAT_MODEL` | Model name exposed by the backend |
| `VITE_VISION_BLOB` | URL of the vision ONNX bundle, default `/models/app.bin` |

See `.env.example` when it exists in the tree.

## Repository layout (partial)

| Path | Role |
|------|------|
| `src/` | React application |
| `src/yolo/` | In-browser inference session |
| `src/llm/` | Assistant HTTP client and parsing |
| `src/rhythm/` | Rhythm schema, defaults, validation |
| `public/models/` | Output of `download:yolo` (large blobs are usually gitignored) |
| `scripts/` | Asset preparation |

## License

Apache License 2.0 — see [LICENSE](LICENSE).

---

**简体中文**：心境漫游在浏览器中结合摄像头与本地（或自建）大模型，生成呼吸引导与节奏参数；视觉在页内 ONNX 推理，对话默认走 Ollama。使用方式见上文英文说明。
