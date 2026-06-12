from dataclasses import dataclass

from .keywords import KeywordChange, KeywordState


@dataclass(frozen=True)
class SanityLimits:
    min_keywords: int = 100
    max_removed_keywords: int = 20


def validate_parser_keyword_sets(
        base_keywords: dict[str, KeywordState],
        head_keywords: dict[str, KeywordState],
        *,
        limits: SanityLimits = SanityLimits(),
) -> None:
    if len(base_keywords) < limits.min_keywords:
        raise ValueError(
            f"Base parser keyword set is unexpectedly small: {len(base_keywords)}"
        )
    if len(head_keywords) < limits.min_keywords:
        raise ValueError(
            f"Head parser keyword set is unexpectedly small: {len(head_keywords)}"
        )


def validate_keyword_changes(
        changes: list[KeywordChange],
        *,
        limits: SanityLimits = SanityLimits(),
) -> None:
    removed = [change for change in changes if change.after is None]
    if len(removed) > limits.max_removed_keywords:
        raise ValueError(
            "Refusing keyword update with too many removals: "
            f"{len(removed)} > {limits.max_removed_keywords}"
        )
