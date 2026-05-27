# llms-txt-generator

Generates localized `llms.txt` indexes from Markdown tables of contents and frontmatter summaries.

## Local Usage

Set `LLMS_WORKING_DIR` to a directory that contains the `docs-staging` input repository and the `website-docs` output repository.

```bash
uv venv llms-txt-generator/.venv
uv pip install --python llms-txt-generator/.venv/bin/python -r llms-txt-generator/pyproject.toml
LLMS_WORKING_DIR=/path/to/workspace \
  llms-txt-generator/.venv/bin/python llms-txt-generator/generate_llms_txt.py
```

For example, `/path/to/workspace` should contain:

```text
docs-staging/markdown-pages/
website-docs/static/
```

`llms_config.yaml` defines product metadata, TOC sources, locales, URL paths, and output locations.

Python dependencies are managed with `uv` in `pyproject.toml`.

## GitHub Actions

The [`generate-llms-txt.yml`](../.github/workflows/generate-llms-txt.yml) workflow runs at 8:00 every Friday (UTC+8) and can also be started manually. It:

1. Checks out `pingcap/docs-staging` from `main`.
2. Checks out `pingcap/website-docs` from `master`.
3. Generates `llms.txt` files into `website-docs/static`.
4. Creates or updates a pull request from `automation/generated-llms-txt` in `pingcap/website-docs`.

Configure these Actions secrets in the `docs-toolkit` repository:

| Secret | Purpose |
| --- | --- |
| `LLMS_TXT_APP_CLIENT_ID` | Client ID of the GitHub App installed on `website-docs`. |
| `LLMS_TXT_APP_PRIVATE_KEY` | Private key for that GitHub App. |

The GitHub App installation on `website-docs` must grant `Contents: Read and write` and `Pull requests: Read and write` permissions.
