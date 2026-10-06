# Card search

Search filters the card list, tree and exported paths. Metadata conditions run first; only their candidates enter full-text search. Matching is NFC-normalized, case-insensitive literal substring matching, including Japanese single characters, punctuation and whitespace. Titles and entire Markdown sources are searched separately.

## Storage

The persistent cache lives in `search-cache-v1` under the plugin directory, in at most eight path-hashed gzip buckets (`bucket-0.gz` through `bucket-7.gz`). Each note stores its path, modification time, size and normalized source. Matching uses restored source text directly, without token expansion or probabilistic signatures.

Format 2 uses compact rows. For Unicode-heavy buckets, characters are mapped to frequency-ranked variable-length integers with a UTF-16 code-unit dictionary. The smaller compressed result of plain UTF-8 and dictionary encoding is saved. ASCII skips the dictionary. Encoding preserves punctuation, whitespace, emoji and unusual Unicode.

Compression and decompression use the standard asynchronous [Compression Streams API](https://compression.spec.whatwg.org/). The API selects gzip settings; there is no compression-level option. The distributed plugin contains no compression library. fflate remains a development dependency for compatibility tests and historical size comparisons only. Environments without Compression Streams use direct candidate scanning, preserving search functionality.

Old 64-way shards are consolidated at the next search without re-reading unchanged notes. Both format-1 and format-2 shards are accepted. Replacements are written before old files are removed; failed consolidation can be retried. Newer compact entries take precedence if a removal was interrupted. Nothing is loaded or converted at startup. Failed or corrupt writes can be reconstructed from notes; gzip checksums are verified by the standard decompressor.

Search compares file versions and reads only missing or modified notes. In-session vault events also invalidate same-size, same-timestamp edits. Offline edits must update the modification time or size to be detected. Deleted paths are pruned when their bucket is visited.

Jobs share one queue across views. Cancelled jobs stop between notes and save completed bucket updates. Changes rewrite only their bucket. Read failures are reported rather than cached as misses; write failures preserve current results and are retried. Clearing a query keeps saved data.

Fast search is enabled by default. Disabling it switches open views to direct candidate scanning without deleting saved buckets. Cache deletion pauses active searches, waits for pending writes, removes only the eight compact and 64 legacy filenames, and clears retained bodies and query decisions. It never removes notes or plugin settings. Views wait for an explicit search to rebuild the cache. Stored source text is compressed, not encrypted.

Expanded bucket retention targets 12 MiB of estimated text/entry payload. An active bucket, encoding buffers, runtime overhead and Obsidian caches are additional. The most recent query retains at most 10,000 boolean decisions. Note processing yields when needed; compression runs asynchronously. Text encoding and parsing still run on the main thread. Different queries may need to decompress buckets again when the corpus exceeds the retention limit.

## Incremental display

The view supplies candidates in the selected sort order. Progress includes both matches and settled candidates, so a later hit can wait until preceding candidates have been decided. Only that stable prefix is appended to the existing masonry grid. Existing cards are not remounted at completion. Tree mode releases complete top-level folders in tree order, followed by root notes; this prevents later folder insertions from shifting earlier results.

Search status occupies the center of the existing action row between note creation and path export, without adding space above the cards. Progress never replaces the result count beside path export. Exports remain disabled until the complete result is known. Superseded paints check both their run and connected container before modifying grids. Desktop and mobile-width browser tests compare early card coordinates with a normal completed render and check cancellation during queued paints.

## Measurements

`pnpm bench:compression`, `pnpm bench:search` and `pnpm bench:disk` use the same deterministic 3,000-note Japanese/Latin fixture (26.19 MB UTF-8). They do not read user notes. Historical storage results with 64 shards in one Node.js run:

| Storage format | Saved size |
| --- | ---: |
| 1.26, signatures and gzip level 6 | 10.26 MB |
| 1.27, character dictionary and fflate | 6.36 MB |
| Standard gzip with the same format | 6.12 MB |

The standard implementation saved about 3.8% over 1.27 and 40.4% over 1.26 in this fixture. Output sizes can vary by browser implementation and note contents.

Stronger compression was also considered. In a representative 888 KB dictionary-encoded sample, standard Brotli produced 317 KB versus gzip's 336 KB, but compression took about 1,040 ms versus 71 ms in Node.js. Brotli support is also less widespread in host browsers. Deflate-raw saved only 18 bytes per bucket over gzip. Neither trade-off justified changing the format.

The disk benchmark uses temporary files, warm OS caches and a fresh search engine per measurement. Across three runs on Windows, median times were:

| Query | Direct scan | Saved cache |
| --- | ---: | ---: |
| Rare Japanese phrase | 378 ms; 3,000 note reads | 346 ms; 0 note reads |
| Common Japanese word | 365 ms; 3,000 note reads | 320 ms; 0 note reads |

Results are checked for equality. These are not mobile or Obsidian measurements. If Obsidian already holds every source in memory, direct scanning can be faster than loading a compressed cache; no universal speed advantage is claimed. Retained buckets and repeated-query decisions avoid that loading cost on warm searches. More aggressive compression was deliberately avoided to limit query overhead.
