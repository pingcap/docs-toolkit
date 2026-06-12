# keyword-sync

The keyword sync tool updates `keywords.md` in `pingcap/docs` and `pingcap/docs-cn` from keyword changes in TiDB's `pkg/parser/parser.y`.

Requires Python 3.11 or later. The examples below use `uv` as a Python runner without a project file or lockfile.

Run from the repository root:

```bash
export TIDB_WORKING_DIR=/path/to/tidb
export DOCS_WORKING_DIR=/path/to/docs
export DOCS_CN_WORKING_DIR=/path/to/docs-cn

uv run --python 3.12 python -m keyword_sync.cli \
  --config keyword_sync/data/keyword-sync-config.toml \
  --state keyword_sync/data/keyword-sync-state.json \
  --dry-run
```

Inspect a single TiDB branch:

```bash
uv run --python 3.12 python -m keyword_sync.cli \
  --branch master \
  --dry-run
```

Each run handles only the oldest unhandled `parser.y` commit for the selected branch, so every generated docs PR maps to one TiDB source commit.

Run keyword-sync tests:

```bash
uv run --python 3.12 python -m unittest discover -s tests
```

- The default config is in `keyword_sync/data/keyword-sync-config.toml`.
- The default state file is `keyword_sync/data/keyword-sync-state.json`; it records the latest handled `parser.y` commit per TiDB branch.
