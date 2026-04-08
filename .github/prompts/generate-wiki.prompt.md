---
description: "Generate a code wiki for a local folder. Produces output/wiki-data.json that powers the CodeWiki Local Agent website."
mode: agent
agent: codewiki
---

# Generate Code Wiki

Analyze the codebase in `${input:folderPath:Enter the absolute path to the local folder to analyze}` and generate a comprehensive wiki.

**Include filter** (leave blank for all): `${input:includeDirs:Optional: comma-separated directories to include (e.g. src,lib). Leave blank to scan all.}`
**Exclude filter** (leave blank for defaults): `${input:excludeDirs:Optional: additional comma-separated directories to exclude (e.g. tests,docs). Leave blank for defaults.}`

## Instructions

1. **Load filters** from `config/scan-filters.json`. If the user provided include/exclude overrides above, apply them.
2. **Scan** the folder at `${input:folderPath}` — build a file tree respecting the filters, read the README, identify the tech stack.
3. **Plan** the wiki structure: 8–12 pages grouped into logical sections.
4. **Generate** content for each page by reading the relevant source files and writing detailed Markdown with Mermaid diagrams and code citations.
5. **Write** the complete wiki JSON to `${input:folderPath}/output/wiki-data.json`.

Follow the full workflow defined in the codewiki agent. Generate all pages before writing the output file.
