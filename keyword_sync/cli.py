import argparse
import json
import os
from pathlib import Path

from .sync.config import load_config
from .sync.code import CodeFetcher
from .sync.metadata import write_metadata_files
from .sync.orchestrator import SyncOptions, run_sync
from .sync.state import KeywordSyncState, load_state


DEFAULT_CONFIG = Path(__file__).resolve().parent / "data" / "keyword-sync-config.toml"
DEFAULT_STATE = Path(__file__).resolve().parent / "data" / "keyword-sync-state.json"


def command_sync(args: argparse.Namespace) -> int:
    config = load_config(Path(args.config))
    if args.list_branches:
        print(json.dumps([branch.tidb_branch for branch in config.branches]))
        return 0

    state_path = Path(args.state) if args.state else None
    state = load_state(state_path) if state_path is not None else KeywordSyncState()
    code_fetcher = CodeFetcher.from_env(config.tidb_working_dir_env)
    options = SyncOptions(
        branch=args.branch,
        dry_run=args.dry_run,
    )
    result = run_sync(
        config=config,
        state=state,
        state_path=state_path,
        code_fetcher=code_fetcher,
        options=options,
    )
    if args.metadata_dir:
        write_metadata_files(
            result=result,
            config=config,
            output_dir=Path(args.metadata_dir),
            github_token=os.environ.get(args.github_token_env),
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m keyword_sync.cli",
        description="Synchronize TiDB keyword docs from parser.y changes.",
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--state", default=str(DEFAULT_STATE))
    parser.add_argument("--branch")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--list-branches",
        action="store_true",
        help="Print configured TiDB branches as a JSON array and exit.",
    )
    parser.add_argument(
        "--metadata-dir",
        help="Directory where PR body/comment metadata files are written.",
    )
    parser.add_argument(
        "--github-token-env",
        default="GH_TOKEN",
        help="Environment variable containing a GitHub token for PR metadata lookup.",
    )
    parser.set_defaults(func=command_sync)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
