# modAI

`modAI` is the local-first AI operating layer for macOS Apple Silicon.

It is built for people who want one fast assistant that can:

- chat with the model stack they already use
- automate daily desktop tasks
- write code and operate like an agent
- generate images when the selected model supports it
- stay usable as a real product instead of a demo UI

If ChatGPT is a browser tab and Claude is a research partner, `modAI` is intended to be the assistant that lives closer to the operating system and the user’s real workflow.

It combines:

- a native Tauri desktop shell for macOS
- a lightweight web chat runtime
- pluggable model providers
- computer-use tools with explicit permissions
- session memory backed by SQLite
- local-first workflows with Ollama as the default path

The product is under active development. The current priority is a clean ChatGPT/Codex-style interface, reliable multimodal chat, safe computer-use flows, and a deployment path that works both locally and on the web.

## Marketing copy

**modAI turns your Mac into an AI workspace, not just an AI chat.**

Use local models with Ollama, connect Gemini or Anthropic when you need more power, run computer tasks with approvals, save reusable skills, keep reminders alive, and stay in one focused interface that is designed for real work.

modAI is aimed at:

- founders and operators
- creators and marketers
- developers and technical agents
- freelancers and agencies
- advanced users who want local control without giving up modern model quality

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
- session history with delete controls
- image upload
- model switching
- English-first UI with Turkish language switch
- light and dark theme support

### Agent flows

- standard chat stays direct and tool-free
- task mode enables planning + tools
- desktop mode enables computer-use flows
- permission prompts for sensitive actions
- direct desktop shortcuts for common macOS actions

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
- scheduled tasks with in-app reminders and chime alerts while the app is open

### Built-in skills

- `computer-operator`
- `continuous-improvement`
- `chart-analyst`
- `daily-operator`
- `workday-planner`
- `sales-outreach`
- `content-repurposer`
- `market-scan`
- `meeting-prep`

### Extensibility

- install external skills directly from the Settings drawer
- macOS Keychain storage for cloud provider API keys
- local and cloud provider tabs with editable endpoints
- project-level built-in skills in `.modai/skills`
- MCP connectors with HTTP, stdio, legacy SSE, and OAuth-ready auth fields

### Code workspace

- workspace root picker for repo-scoped sessions
- collapsible file outline for folder-first navigation
- inline file editor and save flow inside the app
- command palette hooks for file and workspace actions

## Local development

Requirements:

- Node.js `22+`
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

## Provider setup

`modAI` defaults to a local Ollama path, but the desktop app can also connect to:

- Gemini
- Anthropic
- OpenAI-compatible local servers such as LM Studio

Cloud provider API keys can be saved inside the app and stored in macOS Keychain.

## Scheduled task behavior

Scheduled tasks are stored locally in SQLite and shown inside the Settings drawer.

When the desktop app is open and a task reaches its due time, `modAI` will:

- add an activity event
- trigger a short in-app chime
- show a system notification if notification permission has been granted

This is currently an in-app reminder system, not a full background daemon.

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
- stronger language manager and future i18n support
- better mobile layout
- richer multimodal reasoning
- safer tool orchestration
- better deployability
- stronger memory and retrieval
- self-improving internal workflows

## Build with Love

Build with Love by WeAreTheArtMakers.

## License

WeAreTheArtMakers
