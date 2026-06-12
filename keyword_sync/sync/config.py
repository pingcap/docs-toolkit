from dataclasses import dataclass
from pathlib import Path

import tomllib

from ..core.plan import DocTarget


@dataclass(frozen=True)
class BranchConfig:
    tidb_branch: str
    targets: list[DocTarget]


@dataclass(frozen=True)
class KeywordSyncConfig:
    tidb_repo: str
    parser_path: str
    tidb_working_dir_env: str
    branches: list[BranchConfig]


def load_config(path: Path) -> KeywordSyncConfig:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    branches = []

    for branch_data in data.get("branches", []):
        targets = [
            DocTarget(
                name=target["name"],
                repo=target["repo"],
                branch=target["branch"],
                keywords_file=target.get("keywords_file", "keywords.md"),
                working_dir_env=target.get("working_dir_env"),
            )
            for target in branch_data.get("targets", [])
        ]
        branches.append(
            BranchConfig(
                tidb_branch=branch_data["tidb_branch"],
                targets=targets,
            )
        )

    return KeywordSyncConfig(
        tidb_repo=data.get("tidb_repo", "pingcap/tidb"),
        parser_path=data.get("parser_path", "pkg/parser/parser.y"),
        tidb_working_dir_env=data.get("tidb_working_dir_env", "TIDB_WORKING_DIR"),
        branches=branches,
    )
