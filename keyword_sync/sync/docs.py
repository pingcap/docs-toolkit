import os
import re
from pathlib import Path

from ..core.plan import DocTarget, TargetPlan


def working_dir_env_name(target_name: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", target_name).strip("_").upper()
    return f"{normalized}_WORKING_DIR"


def resolve_working_dir(target: DocTarget) -> Path:
    env_name = target.working_dir_env or working_dir_env_name(target.name)
    value = os.environ.get(env_name)
    if not value:
        raise ValueError(
            f"Missing {env_name}; set it to the local working directory for "
            f"{target.name}."
        )
    return Path(value)


def read_target_texts(targets: list[DocTarget]) -> dict[str, str]:
    texts = {}
    for target in targets:
        path = target_keywords_path(target)
        texts[target.name] = path.read_text(encoding="utf-8")
    return texts


def apply_target_plan(plan: TargetPlan, *, dry_run: bool) -> bool:
    if not plan.changed:
        return False
    if not dry_run:
        path = target_keywords_path(plan.target)
        path.write_text(plan.updated_text, encoding="utf-8")
    return True


def target_keywords_path(target: DocTarget) -> Path:
    return resolve_working_dir(target) / target.keywords_file
