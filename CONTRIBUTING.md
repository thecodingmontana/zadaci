# Contributing

Thanks for your interest in contributing to Zadaci.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint. Every commit must follow the format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of:

| Type       | Usage                                      |
|------------|--------------------------------------------|
| `feat`     | A new feature                              |
| `fix`      | A bug fix                                  |
| `docs`     | Documentation only changes                 |
| `style`    | Code style changes (formatting, etc.)      |
| `refactor` | Code change that's neither a fix nor a feature |
| `perf`     | Performance improvement                    |
| `test`     | Adding or correcting tests                 |
| `build`    | Build system or dependency changes         |
| `ci`       | CI configuration changes                   |
| `chore`    | Other changes that don't touch src or tests |
| `revert`   | Reverts a previous commit                  |

### Scope (optional)

Lowercase, describes the area of change (e.g. `rxdb`, `schema`, `ui`, `api`).

### Subject

- Imperative tense ("add" not "added" / "adds")
- Lowercase — no capital letters or PascalCase
- No trailing period
- Max 72 characters

### Body (optional)

- Blank line before body
- Wrap at 100 characters
- Explain what and why, not how

### Breaking changes

Add `BREAKING CHANGE:` in the footer for breaking changes. Only `feat` and `fix` types may include breaking changes.

### Examples

```
feat(rxdb): add team and tag sync collections

Add RxDB collections for teams and tags with workspace-scoped
replication and Realtime channel subscriptions.
```

```
fix(schema): add missing inverse relations for new tables

Add user.user_status, workspace.teams, and workspace.tags
inverse relations that were omitted from the initial addition.
```

```
docs: update README with realtime setup and clone URL
```

## Pull Request Process

1. Make small, focused commits following the convention above.
2. Keep PRs scoped to a single concern.
3. Run `pnpm run check-types && pnpm run lint` before pushing.
4. The `main` branch is protected — open a PR for review.
