from dataclasses import dataclass

from .docs import apply_keyword_changes_to_text
from .fetcher import CommitInfo, Fetcher
from .keywords import (compute_keyword_changes, KeywordChange, parse_parser_keywords)
from .sanity import SanityLimits, validate_keyword_changes, validate_parser_keyword_sets


@dataclass(frozen=True)
class DocTarget:
    name: str
    repo: str
    branch: str
    keywords_file: str = "keywords.md"
    working_dir_env: str | None = None


@dataclass(frozen=True)
class TargetPlan:
    target: DocTarget
    actions: list[str]
    original_text: str
    updated_text: str

    @property
    def changed(self) -> bool:
        return self.original_text != self.updated_text


@dataclass(frozen=True)
class CommitPlan:
    code_repo: str
    code_branch: str
    commit: CommitInfo
    parent_sha: str
    keyword_changes: list[KeywordChange]
    target_plans: list[TargetPlan]

    @property
    def changed(self) -> bool:
        return any(plan.changed for plan in self.target_plans)


def build_commit_plan(
        *,
        fetcher: Fetcher,
        code_repo: str,
        code_branch: str,
        parser_path: str,
        commit: CommitInfo,
        targets: list[DocTarget],
        target_texts: dict[str, str],
        sanity_limits: SanityLimits = SanityLimits(),
) -> CommitPlan:
    parent_sha = commit.parent_sha
    if parent_sha is None:
        raise ValueError(f"Commit {commit.sha} has no parent")

    base_parser = fetcher.read_text(code_repo, parent_sha, parser_path)
    head_parser = fetcher.read_text(code_repo, commit.sha, parser_path)
    base_keywords = parse_parser_keywords(base_parser)
    head_keywords = parse_parser_keywords(head_parser)
    validate_parser_keyword_sets(
        base_keywords,
        head_keywords,
        limits=sanity_limits,
    )
    keyword_changes = compute_keyword_changes(base_keywords, head_keywords)
    validate_keyword_changes(keyword_changes, limits=sanity_limits)

    target_plans = []
    for target in targets:
        original = target_texts[target.name]
        updated, actions = apply_keyword_changes_to_text(original, keyword_changes)
        target_plans.append(
            TargetPlan(
                target=target,
                actions=actions,
                original_text=original,
                updated_text=updated,
            )
        )

    return CommitPlan(
        code_repo=code_repo,
        code_branch=code_branch,
        commit=commit,
        parent_sha=parent_sha,
        keyword_changes=keyword_changes,
        target_plans=target_plans,
    )
