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
2. **Scan** the folder at `${input:folderPath}` — build a file tree respecting the filters, read the README, identify the tech stack. **Scan both code files AND markup/template files** (XAML, HTML, Vue, etc.) to understand UI structure, controls, and data bindings.
3. **Plan** the wiki structure: scale page count to project complexity (6–10 for small, 12–20 for medium, 18–30 for large projects). Create separate pages per major feature area rather than one summary page. Use subsections for hierarchy.
4. **Generate** content for each page by reading **both implementation files and markup files**. Include Mermaid diagrams (at least one per page), evidence-backed tables, UI control inventories, user workflow sequences, and code citations.
5. **Write** the complete wiki JSON to `${input:folderPath}/output/wiki-data.json`.

Follow the full workflow defined in the codewiki agent. Generate all pages before writing the output file.
