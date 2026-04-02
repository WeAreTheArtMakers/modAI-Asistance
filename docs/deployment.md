# Deployment Guide

## Railway

The repository is ready for Railway using the included `Dockerfile` and `railway.toml`.

Suggested environment variables:

- `PORT` — provided by Railway
- `MODAI_WEB_HOST=0.0.0.0`
- `OPENAI_API_KEY` if using an OpenAI-compatible remote provider
- `ANTHROPIC_API_KEY` if using Anthropic
- `GEMINI_API_KEY` if using Gemini

Recommended deployment pattern:

1. deploy the web runtime to Railway
2. connect a custom domain
3. put Cloudflare in front for TLS, WAF, rate limiting, and caching

## Cloudflare

Current best path:

- use Cloudflare as the edge and domain layer
- keep the Node runtime on Railway for now

Reason:

- the current backend uses Node HTTP primitives and local SQLite behavior
- a full Workers/D1/R2 migration is feasible, but it is a separate product step

## Mobile access

Once the web runtime is deployed, the same app can be used on mobile browsers.

Recommended next improvements for mobile:

- session drawer instead of a full left sidebar
- larger hit areas for composer actions
- lightweight installable PWA manifest
- camera upload flow for charts and documents
