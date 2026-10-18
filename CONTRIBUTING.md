# Contributing to Zadaci

Thanks for wanting to help. Bug reports, ideas, docs fixes and code are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/thecodingmontana/zadaci/issues) first, using the bug or feature template. For a big change, wait for a reply before writing code, so nobody's work goes to waste.
- **Security problems:** don't open a public issue. See [SECURITY.md](SECURITY.md).
- **Code of conduct:** by taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up the project

1. Fork the repository and clone your fork.
2. Follow **Getting started** in the [README](README.md): Node 22+, pnpm, a Postgres database and a `.env.local` copied from `.env.example`.
3. Run `pnpm db:migrate`, then `pnpm dev`.

## Making a change

1. Create a branch from `main`, for example `fix/board-drag` or `feat/note-templates`.
2. Keep the change focused: one fix or feature per pull request.
3. Follow the code around you. Small components, plain names, and a short comment only when the reason isn't obvious.
4. **Database changes:** edit the schema in `src/db`, run `pnpm db:generate`, and commit the generated migration.
5. **New GraphQL fields:** check the user's workspace and permissions in the resolver (see `src/lib/permissions.ts`), and validate input with Zod.
6. Add or update a test in `tests/` when you change behaviour, especially permissions, data writes or anything security-related.

## Checks to run

```bash
pnpm check                # Biome lint and format
pnpm exec tsc --noEmit    # types
DATABASE_URL=postgres://…/zadaci_test pnpm db:migrate
DATABASE_URL=postgres://…/zadaci_test pnpm test
```

Use a separate test database: the tests create and delete their own users and workspaces.

## Commits and pull requests

- Write commits in the [Conventional Commits](https://www.conventionalcommits.org) style: `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `perf: …`, `test: …`, `chore: …`.
- Open the pull request against `main` and fill in the template.
- Explain what changed and why, and add a screenshot or clip for anything visible.
- Make sure the checks above pass. A maintainer will review it, and may ask for changes before merging.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
