from dataclasses import dataclass
from typing import Protocol

PARSER_PATH = "pkg/parser/parser.y"


@dataclass(frozen=True)
class CommitInfo:
    sha: str
    parents: list[str]
    message: str
    html_url: str

    @property
    def parent_sha(self) -> str | None:
        if not self.parents:
            return None
        return self.parents[0]


class Fetcher(Protocol):
    def read_text(self, repo: str, ref: str, path: str) -> str:
        """Read a UTF-8 text file from a repository ref."""

    def list_commits_touching_path(
            self,
            repo: str,
            branch: str,
            path: str,
            *,
            since_sha: str | None = None,
            limit: int | None = None,
    ) -> list[CommitInfo]:
        """Return matching commits in chronological order."""
