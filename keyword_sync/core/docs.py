import re
from pathlib import Path

from .keywords import KeywordChange, KeywordState

TABS_MARKER = '<TabsPanel letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ" />'
DOC_BULLET_RE = re.compile(r"^- ([A-Z0-9_]+)(?: \((R|R-Window)\))?$")
LETTER_ANCHOR_RE = re.compile(
    r'^<a id="[A-Z]" class="letter" href="#[A-Z]">[A-Z]</a>$'
)


def bullet_for(keyword: str, state: KeywordState) -> str:
    if state.label:
        return f"- {keyword} ({state.label})"
    return f"- {keyword}"


def find_generated_region(lines: list[str]) -> int:
    try:
        return lines.index(TABS_MARKER)
    except ValueError as err:
        raise ValueError(f"Could not find generated keyword marker: {TABS_MARKER}") from err


def find_letter_anchor(lines: list[str], start_index: int, letter: str) -> int | None:
    anchor = f'<a id="{letter}" class="letter" href="#{letter}">{letter}</a>'
    for index in range(start_index, len(lines)):
        if lines[index] == anchor:
            return index
    return None


def find_next_letter_anchor(lines: list[str], start_index: int) -> int:
    for index in range(start_index + 1, len(lines)):
        if LETTER_ANCHOR_RE.match(lines[index]):
            return index
    return len(lines)


def parse_doc_keywords(lines: list[str], start_index: int) -> dict[str, int]:
    seen = {}
    for index in range(start_index, len(lines)):
        match = DOC_BULLET_RE.match(lines[index])
        if not match:
            continue
        keyword = match.group(1)
        if keyword in seen:
            raise ValueError(
                f"Duplicate keyword bullet: {keyword} at lines "
                f"{seen[keyword] + 1} and {index + 1}"
            )
        seen[keyword] = index
    return seen


def insert_keyword(
        lines: list[str],
        region_start: int,
        keyword: str,
        state: KeywordState,
) -> str:
    letter = keyword[0]
    anchor_index = find_letter_anchor(lines, region_start, letter)
    if anchor_index is None:
        raise ValueError(f"Could not find letter section for {letter}")

    section_end = find_next_letter_anchor(lines, anchor_index)
    new_bullet = bullet_for(keyword, state)

    for index in range(anchor_index + 1, section_end):
        match = DOC_BULLET_RE.match(lines[index])
        if not match:
            continue
        existing_keyword = match.group(1)
        if keyword < existing_keyword:
            lines.insert(index, new_bullet)
            return f"added {keyword} before {existing_keyword}"

    insert_at = section_end
    while insert_at > anchor_index and lines[insert_at - 1] == "":
        insert_at -= 1
    lines.insert(insert_at, new_bullet)
    return f"added {keyword} at end of {letter}"


def apply_keyword_changes_to_text(
        keywords_text: str,
        changes: list[KeywordChange],
) -> tuple[str, list[str]]:
    lines = keywords_text.splitlines()
    region_start = find_generated_region(lines)
    doc_keywords = parse_doc_keywords(lines, region_start)
    actions = []

    for change in changes:
        keyword = change.keyword
        current_index = doc_keywords.get(keyword)

        if change.after is None:
            if current_index is None:
                actions.append(f"{keyword}: already absent")
                continue
            del lines[current_index]
            actions.append(f"{keyword}: removed")
            doc_keywords = parse_doc_keywords(lines, region_start)
            continue

        desired = bullet_for(keyword, change.after)
        if current_index is None:
            action = insert_keyword(lines, region_start, keyword, change.after)
            actions.append(f"{keyword}: {action}")
            doc_keywords = parse_doc_keywords(lines, region_start)
            continue

        if lines[current_index] == desired:
            actions.append(f"{keyword}: already {desired}")
        else:
            old = lines[current_index]
            lines[current_index] = desired
            actions.append(f"{keyword}: changed {old} -> {desired}")

    updated = "\n".join(lines) + ("\n" if keywords_text.endswith("\n") else "")
    return updated, actions


def apply_keyword_changes_to_file(
        keywords_file: Path,
        changes: list[KeywordChange],
        *,
        dry_run: bool,
) -> tuple[list[str], bool]:
    original = keywords_file.read_text(encoding="utf-8")
    updated, actions = apply_keyword_changes_to_text(original, changes)
    changed = updated != original
    if changed and not dry_run:
        keywords_file.write_text(updated, encoding="utf-8")
    return actions, changed
