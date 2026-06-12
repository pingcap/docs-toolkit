import re
from dataclasses import dataclass

TRACKED_SECTIONS = {"ReservedKeyword", "UnReservedKeyword", "TiDBKeyword"}
SECTION_COMMENTS = {
    "ReservedKeyword": "The following tokens belong to ReservedKeyword",
    "UnReservedKeyword": "The following tokens belong to UnReservedKeyword",
    "TiDBKeyword": "The following tokens belong to TiDBKeyword",
    "NotKeywordToken": "The following tokens belong to NotKeywordToken",
}
KEYWORD_RE = re.compile(r'^\t\w+\s+"([A-Z0-9_]+)"$')


@dataclass(frozen=True)
class KeywordState:
    section: str

    @property
    def label(self) -> str | None:
        if self.section == "ReservedKeyword":
            return "R"
        return None


@dataclass(frozen=True)
class KeywordChange:
    keyword: str
    before: KeywordState | None
    after: KeywordState | None


def parse_parser_keywords(parser_text: str) -> dict[str, KeywordState]:
    section = None
    keywords: dict[str, KeywordState] = {}

    for line in parser_text.splitlines():
        if line == "":
            section = None
            continue

        for candidate, marker in SECTION_COMMENTS.items():
            if marker in line:
                section = candidate
                break

        if section not in TRACKED_SECTIONS:
            continue

        match = KEYWORD_RE.match(line)
        if not match:
            continue

        keyword = match.group(1)
        state = KeywordState(section=section)
        existing = keywords.get(keyword)
        if existing and existing != state:
            raise ValueError(
                f"Keyword {keyword} appears in both {existing.section} and {section}"
            )
        keywords[keyword] = state

    return keywords


def compute_keyword_changes(
        base_keywords: dict[str, KeywordState],
        head_keywords: dict[str, KeywordState],
) -> list[KeywordChange]:
    changes = []
    for keyword in sorted(set(base_keywords) | set(head_keywords)):
        before = base_keywords.get(keyword)
        after = head_keywords.get(keyword)
        if before != after:
            changes.append(KeywordChange(keyword=keyword, before=before, after=after))
    return changes


def keyword_changes_from_parser_text(
        base_parser_text: str,
        head_parser_text: str,
) -> list[KeywordChange]:
    return compute_keyword_changes(
        parse_parser_keywords(base_parser_text),
        parse_parser_keywords(head_parser_text),
    )


def format_state(state: KeywordState | None) -> str:
    if state is None:
        return "absent"
    if state.label:
        return f"{state.section} ({state.label})"
    return state.section
