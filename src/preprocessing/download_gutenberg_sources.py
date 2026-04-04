#!/usr/bin/env python3
"""Download the Project Gutenberg source texts for Bavinck's volumes."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Final
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


VOLUMES: Final[dict[str, dict[str, str]]] = {
    "1": {
        "ebook_id": "51052",
        "slug": "gereformeerde-dogmatiek-eerste-deel-inleiding-principia",
        "filename": "pg51052.txt",
        "title": "Gereformeerde dogmatiek. Eerste deel. Inleiding. Principia.",
        "url": "https://www.gutenberg.org/ebooks/51052.txt.utf-8",
    },
    "2": {
        "ebook_id": "67966",
        "slug": "gereformeerde-dogmatiek-tweede-deel",
        "filename": "pg67966.txt",
        "title": "Gereformeerde dogmatiek. Tweede deel.",
        "url": "https://www.gutenberg.org/ebooks/67966.txt.utf-8",
    },
    "3": {
        "ebook_id": "68527",
        "slug": "gereformeerde-dogmatiek-derde-deel",
        "filename": "pg68527.txt",
        "title": "Gereformeerde dogmatiek. Derde deel",
        "url": "https://www.gutenberg.org/ebooks/68527.txt.utf-8",
    },
    "4": {
        "ebook_id": "69005",
        "slug": "gereformeerde-dogmatiek-vierde-deel",
        "filename": "pg69005.txt",
        "title": "Gereformeerde dogmatiek. Vierde deel",
        "url": "https://www.gutenberg.org/ebooks/69005.txt.utf-8",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Project Gutenberg TXT sources for Bavinck's Gereformeerde dogmatiek."
    )
    parser.add_argument(
        "--volume",
        dest="volumes",
        action="append",
        choices=sorted(VOLUMES),
        help="Volume number to download. Repeat to select multiple volumes. Defaults to all.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/raw"),
        help="Directory to write downloaded TXT files into.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Redownload files even if they already exist.",
    )
    return parser.parse_args()


def download_file(url: str, destination: Path) -> None:
    with urlopen(url) as response:
        data = response.read()
    destination.write_bytes(data)


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    selected_volumes = args.volumes or sorted(VOLUMES)
    failures = 0

    for volume in selected_volumes:
        spec = VOLUMES[volume]
        destination = output_dir / spec["filename"]

        if destination.exists() and not args.force:
            print(f"skip volume {volume}: {destination} already exists", file=sys.stderr)
            continue

        try:
            download_file(spec["url"], destination)
        except (HTTPError, URLError) as exc:
            failures += 1
            print(f"error volume {volume}: {exc}", file=sys.stderr)
            continue

        print(f"downloaded volume {volume}: {destination}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
