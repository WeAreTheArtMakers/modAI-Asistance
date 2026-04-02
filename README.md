# modAI

`modAI` is an open-source, local-first AI assistant for macOS Apple Silicon.

It combines:

- a native Tauri desktop shell for macOS
- a lightweight web chat runtime
- pluggable model providers
- computer-use tools with explicit permissions
- session memory backed by SQLite
- local-first workflows with Ollama as the default path

The product is under active development. The current priority is a clean ChatGPT/Codex-style interface, reliable multimodal chat, and safe agent workflows that work both locally and on the web.

## Status

- Desktop app: working
- Local web app: working
- Ollama chat: working
- Ollama image input: working
- Computer-use tools: working with macOS permissions
- Agent mode: enabled only for task and desktop flows
- Railway deploy path: prepared
- Cloudflare front-door / edge path: documented and prepared for next split

## Why modAI

modAI is being built as a serious daily-use assistant instead of a demo shell.

Core goals:

- local-first by default
- compatible with the user’s preferred model stack
- safe computer control with visible approvals
- fast, minimal, readable UI
- open architecture for skills, plugins, and providers
- a path to web and mobile access without losing the local desktop experience

## Architecture

Main directories:

- `modai/src/web` — local web UI and HTTP server
- `modai/src/providers` — Ollama, Gemini, Anthropic, OpenAI-compatible providers
- `modai/src/tools` — file, shell, memory, screenshot, and computer-use tools
- `modai/src/services` — config, sessions, skills, plugins, SQLite memory
- `src-tauri` — native macOS shell
- `.modai/skills` — built-in project skills
- `scripts` — build and packaging scripts

## Features

### Chat

- clean local chat UI
- session history
- image upload
- model switching
- theme support

### Agent flows

- standard chat stays direct and tool-free
- task mode enables planning + tools
- desktop mode enables computer-use flows
- permission prompts for sensitive actions

### Computer use

- screen analysis
- click visible text
- mouse click
- mouse drag
- scroll
- focus window
- type text
- press keys
- AppleScript fallback for advanced cases

### Memory

- SQLite-backed session history
- searchable notes
- reusable context for future tasks

### Built-in skills

- `computer-operator`
- `continuous-improvement`
- `chart-analyst`
- `daily-operator`
- `workday-planner`

## Local development

Requirements:

- Node.js `20+`
- Rust toolchain for Tauri builds
- macOS for the desktop app
- Ollama for the default local model path

Install / run:

```bash
npm test
npm run web
```

Desktop build:

```bash
npm run build:mac
```

Useful commands:

```bash
npm run doctor
npm run models
npm run cargo:check
```

## Ollama quick start

```bash
ollama serve
ollama list
```

Recommended local models:

- `modAI:latest`
- `gemma3:4b`
- `qwen2.5vl:7b`
- `qwen2.5-coder:latest`

## Web and mobile access

The same local web runtime can be deployed for browser access.

### Railway

This repository includes:

- `Dockerfile`
- `railway.toml`

The production web server now binds to `0.0.0.0` and respects `PORT`, so Railway can run it directly.

### Cloudflare

Recommended near-term setup:

1. deploy the main app on Railway
2. place Cloudflare in front for domain, caching, TLS, and WAF
3. later split API/storage to edge-native services if needed

The current server still relies on Node APIs and local SQLite semantics, so a full Workers-native migration is a separate step.

## Open source

This application is intended to be fully open-source. The codebase is evolving quickly, and some directories still contain earlier analysis/reference material from prior research work. The active product surface is `modai/` plus `src-tauri/`.

## Product direction

Current improvement tracks:

- cleaner ChatGPT/Codex-grade UI
- better mobile layout
- richer multimodal reasoning
- safer tool orchestration
- better deployability
- stronger memory and retrieval
- self-improving internal workflows

## License

MIT
