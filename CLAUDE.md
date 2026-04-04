# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ApaltoBot is a Discord bot that displays live VATSIM (Virtual Air Traffic Simulation) pilot and ATC activity. It polls the VATSIM data feed and updates Discord channel messages for each configured guild.

## Commands

```bash
npm run build        # Lint + compile TypeScript to dist/
npm run build:watch  # Continuous build with file watching
npm run lint         # ESLint with zero warnings allowed (--max-warnings=0)
npm run serve        # Run compiled app from dist/
npm start            # Build then serve
```

No test suite exists in this project.

**Docker (local dev):**
```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

## Architecture

**Dependency Injection:** The app uses [Inversify](https://inversify.io/) throughout. All injectable services are decorated with `@injectable()` and registered in `src/inversify.ts` (symbols) and wired up in `src/index.ts` (container bindings).

**Service lifecycle:**
- `VatsimClient` and `AviationUtility` — singletons shared across all guilds
- `DiscordGuild` and `UserManager` — one instance per Discord guild, created via factory

**Data flow:**
1. `VatsimClient` fetches VATSIM data feed on an interval (≥120s per VATSIM ToS)
2. `DiscordBot` holds a `DiscordGuild` per configured guild
3. Each `DiscordGuild` uses `VatsimClient` data to build and update Discord channel messages
4. `UserManager` persists the Discord ID ↔ VATSIM ID mappings to JSON files on disk

**Module layout:**
- `src/aviation/` — Airport data loading and lookup
- `src/discord/` — Bot coordinator (`discord-bot.ts`) and per-guild logic (`discord-guild.ts`)
- `src/users/` — User persistence with periodic save intervals
- `src/vatsim/` — VATSIM HTTP client and data models
- `src/config.ts` — Typed configuration classes, all values from env vars
- `src/inversify.ts` — DI symbol constants
- `src/logging.ts` — Console logging with category support

## Configuration

All configuration is via environment variables (see `readme.md` for full list). Key ones:

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_APPLICATION_ID` | App ID |
| `DISCORD_GUILDS_JSON_PATH` | Path to `discord-guilds.json` |
| `USERS_JSON_PATH` | Directory for per-guild user JSON files |
| `AVIATION_AIRPORTS_JSON_PATH` | Path to `airports.json` |
| `VATSIM_DATA_URL` | VATSIM data feed URL |
| `VATSIM_DATA_REFRESH_INTERVAL` | Poll interval in ms (minimum 120000) |

Guild configuration lives in `data/discord-guilds.json`. User data is persisted in `data/users/` (one JSON file per guild).

## Deployment

CI/CD: GitHub Actions on push to `master` → builds Docker image → pushes to `ghcr.io/jordankasper11/apaltobot-nodejs:latest` → triggers Coolify webhook.

Production uses `docker-compose.yml` with `pull_policy: always` so Coolify always pulls the latest image. The `docker-compose.override.yml` is for local dev (builds from local Dockerfile, mounts `./data`).

## ESLint

Strict rules enforced — zero warnings allowed. Notable rules: no `var`, guard-for-in, consistent returns, TypeScript strict type checking. Run `npm run lint` before committing.
