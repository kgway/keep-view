# Keep View Explorer

## Changes since 1.43.4

- Start new views with the newest modified notes while preserving saved choices.
- Use file creation time for missing or invalid creation dates, both when sorting together with other notes and when filtering by date range.
- Use standard ES Module imports in the source, while keeping the installed plugin as one CommonJS file.
- Clarify the type of tag-tree drag targets.
- Remove stylesheet `!important` overrides and simplify grid gap declarations while preserving the layout.
- Reuse the canvas used to measure preview labels.
- Preserve the full view area by overriding default ItemView padding with a selector scoped to Keep View.

Browse, filter, and manage notes in a Google Keep-style card view. Use Boolean tag queries, folder and date filters, full-text search, and bulk actions.

- English and Japanese interface.
- Desktop and mobile layouts.
- Relative paths by default when exporting results.
- Optional compressed local search cache.
- Creation timestamp import for Markdown notes migrated from Google Keep.

Requires Obsidian 1.8.7 or later. Install from the [community directory](https://community.obsidian.md/plugins/keep-view).

For manual installation, copy the attached `main.js`, `manifest.json` and `styles.css` into the vault's plugin folder for `keep-view`, then enable it in Obsidian. The repository README contains usage and data-handling details.
