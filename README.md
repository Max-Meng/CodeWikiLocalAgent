# CodeWiki Local Agent

AI-powered code wiki generator for any local codebase, powered by VS Code Copilot Agent.

## Overview

CodeWiki Local Agent generates a structured, interactive wiki website from any local codebase. It consists of two parts:

1. **VS Code Copilot Agent** (`@codewiki`) — Analyzes source code and generates a `wiki-data.json` file containing the wiki structure and page content with Mermaid diagrams and source citations.
2. **Next.js Frontend** — Renders the wiki as a deployable website with tree navigation, dark mode, Mermaid diagrams, syntax-highlighted code blocks, and Markdown/JSON export.

## Architecture

```
┌─────────────────────────────┐
│  VS Code Copilot Agent      │
│  (@codewiki)                │
│                             │
│  1. Scan local folder       │
│  2. Generate wiki structure │
│  3. Generate page content   │
│  4. Write wiki-data.json    │
└──────────┬──────────────────┘
           │ output/wiki-data.json
           ▼
┌─────────────────────────────┐
│  Next.js Frontend           │
│  (port 3000)                │
│                             │
│  • Wiki tree navigation     │
│  • Markdown rendering       │
│  • Mermaid diagrams         │
│  • Code syntax highlighting │
│  • Dark/light mode          │
│  • Export (MD / JSON)       │
└─────────────────────────────┘
```

## Quick Start

### Prerequisites

- VS Code with GitHub Copilot extension
- Node.js 20+

### Step 1: Generate the Wiki

1. Open VS Code in the target project folder.
2. Open Copilot Chat and select the `@codewiki` agent.
3. Use the `generate-wiki` prompt:
   ```
   @codewiki /generate-wiki
   ```
4. The agent will scan the codebase and write `output/wiki-data.json`.

### Step 2: Build & Preview the Wiki Site

```bash
# From the CodeWiki Local Agent project folder:

# Copy generated wiki data to the public folder
node scripts/validate-wiki-data.js path/to/output/wiki-data.json

# Install dependencies (first time)
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 to view the wiki.

### Step 3: Production Build

```powershell
# Using the build script (validates, copies, and builds)
.\scripts\Build-WikiSite.ps1 -WikiDataPath path\to\wiki-data.json

# Or manually
npm run build
npm start
```

## Deploy to Azure

### Option A: Azure Web App (Docker)

```bash
# Build Docker image
docker build -t codewiki-local-agent .

# Run locally
docker compose up

# Push to Azure Container Registry
az acr build --registry <ACR_NAME> --image codewiki-local-agent:latest .

# Deploy to Azure Web App
az webapp create --resource-group <RG> --plan <PLAN> --name <APP> \
  --container-image-name <ACR_NAME>.azurecr.io/codewiki-local-agent:latest
```

### Option B: Azure Web App (ZIP deploy)

```powershell
.\scripts\Build-WikiSite.ps1 -Deploy -ResourceGroup myRG -AppName my-codewiki
```

## Project Structure

```
.github/
  agents/
    codewiki.agent.md        # VS Code Copilot Agent definition
  prompts/
    generate-wiki.prompt.md   # Orchestration prompt
scripts/
  validate-wiki-data.js       # Validates wiki JSON & copies to public/
  Build-WikiSite.ps1          # Build + optional Azure deploy
src/
  app/
    layout.tsx                # Root layout with theme provider
    page.tsx                  # Main wiki viewer page
    globals.css               # Theme & styling
  components/
    Markdown.tsx              # Markdown renderer with Mermaid + syntax highlighting
    Mermaid.tsx               # Mermaid diagram renderer with fullscreen
    WikiTreeView.tsx          # Hierarchical wiki navigation tree
    ThemeToggle.tsx           # Dark/light mode toggle
  types/
    wiki/
      wikipage.tsx            # WikiPage interface
      wikistructure.tsx       # WikiStructure + WikiData interfaces
      index.ts                # Re-exports
output/                       # Generated wiki data (gitignored)
public/
  wiki-data.json              # Wiki data served to frontend (copied from output/)
Dockerfile                    # Multi-stage Node.js Docker build
docker-compose.yml            # Docker Compose configuration
```

## Wiki Data Format

The `wiki-data.json` file follows this structure:

```json
{
  "metadata": {
    "source": "/path/to/codebase",
    "generated_at": "2026-04-08T12:00:00Z",
    "page_count": 10,
    "generator": "codewiki-local-agent"
  },
  "structure": {
    "id": "wiki",
    "title": "My Project Wiki",
    "description": "AI-generated documentation",
    "pages": [
      {
        "id": "overview",
        "title": "Project Overview",
        "content": "# Overview\n\nMarkdown content with Mermaid diagrams...",
        "filePaths": ["src/main.ts", "README.md"],
        "importance": "high",
        "relatedPages": ["architecture"],
        "parentId": "section-overview"
      }
    ],
    "sections": [
      {
        "id": "section-overview",
        "title": "Overview",
        "pages": ["overview", "getting-started"]
      }
    ],
    "rootSections": ["section-overview"]
  }
}
```

## Comparison with DeepWikiLocal

| Feature | DeepWikiLocal | CodeWiki Local Agent |
|---------|--------------|----------------|
| LLM Provider | Google/OpenAI/Azure/Ollama/etc. | VS Code Copilot (built-in) |
| Input | Remote repo URL (GitHub/GitLab/Bitbucket) | Local folder |
| Backend | Python FastAPI + FAISS embeddings | None (agent generates static JSON) |
| Q&A Chatbot | Yes (RAG with embeddings) | No (static wiki only) |
| Deep Research | Yes (multi-turn) | No |
| Wiki Generation | Streaming via WebSocket | Batch via Copilot Agent |
| Frontend | Next.js (dynamic, API-driven) | Next.js (static JSON-driven) |
| Deployment | Docker (Python + Node.js) | Docker (Node.js only) |
| Auth | Optional repo tokens | N/A (local files) |

## License

MIT
