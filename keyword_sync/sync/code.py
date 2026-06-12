import os
import subprocess
from pathlib import Path

from ..core.fetcher import CommitInfo

DEFAULT_TIDB_WORKING_DIR_ENV = "TIDB_WORKING_DIR"


class CodeFetcher:
    def __init__(self, *, working_dir: Path) -> None:
        self.working_dir = working_dir

    @classmethod
    def from_env(cls, env_name: str = DEFAULT_TIDB_WORKING_DIR_ENV) -> "CodeFetcher":
        value = os.environ.get(env_name)
        if not value:
            raise ValueError(f"Missing {env_name}; set it to the local TiDB checkout.")
        return cls(working_dir=Path(value))

    def read_text(self, repo: str, ref: str, path: str) -> str:
        return self._git("show", f"{ref}:{path}")

    def list_commits_touching_path(
            self,
            repo: str,
            branch: str,
            path: str,
            *,
            since_sha: str | None = None,
            limit: int | None = None,
    ) -> list[CommitInfo]:
        revision = f"{since_sha}..{branch}" if since_sha else branch
        command = ["log", "--format=%H%x01%P%x01%s", "--reverse", revision, "--", path]
        output = self._git(*command)
        commits = []
        for line in output.splitlines():
            sha, parents, message = line.split("\x01", 2)
            commits.append(
                CommitInfo(
                    sha=sha,
                    parents=parents.split() if parents else [],
                    message=message,
                    html_url="",
                )
            )
        if limit is not None:
            commits = commits[:limit]
        return commits

    def _git(self, *args: str) -> str:
        try:
            result = subprocess.run(
                ["git", "-C", str(self.working_dir), *args],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except subprocess.CalledProcessError as err:
            raise RuntimeError(
                f"git {' '.join(args)} failed in {self.working_dir}: "
                f"{err.stderr.strip()}"
            ) from err
        return result.stdout
