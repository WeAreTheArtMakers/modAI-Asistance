# modAI Ultralight

`modAI` is a local-first, Apple Silicon friendly assistant scaffold that keeps the original source tree as architecture reference while replacing the runtime with a zero-dependency Node core.

## Goals

- Run on macOS arm64 with no npm runtime dependencies
- Prefer free/local tooling first, especially `ollama`
- Allow any model backend through pluggable providers
- Keep the structure simple: state, providers, tools, sessions, CLI

## Commands

```bash
npm run doctor
npm run config:init
npm run models
npm run chat
npm run prompt -- -m ollama:llama3.2 "Merhaba"
npm run build:mac
```

## Config

The app stores configuration in `~/.modai/config.json` or `$MODAI_HOME/config.json`.

Built-in provider types:

- `ollama`
- `openai-compatible`
- `anthropic`
- `gemini`

You can add more provider aliases without changing code if they fit one of these protocols.
