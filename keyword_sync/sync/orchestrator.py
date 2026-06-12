from dataclasses import dataclass, field
from pathlib import Path

from .config import KeywordSyncConfig
from .docs import apply_target_plan, read_target_texts, target_keywords_path
from .state import (advance_branch_state, BranchState, get_last_handled_code_commit, KeywordSyncState, save_state)
from ..core.fetcher import Fetcher
from ..core.keywords import format_state
from ..core.plan import build_commit_plan, CommitPlan

COMMITS_PER_RUN = 1


@dataclass(frozen=True)
class SyncOptions:
    branch: str | None = None
    dry_run: bool = False


@dataclass
class SyncResult:
    commit_plans: list[CommitPlan] = field(default_factory=list)
    applied_targets: list[str] = field(default_factory=list)

    @property
    def changed(self) -> bool:
        return any(plan.changed for plan in self.commit_plans)


def run_sync(
        *,
        config: KeywordSyncConfig,
        state: KeywordSyncState,
        state_path: Path | None,
        code_fetcher: Fetcher,
        options: SyncOptions,
) -> SyncResult:
    result = SyncResult()
    mode = "dry-run" if options.dry_run else "apply"
    print(f"Keyword sync mode: {mode}")

    for branch in config.branches:
        if options.branch and branch.tidb_branch != options.branch:
            continue

        since_sha = get_last_handled_code_commit(state, branch.tidb_branch)
        commits = code_fetcher.list_commits_touching_path(
            config.tidb_repo,
            branch.tidb_branch,
            config.parser_path,
            since_sha=since_sha,
            limit=COMMITS_PER_RUN,
        )
        state_note = f" since {since_sha[:12]}" if since_sha else ""
        print(f"{branch.tidb_branch}: {len(commits)} parser.y commit(s){state_note}")
        target_texts = read_target_texts(branch.targets)

        for commit in commits:
            parent = commit.parent_sha or "<no-parent>"
            print(f"- {commit.sha[:12]} parent={parent[:12]} {commit.message}")
            plan = build_commit_plan(
                fetcher=code_fetcher,
                code_repo=config.tidb_repo,
                code_branch=branch.tidb_branch,
                parser_path=config.parser_path,
                commit=commit,
                targets=branch.targets,
                target_texts=target_texts,
            )
            result.commit_plans.append(plan)
            print_commit_plan(plan)
            for target_plan in plan.target_plans:
                target_texts[target_plan.target.name] = target_plan.updated_text

            if options.dry_run:
                continue

            applied_targets = apply_commit_plan(plan)
            for target_name in applied_targets:
                result.applied_targets.append(f"{commit.sha}:{target_name}")
                state.branches.setdefault(
                    branch.tidb_branch,
                    BranchState(),
                )
            advance_branch_state(state, branch.tidb_branch, commit.sha)
            if state_path is not None:
                save_state(state_path, state)

    return result


def print_commit_plan(plan: CommitPlan) -> None:
    if not plan.keyword_changes:
        print("  No tracked parser keyword changes detected.")
    else:
        for change in plan.keyword_changes:
            print(
                f"  - {change.keyword}: "
                f"{format_state(change.before)} -> {format_state(change.after)}"
            )

    for target_plan in plan.target_plans:
        changed = str(target_plan.changed).lower()
        print(
            f"  {target_plan.target.name}: "
            f"{target_keywords_path(target_plan.target)} changed={changed}"
        )
        for action in target_plan.actions:
            print(f"    - {action}")


def apply_commit_plan(plan: CommitPlan) -> list[str]:
    applied_targets = []
    for target_plan in plan.target_plans:
        if not target_plan.changed:
            print(f"  {target_plan.target.name}: no doc changes")
            continue

        apply_target_plan(target_plan, dry_run=False)
        applied_targets.append(target_plan.target.name)
        print(f"  {target_plan.target.name}: applied")
    return applied_targets
