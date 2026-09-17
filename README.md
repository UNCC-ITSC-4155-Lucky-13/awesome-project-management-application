# Awesome Project Management Application

A project-management app for organizing projects, stories, sprints, assignments, comments, and team membership. The application uses the T3 stack with Next.js, tRPC, Drizzle ORM, PostgreSQL, Better Auth, Tailwind CSS, and shadcn/ui.

## Local setup

### Prerequisites

- Node.js 24
- pnpm 11.3.0, as pinned in `package.json`
- PostgreSQL running locally or through Docker
- A GitHub OAuth app for sign-in

### Install and configure

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   - Set `DATABASE_URL` to a PostgreSQL database created for local development.
   - Uncomment `DATABASE_TEST_URL` to keep test data separate from development data.
   - Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.
   - Set `BETTER_AUTH_GITHUB_CLIENT_ID` and `BETTER_AUTH_GITHUB_CLIENT_SECRET` from your GitHub OAuth app.
   - Configure the OAuth app callback URL as `http://localhost:3000/api/auth/callback/github`.

4. If you use Docker or Podman, start the local PostgreSQL container:

   ```bash
   ./start-database.sh
   ```

   The script creates missing development and test databases, and safely reuses them on later runs. Skip this step when using another PostgreSQL server.

5. Apply the committed database migrations:

   ```bash
   pnpm db:migrate
   ```

6. Start the application:

   ```bash
   pnpm dev
   ```

The local app runs at `http://localhost:3000`.

## Database development

The schema is defined in `src/server/db/schema.ts`. After completing a schema change, generate and apply its migration:

```bash
pnpm db:generate
pnpm db:migrate
```

Use `pnpm db:studio` to inspect local data. `pnpm db:push` applies the schema directly and should only be used when intentionally working without a migration.

## Tests

Run the test suite with:

```bash
pnpm test
```

Router tests use a real PostgreSQL database. Set `DATABASE_TEST_URL` to a separate disposable database before running them. If it is empty, tests fall back to `DATABASE_URL`. Tests apply migrations and truncate application tables, so never point either value at a database containing data you need.

Other useful commands are:

| Command              | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `pnpm test:watch`    | Rerun tests while editing                         |
| `pnpm test:coverage` | Run tests and enforce backend coverage thresholds |
| `pnpm db:studio`     | Open Drizzle Studio                               |

Coverage includes `src/server/api/**/*.ts` and `src/server/lib/**/*.ts`. Every included file must maintain 100% statement, branch, function, and line coverage. Narrow exclusions are appropriate only for unchanged generated setup or code that cannot execute in tests, and must explain why in a comment.

## Pull requests

Before opening or updating a PR, run the same checks used by GitHub Actions:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:coverage
pnpm build
```

All checks must pass. GitHub Actions runs lint and formatting, typechecking, tests and coverage, and the production build as separate jobs. The jobs continue independently when another check fails, and the coverage report is uploaded as the `backend-coverage` artifact.

Keep changes focused on the issue being implemented. Include tests for its acceptance criteria, validation failures, and authorization paths. Do not edit generated components in `src/components/ui` unless no practical alternative exists; build with their existing APIs and place custom shared components in `src/app/_components`.
