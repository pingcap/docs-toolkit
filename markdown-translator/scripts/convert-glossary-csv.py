#!/usr/bin/env python3

import argparse
import csv
from pathlib import Path


DEFAULT_INPUT = Path("src/glossary.csv")
DEFAULT_OUTPUT = Path("output/docs-en-to-ja-glossary.csv")
SOURCE_HEADER = "Source Language"
TARGET_HEADER = "Target Language"


def find_header_indexes(row):
    source_index = None
    target_index = None

    for index, value in enumerate(row):
        cell = value.strip()
        if SOURCE_HEADER in cell:
            source_index = index
        if TARGET_HEADER in cell:
            target_index = index

    if source_index is None or target_index is None:
        return None

    return source_index, target_index


def iter_pairs(input_path):
    with input_path.open("r", encoding="utf-8-sig", newline="") as input_file:
        reader = csv.reader(input_file)
        indexes = None

        for row in reader:
            if indexes is None:
                indexes = find_header_indexes(row)
                continue

            source_index, target_index = indexes
            source = row[source_index].strip() if len(row) > source_index else ""
            target = row[target_index].strip() if len(row) > target_index else ""

            if source and target:
                yield source, target

        if indexes is None:
            raise ValueError(
                f"Could not find header row containing '{SOURCE_HEADER}' and '{TARGET_HEADER}'."
            )


def convert(input_path, output_path):
    pairs = list(iter_pairs(input_path))
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8", newline="") as output_file:
        writer = csv.writer(output_file)
        writer.writerows(pairs)

    return len(pairs)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert glossary.csv to a two-column source/target glossary CSV."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=DEFAULT_INPUT,
        type=Path,
        help=f"Input CSV path. Defaults to {DEFAULT_INPUT}.",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default=DEFAULT_OUTPUT,
        type=Path,
        help=f"Output CSV path. Defaults to {DEFAULT_OUTPUT}.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    count = convert(args.input, args.output)
    print(f"Wrote {count} glossary rows to {args.output}")


if __name__ == "__main__":
    main()
