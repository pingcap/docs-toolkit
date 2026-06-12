import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class BranchState:
    last_handled_code_commit: str | None = None
    pending_prs: dict[str, str] = field(default_factory=dict)


@dataclass
class KeywordSyncState:
    branches: dict[str, BranchState] = field(default_factory=dict)


def load_state(path: Path) -> KeywordSyncState:
    if not path.exists():
        return KeywordSyncState()

    data = json.loads(path.read_text(encoding="utf-8"))
    branches = {}
    for name, branch in data.get("branches", {}).items():
        branches[name] = BranchState(
            last_handled_code_commit=branch.get("last_handled_code_commit")
                                     or branch.get("last_handled_parser_commit"),
            pending_prs=dict(branch.get("pending_prs", {})),
        )
    return KeywordSyncState(branches=branches)


def save_state(path: Path, state: KeywordSyncState) -> None:
    data = {
        "branches": {
            name: {
                "last_handled_code_commit": branch.last_handled_code_commit,
                "pending_prs": branch.pending_prs,
            }
            for name, branch in sorted(state.branches.items())
        }
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def get_last_handled_code_commit(
        state: KeywordSyncState,
        tidb_branch: str,
) -> str | None:
    branch = state.branches.get(tidb_branch)
    if branch is None:
        return None
    return branch.last_handled_code_commit


def advance_branch_state(
        state: KeywordSyncState,
        tidb_branch: str,
        commit_sha: str,
) -> None:
    branch = state.branches.setdefault(tidb_branch, BranchState())
    branch.last_handled_code_commit = commit_sha
