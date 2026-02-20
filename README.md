# UTA Notify

Incident communications management platform for transit agencies. Built as a demo modeled after Utah Transit Authority's operations.

**[Live Demo](https://uta-notify.jmorrison.workers.dev)**

## Overview

UTA Notify is a full-stack web application for managing transit service disruptions — from incident creation through multi-channel subscriber notification. It demonstrates a realistic operations workflow with role-based access control, audit logging, and templated messaging.

### Features

- **Incident Management** — Create, track, update, and resolve service incidents with severity levels, affected routes/modes, and timestamped update threads
- **Multi-Channel Messaging** — Compose notifications with per-channel overrides (email, SMS, push, signage, GTFS-RT) and track delivery status
- **Message Templates** — Reusable templates with variable interpolation for consistent communications across incident types
- **Subscriber Management** — Manage subscriber preferences by route, mode, severity, and notification channel
- **Role-Based Access Control** — Four roles (Admin, Editor, Operator, Viewer) with granular permission enforcement on both UI and API
- **Audit Logging** — Full audit trail of all user actions with filtering, detail views, and compliance-ready records
- **Reports & Analytics** — Incident trends, response times, channel performance, and subscriber engagement metrics
- **Automation Rules** — Configurable triggers for automatic notifications based on severity, delay duration, or schedule

### Demo Accounts

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | admin@uta.org | Demo1234 | Full access |
| Editor | editor@uta.org | Demo1234 | Create & edit incidents, templates, subscribers |
| Operator | operator@uta.org | Demo1234 | Manage active incidents |
| Viewer | viewer@uta.org | Demo1234 | Read-only access |

## Tech Stack

- **Frontend** — React 19, TanStack Router, TanStack Query, Tailwind CSS 4, Radix UI
- **Backend** — TanStack Start (SSR), Cloudflare Workers
- **Database** — Cloudflare D1 (SQLite)
- **Storage** — Cloudflare R2 (attachments), KV (sessions/cache)
- **Auth** — PBKDF2 password hashing, encrypted session cookies
- **Language** — TypeScript throughout

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare CLI)
- A Cloudflare account (for D1, R2, KV)

### Setup

```bash
# Install dependencies
bun install

# Create D1 database and KV namespace
wrangler d1 create uta-notify-db
wrangler kv namespace create KV

# Update wrangler.jsonc with your database_id and KV namespace id

# Apply schema
bun run db:migrate

# Set secrets
wrangler secret put SESSION_SECRET

# Start dev server
bun run dev
```

### Scripts

```bash
bun run dev              # Start dev server on port 8080
bun run build            # Production build
bun run deploy           # Build and deploy to Cloudflare Workers
bun run db:migrate       # Apply schema to local D1
bun run db:migrate:prod  # Apply schema to production D1
bun run typecheck        # TypeScript type checking
```

### Seed Data

```bash
# Generate realistic demo data
bun scripts/seed.ts --execute          # Remote D1
bun scripts/seed.ts --execute --local  # Local D1

# Set demo passwords
bun scripts/set-demo-passwords.ts --execute
```

## Project Structure

```
src/
  routes/           # File-based routing (TanStack Router)
    login.tsx       # Authentication
    index.tsx       # Dashboard
    incidents/      # Incident CRUD + detail view
    messages/       # Message composition + delivery tracking
    templates.tsx   # Message templates
    subscribers.tsx # Subscriber management
    reports.tsx     # Analytics & reporting
    audit/          # Audit log + detail view
    settings.tsx    # System configuration
  lib/              # Shared utilities
    auth.ts         # Authentication & session management
    auth-client.ts  # Client-side auth hooks
    password.ts     # PBKDF2 hashing (Web Crypto API)
    permissions.ts  # RBAC permission definitions
  server/           # Server-side logic
    incidents.ts    # Incident queries & mutations
    messages.ts     # Message & delivery operations
    templates.ts    # Template CRUD
    subscribers.ts  # Subscriber management
    audit.ts        # Audit logging
    reports.ts      # Report generation
  components/       # Shared UI components
core/
  db/
    schema.sql      # Database schema + seed reference data
migrations/         # D1 schema migrations
scripts/            # CLI utilities (seed, password management)
```

## License

MIT
