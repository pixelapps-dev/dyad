# Contributing

Before opening a pull request, please open an issue and discuss whether the change makes sense in Pagemate.

- For a high-level overview of how the app works, see the [Architecture Guide](./docs/architecture.md).
- For the clean-room agent loop that replaced the FSL-licensed upstream path, see [docs/agent_architecture.md](./docs/agent_architecture.md) and the tree diagram in [FORK.md](./FORK.md).

## Development

Pagemate is an Electron app.

**Install dependencies:**

```sh
pnpm install
```

**Create the userData directory (required for database):**

```sh
# Unix/macOS/Linux:
mkdir -p userData

# Windows PowerShell (run only if folder doesn't exist):
mkdir userData

# Windows Command Prompt (run only if folder doesn't exist):
md userData
```

**Generate DB migrations:**

If you change the DB schema (i.e. `src/db/schema.ts`), you will need to generate a DB migration.

```sh
pnpm db:generate
```

> If you want to discard a DB migration, reset your database by deleting `userData/sqlite.db`.

**Run locally:**

```sh
pnpm start
```

## Testing

### Unit tests

```sh
pnpm test
```

### E2E tests

Build the app for E2E testing:

```sh
pnpm build
```

> You only need to re-build the app when changing app code. You don't need to re-build it if you're just updating the tests.

Run the whole e2e test suite:

```sh
pnpm e2e
```

Run a specific test file:

```sh
pnpm e2e e2e-tests/context_manage.spec.ts
```

Update snapshots for a test:

```sh
pnpm e2e e2e-tests/context_manage.spec.ts -- --update-snapshots
```

## Code reviews

Pagemate relies on AI code reviewers (Codex / Claude Code) to catch issues. If a comment is irrelevant, leave a brief reply and mark it resolved.
