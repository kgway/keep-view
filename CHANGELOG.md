# Changelog

## 1.43.4 — creation date guidance

- Explain missing or invalid creation dates in a dialog once per app session, with a preview-first shortcut for notes whose filenames contain supported timestamps.
- Remember Don't show again and skip the guidance checks while disabled. The Creation date guidance setting restores it.
- Preserve the existing date sorting, filtering and import rules; guidance does not modify notes.

## 1.43.3 — initial card display

- Resume card rendering when a newly opened view is attached to the workspace. Cards appear without changing the sort order, including in folder-tree mode and when opening a hidden tab.

## 1.43.2 — validation and review improvements

- Validate saved settings and search-cache entries before use, and check API and data types during development.
- Make plugin settings searchable on Obsidian 1.13 and later, with the existing settings screen available on older versions.
- Replace broad hover selectors with scoped event handling and reduce CSS overrides while preserving desktop and mobile layouts.
- Add a manually started GitHub Actions build with provenance attestations for the three release assets.

## 1.43.1 — foreground note opening and display name

- Open tapped cards and newly created notes in the foreground, including when the host prefers background tabs. Await file opening, then reveal the same tab using public Obsidian APIs.
- Change the display name to Keep View Explorer; keep the plugin ID, settings and installation folder as `keep-view`.


## 1.43.0 — initial feature set

- Browse Markdown notes as cards or in a folder tree.
- Filter by tag expressions, folders, dates and literal full-text search.
- Create, select, move, trash and edit frontmatter tags in bulk.
- Export search-result paths and import creation timestamps from filenames.
- Support English and Japanese, with desktop and mobile layouts.

Earlier versions were local development builds.
