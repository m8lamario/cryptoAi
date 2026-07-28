# AI Crypto Agent

Private operational console for the AI crypto investment system.
This is a self-hosted, single-user application intended for localhost or trusted LAN/VPN access only.

## Prerequisites

- Node.js >= 20
- pnpm >= 10 (`npm install -g pnpm`)
- Docker + Docker Compose (for PostgreSQL and Redis)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values (see Auth Setup below)

# Start infrastructure
docker compose up -d

# Generate Prisma client
pnpm db:generate

# Run initial migration
pnpm db:migrate

# Seed the database and set the owner password (first run)
OWNER_PASSWORD=<your-strong-password> pnpm db:seed
```

## Auth Setup (Phase 0B)

This application uses a single owner account. **There is no public registration.**

### Setting the owner password

The owner password is hashed with scrypt and stored in PostgreSQL. The plaintext
password is never written to disk or logged. Set it via an environment variable
on the first seed run:

```bash
OWNER_PASSWORD=my-strong-passphrase pnpm db:seed
```

After the hash is stored you may unset `OWNER_PASSWORD`. Re-running `db:seed`
without `OWNER_PASSWORD` is safe — it preserves the existing hash.

> **Never put the actual password in `.env.example`, source code, or logs.**

### Cookie behavior

- The session cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`.
- `Secure` is controlled by `SESSION_COOKIE_SECURE` in `.env`.
  - Set to `false` for local HTTP development.
  - Set to `true` when serving over HTTPS (LAN/VPN with TLS termination).
- The session token is a random 32-byte value. Only its SHA-256 hash is stored in the database.

### Session expiry and logout

- Sessions expire after `SESSION_TTL_SECONDS` seconds (default 24 h).
- Visit the dashboard and click **Sign out**, or POST `/api/auth/logout`.
- Logging out immediately revokes the session in the database.

### Access restrictions

- The dashboard (`apps/web`, port 3001) requires an active session.
- The Express API (`apps/api`, port 4000) protects `/private/*`, `/market-data/*`, `/analytics/*` and `/dashboard/*` with the same session cookie.
- `GET /health` and `GET /ready` are public on the API.
- `GET /api/health` is public on the Next.js app.

### Network security

- Do **not** expose PostgreSQL, Redis, the internal API port, or admin ports to the public internet.
- Restrict dashboard access to `localhost`, a trusted private LAN, or a VPN.

## Development

```bash
# Start all apps in development mode
pnpm dev

# Or start individually
pnpm --filter @cryptoai/web dev
pnpm --filter @cryptoai/api dev
pnpm --filter @cryptoai/worker dev
```

## Available Scripts

| Command             | Description                                         |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | Start all apps in development mode                  |
| `pnpm build`        | Build all packages and apps                         |
| `pnpm lint`         | Run ESLint across the monorepo                      |
| `pnpm typecheck`    | Run TypeScript checks across the monorepo           |
| `pnpm test`         | Run all tests                                       |
| `pnpm format`       | Format code with Prettier                           |
| `pnpm format:check` | Check formatting                                    |
| `pnpm db:generate`  | Generate Prisma client                              |
| `pnpm db:migrate`   | Run database migrations                             |
| `pnpm db:seed`      | Seed the database (set OWNER_PASSWORD on first run) |

## Architecture

- **apps/web** – Private Next.js operational dashboard (port 3001)
- **apps/api** – Internal Express API (port 4000)
- **apps/worker** – Background BullMQ worker
- **packages/contracts** – Shared TypeScript contracts
- **packages/config** – Environment variable validation
- **packages/database** – Prisma client, schema and password utilities
- **packages/typescript-config** – Shared TypeScript configuration

## Security

- No public registration — single owner account only
- Password hashed with scrypt (Node built-in crypto)
- Session token stored only as SHA-256 hash in PostgreSQL
- All secrets remain server-side
- Dashboard accessible only via localhost, LAN, or VPN
- PostgreSQL and Redis bound to localhost (127.0.0.1) in development
- CSRF protection via strict Origin check on state-changing auth routes
- Login rate limiting (in-memory, per-IP fixed window)
