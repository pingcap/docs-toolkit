# Documentation automation credentials

Keyword sync and llms.txt generation use a read-only `GITHUB_TOKEN`. Separate publishing jobs use fresh checkouts and copy only validated data files from artifacts in the same workflow run. They do not execute generated scripts or restore generator workspaces.

Publishing runs only in `pingcap/docs-toolkit` on its default branch and uses the `docs-automation` environment. Keyword sync accepts only branches listed in `keyword_sync/data/keyword-sync-config.toml`; an empty input selects all configured branches.

## One-time administrator setup

Configure `docs-automation` under repository Settings → Environments:

- For deployment branches, select **Selected branches and tags** and add only a **Branch** rule for `main`. This limits the workflow ref allowed to use the credentials, not the documentation branches it can update.
- Leave **Required reviewers** disabled so generation proceeds directly to automated PR creation without manual approval.
- Add `KEYWORD_SYNC_APP_CLIENT_ID`, `KEYWORD_SYNC_APP_PRIVATE_KEY`, `LLMS_TXT_APP_CLIENT_ID`, and `LLMS_TXT_APP_PRIVATE_KEY` as environment secrets, then remove their repository-level copies. Use the original credential values; GitHub does not expose stored secret values for copying.

This PR does not change repository settings. Declaring an environment in YAML does not configure its branch rules or migrate secrets. Maintainers must also protect changes to `main` through the repository's normal code review and branch protection process; someone who can change workflows on the allowed branch can change how its credentials are used.

Keyword tokens are limited to one repository each, and the `docs-toolkit` token is created only when state changes. The llms.txt token is restricted to `website-docs`. Token permissions remain Contents and Pull requests write, with automatic revocation at job completion. Installation tokens cannot be scoped to a Git branch; publication uses the configured PR bases and file allowlists.

Administrators manage the environment and App credentials. Workflow logs, signed commits, and PR links in job summaries record automation activity; the generated PRs follow normal repository review and merge procedures.

## Local regression checks

```sh
python3 -m pip install -r .github/tests/requirements.txt
python3 -m unittest discover -s .github/tests -v
```
