## What and why

What does this change, and why is it needed? Link the issue it closes (for example `Closes #123`).

## How to check it

Steps a reviewer can follow to see it working.

## Screenshots

For anything visible, before and after.

## Checklist

- [ ] `pnpm check` and `pnpm exec tsc --noEmit` pass
- [ ] Tests added or updated, and `pnpm test` passes against a test database
- [ ] A migration is included if the schema in `src/db` changed
- [ ] New GraphQL fields check workspace access and permissions
- [ ] No secrets or personal data in the code, commits or screenshots
