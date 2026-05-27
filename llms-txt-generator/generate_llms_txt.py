"""Generates llms.txt files from Markdown tables of contents."""

import os
import re
from pathlib import Path
import yaml
import sys

def transform_toc_list_item(
    docs_root_dir: Path,
    line_content: str,
    base_url: str,
    url_suffix: str
) -> str:
    """Rewrites internal links in a TOC list item and adds summaries."""

    def replace_link(match: re.Match) -> str:
        display_text = match.group(1).strip()
        raw_href = match.group(2).strip()

        if raw_href.startswith(("http://", "https://", "<http")):
            return match.group(0)

        if "#" in raw_href:
            link_path, link_anchor = raw_href.split("#", 1)
        else:
            link_path, link_anchor = raw_href, ""

        filename_without_ext = link_path.split("/")[-1].removesuffix(".md")
        anchor_fragment = f"#{link_anchor}" if link_anchor else ""
        external_url = f"{base_url}/{filename_without_ext}{url_suffix}{anchor_fragment}"

        document_summary = ""
        source_file_path = Path(docs_root_dir, link_path.lstrip("/"))

        try:
            with open(source_file_path, "r", encoding="utf-8-sig") as f:
                if f.readline().rstrip("\n") == "---":
                    frontmatter_lines = []
                    for line in f:
                        if line.rstrip("\n") == "---":
                            break
                        frontmatter_lines.append(line)
                    else:
                        frontmatter_lines = []

                    if frontmatter_lines:
                        frontmatter_text = "".join(frontmatter_lines)
                        frontmatter = yaml.safe_load(frontmatter_text) or {}
                        summary = frontmatter.get("summary")
                        plain_summary_match = re.search(
                            r"^summary:\s+([^'\">|].*\s#\S.*)$",
                            frontmatter_text,
                            flags=re.MULTILINE,
                        )
                        if plain_summary_match:
                            # YAML treats an unquoted ` #...` suffix as a comment.
                            summary = plain_summary_match.group(1).strip()
                        if summary is not None:
                            summary_text = " ".join(str(summary).split())
                            document_summary = f": {summary_text}"
        except FileNotFoundError:
            print(f"[WARNING] Referenced file not found: {source_file_path}", file=sys.stderr)
            return match.group(0)
        except Exception as e:
            print(f"[ERROR] Error processing file {source_file_path}: {e}", file=sys.stderr)
            return match.group(0)

        return f"[{display_text}]({external_url}){document_summary}"

    # The non-greedy match supports labels such as `[[date] title]`.
    markdown_link_pattern = r"\[(.+?)\]\(([^)]+)\)"
    return re.sub(markdown_link_pattern, replace_link, line_content)


def generate_llms_from_toc(
    toc_file_path: Path,
    docs_root_dir: Path,
    product_name: str,
    product_description: str,
    base_url: str,
    url_suffix: str,
) -> str:
    """Generates llms.txt content from a Markdown table of contents."""
    base_url = base_url.rstrip("/")

    output_lines = [f"# {product_name}", "", f"> {product_description}", ""]

    is_first_h1_skipped = False
    has_content_started = False

    try:
        with open(toc_file_path, "r", encoding="utf-8") as f:
            toc_lines = f.readlines()
    except FileNotFoundError:
        print(f"[ERROR] TOC file not found: {toc_file_path}", file=sys.stderr)
        return ""

    for line in toc_lines:
        leading_whitespace = " " * (len(line) - len(line.lstrip()))
        stripped_line = line.strip()

        if stripped_line.startswith("<!--") and stripped_line.endswith("-->"):
            continue

        if stripped_line.startswith("#"):
            if stripped_line.startswith("##"):
                output_lines.append(leading_whitespace + stripped_line)
                has_content_started = True
            elif not is_first_h1_skipped:
                # Product metadata replaces the first TOC heading.
                is_first_h1_skipped = True
                continue
            else:
                output_lines.append(leading_whitespace + stripped_line)
                has_content_started = True

        elif stripped_line.startswith(("- ", "* ")):
            transformed_line = transform_toc_list_item(
                docs_root_dir,
                stripped_line,
                base_url,
                url_suffix
            )
            output_lines.append(leading_whitespace + transformed_line)
            has_content_started = True

        elif len(stripped_line) == 0:
            if not has_content_started:
                continue
            output_lines.append("")

        else:
            print(f"[WARNING] Unrecognized TOC line format: {repr(line)}", file=sys.stderr)

    cleaned_lines = []
    for i, line in enumerate(output_lines):
        if i > 0 and line.strip() == "" and cleaned_lines[-1].strip() == "":
            continue
        cleaned_lines.append(line if line.endswith('\n') else line + '\n')

    return "".join(cleaned_lines)


def generate_task(
        product_key: str,
        product_config: dict,
        toc_relative_path: str,
        language: str,
        settings: dict,
) -> dict:
    """Builds a generation task for one product and language."""
    docs_staging_base = settings.get("docs_staging_base", "docs-staging/markdown-pages")
    website_docs_base = settings.get("website_docs_base", "website-docs/static")
    url_suffix = settings.get("url_suffix", ".md")
    lang_url_prefix = settings.get("lang_url_prefix", {})

    toc_file_path = f"{docs_staging_base}/{language}/{toc_relative_path}"
    docs_root_dir = str(Path(toc_file_path).parent) + "/"

    target_subdir = product_config.get("target_subdir", product_key)
    if language == "en":
        target_output_path = f"{website_docs_base}/{target_subdir}/llms.txt"
    else:
        target_output_path = f"{website_docs_base}/{language}/{target_subdir}/llms.txt"

    product_name = product_config.get("product_name", {})
    if isinstance(product_name, dict):
        product_name = product_name.get(language, product_name.get("en", product_key))

    product_description = product_config.get("product_description", {})
    if isinstance(product_description, dict):
        product_description = product_description.get(language, product_description.get("en", ""))

    base_url_pattern = product_config.get("base_url_pattern", "")
    lang_prefix = lang_url_prefix.get(language, f"{language}/" if language != "en" else "")
    base_url = base_url_pattern.format(lang_prefix=lang_prefix)

    return {
        "name": f"{product_key}_{language}",
        "toc_file_path": toc_file_path,
        "docs_root_dir": docs_root_dir,
        "target_output_path": target_output_path,
        "product_name": product_name,
        "product_description": product_description,
        "base_url": base_url,
        "url_suffix": url_suffix,
    }


def main():
    config_path = Path(__file__).resolve().parent / "llms_config.yaml"
    if not config_path.exists():
        print(f"Error: Configuration file not found at {config_path}", file=sys.stderr)
        sys.exit(1)
    wdr_path = Path(os.getenv("LLMS_WORKING_DIR", "tmp"))
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            source_config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f"Error parsing YAML configuration: {e}", file=sys.stderr)
        sys.exit(1)

    products = source_config.get("products", {})
    toc_sources = source_config.get("toc_sources", {})
    settings = source_config.get("settings", {})

    for product_key, sources in toc_sources.items():
        if product_key not in products:
            print(f"[WARNING] Product '{product_key}' not in products, skipping")
            continue

        product_config = products[product_key]
        for source in sources:
            toc_relative_path = source.get("toc_relative_path", "")
            languages = source.get("languages", ["en"])

            for language in languages:
                task = generate_task(product_key, product_config, toc_relative_path, language, settings)
                print(f"--- Processing task: {task['name']} ---")

                llms_content = generate_llms_from_toc(
                    toc_file_path=Path(wdr_path, task["toc_file_path"]),
                    docs_root_dir=Path(wdr_path, task["docs_root_dir"]),
                    product_name=task["product_name"],
                    product_description=task["product_description"],
                    base_url=task["base_url"],
                    url_suffix=task["url_suffix"],
                )

                if llms_content:
                    target_path = Path(wdr_path, task["target_output_path"])
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(target_path, "w", encoding="utf-8") as f:
                        f.write(llms_content)
                    print(f"Successfully generated {target_path}")


if __name__ == "__main__":
    main()
