# llms-txt-generator

The `llms-txt-generator` tool generates localized [`llms.txt`](https://llmstxt.org) indexes from Markdown tables of contents (TOCs) and frontmatter summaries. The `llms.txt` standard gives large language models (LLMs) a curated, link-rich entry point into the documentation, so they can answer questions accurately without crawling the full site.

## What this tool generates

For each product and language defined in [`llms_config.yaml`](./llms_config.yaml), the tool builds a per-product `llms.txt` file from the product's TOC and the frontmatter summaries of its listed documents, and writes it to one of the following paths under `website-docs/static/`:

- English: `<target_subdir>/llms.txt`
- Other languages: `<language>/<target_subdir>/llms.txt`

The tool doesn't produce the top-level aggregator files. Maintain the following `llms.txt` files manually:

- [`website-docs/static/llms.txt`](https://github.com/pingcap/website-docs/blob/master/static/llms.txt)
- [`website-docs/static/releases/llms.txt`](https://github.com/pingcap/website-docs/blob/master/static/releases/llms.txt)
- [`website-docs/static/zh/llms.txt`](https://github.com/pingcap/website-docs/blob/master/static/zh/llms.txt)
- [`website-docs/static/zh/releases/llms.txt`](https://github.com/pingcap/website-docs/blob/master/static/zh/releases/llms.txt)
- [`website-docs/static/ja/llms.txt`](https://github.com/pingcap/website-docs/blob/master/static/ja/llms.txt)
- [`website-docs/static/ja/releases/llms.txt`](https://github.com/pingcap/website-docs/blob/master/static/ja/releases/llms.txt)

## Update the configuration manually

Update [`llms_config.yaml`](./llms_config.yaml) in the following cases:

- A new product launches and needs its own `llms.txt` entry.
- A new TOC file is added under an existing product.
- An existing product adds support for a new language.

The `llms_config.yaml` file defines product metadata, TOC sources, locales, URL paths, and output locations.

## Run the generator locally

Before you run the generator, set the `LLMS_WORKING_DIR` environment variable to a directory that contains the `docs-staging` input repository and the `website-docs` output repository.

To install dependencies and generate the files, run the following commands:

```bash
uv venv llms-txt-generator/.venv
uv pip install --python llms-txt-generator/.venv/bin/python -r llms-txt-generator/pyproject.toml
LLMS_WORKING_DIR=/path/to/workspace \
  llms-txt-generator/.venv/bin/python llms-txt-generator/generate_llms_txt.py
```

The `/path/to/workspace` directory must contain the following subdirectories:

```text
docs-staging/markdown-pages/
website-docs/static/
```

The `pyproject.toml` file manages Python dependencies through `uv`.

## Run with GitHub Actions

The [`generate-llms-txt.yml`](../.github/workflows/generate-llms-txt.yml) workflow runs at 08:00 every Friday (UTC+8). You can also start it manually. The workflow performs the following steps:

1. Checks out `pingcap/docs-staging` from the `main` branch.
2. Checks out `pingcap/website-docs` from the `master` branch.
3. Generates the `llms.txt` files into `website-docs/static`.
4. Creates or updates a pull request from the `automation/generated-llms-txt` branch in `pingcap/website-docs`.

Before you run the workflow, configure the following Actions secrets in the `docs-toolkit` repository:

| Secret | Purpose |
| --- | --- |
| `LLMS_TXT_APP_CLIENT_ID` | Client ID of the GitHub App installed on `website-docs`. |
| `LLMS_TXT_APP_PRIVATE_KEY` | Private key for that GitHub App. |

The GitHub App installation on `website-docs` must grant the `Contents: Read and write` and `Pull requests: Read and write` permissions.
