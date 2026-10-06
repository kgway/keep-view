# Contributing

Use Node.js 24 and pnpm 11.19.0. Install the version in `packageManager`, then run:

```sh
pnpm install --frozen-lockfile
pnpm release:prepare
pnpm exec playwright install chromium
pnpm test:ui
```

Use synthetic notes and relative vault paths in reports, screenshots and tests. Keep personal account details, tokens, vault data and host application files out of commits. Browser screenshots are local artifacts and are ignored.

For text changes, edit values in `lib/ja.json` or `lib/en.json`, preserving keys and numbered placeholders. Run tests and rebuild after editing.

For implementation changes, follow [ARCHITECTURE.md](ARCHITECTURE.md). Describe what changed and how it was verified in your pull request. Existing browser tests use Obsidian mocks; actual desktop/mobile testing remains necessary.

Contributions are licensed under the project's MIT license.
