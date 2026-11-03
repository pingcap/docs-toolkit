# doc-toolkit

The unified toolkit for TiDB documentation. It integrates essential functions like document linting, formatting, and automated publishing, aiming to boost documentation writing efficiency and ensure quality and consistency across the official TiDB documentation site.

## Features

- markdown-summarizer: AI-based summarizer for markdown files' metadata generation
- markdown-translator: AI-based translation tool for markdown files
- llms-txt-generator: generates localized `llms.txt` documentation indexes and submits automated updates to [pingcap/website-docs](https://github.com/pingcap/website-docs)
- keyword-sync: keeps TiDB keyword docs aligned with `pkg/parser/parser.y` changes. See [keyword_sync/README.md](keyword_sync/README.md).
