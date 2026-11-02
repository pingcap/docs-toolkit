# Documentation automation credentials

Keyword sync and llms.txt generation run with a read-only `GITHUB_TOKEN` and do not receive GitHub App credentials. Separate publishing jobs use fresh checkouts and accept only generated data files from artifacts in the same workflow run. Generated scripts, dependencies, Git configuration, and output paths are never executed or restored in publishing jobs.

Publishing runs only in `pingcap/docs-toolkit` on its default branch and uses the `docs-automation` environment. Keyword sync accepts only branches listed in `keyword_sync/data/keyword-sync-config.toml`; an empty input selects all configured branches.

## Required administrator setup before enabling publication

A repository administrator must configure the `docs-automation` environment:

- Restrict deployment branches to the repository's default branch.
- Require approval from the maintainers responsible for documentation publication, and prevent self-review. Disable administrator bypass where supported.
- Store `KEYWORD_SYNC_APP_CLIENT_ID`, `KEYWORD_SYNC_APP_PRIVATE_KEY`, `LLMS_TXT_APP_CLIENT_ID`, and `LLMS_TXT_APP_PRIVATE_KEY` as environment secrets. Remove the corresponding repository secrets so other jobs and workflow refs cannot access the keys.

Declaring an environment in YAML does not configure its protection rules. These settings and the secret migration must be completed by an administrator; this PR does not change repository settings. Do not rely on the workflow's branch condition alone to protect repository-level private keys from someone who can modify workflow files.

The keyword App must have Contents and Pull requests write permissions for `docs`, `docs-cn`, and `docs-toolkit`. Each installation token is narrowed to one repository; the toolkit token is created only when the generated state changes. The llms.txt App token is restricted to `website-docs`. These permissions cannot be narrowed to a Git branch by installation-token inputs; the workflow instead limits the files passed to PR creation. Tokens are automatically revoked at job completion.

Environment deployment approvals, workflow job logs, generated artifacts, signed commits, and PR links in the job summary provide the publication audit trail. Administrators manage environment protections and App installations; designated reviewers approve publishing jobs; automation opens PRs for normal repository review and merge.

## Local security regression checks

```sh
python3 -m pip install -r .github/tests/requirements.txt
python3 -m unittest discover -s .github/tests -v
actionlint .github/workflows/keyword-sync.yaml .github/workflows/generate-llms-txt.yml
```

Some actionlint releases have stale metadata for `actions/create-github-app-token@v3` and incorrectly require `app-id` instead of `client-id`. Check the action's current `action.yml` before treating these two diagnostics as workflow errors.
