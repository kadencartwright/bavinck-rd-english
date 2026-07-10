# Bavinck's *Reformed Dogmatics* in English

This repository contains a public-domain English translation of Herman Bavinck's *Gereformeerde Dogmatiek*, based on the public-domain Dutch text of the first edition.

## Contents

- `data/raw/`: original Project Gutenberg source files for the four Dutch volumes
- `data/clean/`: normalized Dutch source text
- `data/metadata/`: source metadata
- `translation/`: the complete English translation, arranged in 621 Markdown files across four volumes
- `publication/`: publication metadata and EPUB styling
- `scripts/generate-latex`: generate a standalone LaTeX book source
- `scripts/generate-epub`: generate an EPUB 3 ebook

The translation contains approximately 898,000 words. It includes Bavinck's front matter, all 56 sections, expanded contents, and the Scripture, name, and subject indexes.

## Generate publication files

The publication scripts require [Pandoc](https://pandoc.org/) and may be run from any directory.

```bash
./scripts/generate-latex
./scripts/generate-epub
```

The default outputs are `dist/bavinck-reformed-dogmatics.tex` and `dist/bavinck-reformed-dogmatics.epub`. Pass a path as the first argument to either script to choose another output location. If Pandoc is not on `PATH`, set `PANDOC=/path/to/pandoc` when invoking the script.

Generated publication files are intentionally excluded from Git. They are available from the [v1.0.0 GitHub release](https://github.com/kadencartwright/bavinck-rd-english/releases/tag/v1.0.0).

## License

See [LICENSE](LICENSE). The project goal is to publish the English text as a public-domain edition.
