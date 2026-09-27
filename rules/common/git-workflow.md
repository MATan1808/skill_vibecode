# Git Workflow

## Commit Message Format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

## Project Claude Config

Because Sếp keeps all projects/modules private, every commit/push of any project or module MUST include the full `[project]/.claude/` directory so cloned machines keep AIaC / Claude Code project configuration. Before staging `.claude/`, scan it for secrets; if token/API key/password/private key is found, stop and report instead of committing secrets.

Note: To disable co-author attribution on commits, set `"includeCoAuthoredBy": false` in `~/.claude/settings.json` (Claude Code appends `Co-Authored-By` by default; ECC does not ship this setting).

## Version & Release Synchronization Protocol

When bumping project or system version (`vX.Y.Z`), the following must be updated together in the same release commit:
1. **Core Version Files**: `VERSION`, `package.json`, `package-lock.json` (or framework equivalents: `pubspec.yaml`, `__manifest__.py`, `Cargo.toml`).
2. **Changelogs**: Record the new version header with date `(YYYY-MM-DD)` and tagged changes (`[NEW]`, `[FIX]`, `[IMPROVE]`, `[SECURITY]`, `[REFACTOR]`) in `docs/CHANGELOGS.md`.
3. **Telemetry & Dashboard**: Ensure all dashboard UI badges, telemetry servers, and APIs dynamically bind to the current version.
4. **Documentation**: Synchronize `README.md` and related docs in `docs/`.
5. **Git Commit & Tag**: Commit with `chore: release <Project> v<version>` using `Authored-By: 360org <support@360.org.vn>`. Create annotated release tag `v<version>` when requested.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
