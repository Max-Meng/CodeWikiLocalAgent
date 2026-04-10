# CodeWiki Local Agent

AI-powered code wiki generator for any local codebase, powered by VS Code Copilot Agent.

## Overview

CodeWiki Local Agent generates a structured, interactive wiki website from any local codebase. It consists of two parts:

1. **VS Code Copilot Agent** (`@codewiki`) — Analyzes source code and generates a `wiki-data.json` file containing the wiki structure and page content with Mermaid diagrams and source citations.
2. **Next.js Frontend** — Renders wikis as a deployable website with a **multi-project home page**, tree navigation, dark mode, Mermaid diagrams, syntax-highlighted code blocks, and Markdown/JSON export.

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
│  validate-wiki-data.js      │
│  --fix --name <project-id>  │
│                             │
│  • Auto-fix schema drift    │
│  • Copy to public/wikis/    │
│  • Register in home catalog │
└──────────┬──────────────────┘
           │ public/wikis/<id>.json
           │ public/wiki-registry.json
           ▼
┌─────────────────────────────┐
│  Next.js Frontend           │
│  (port 3000)                │
│                             │
│  /         → Home (catalog) │
│  /wiki/:id → Wiki viewer    │
│                             │
│  • Multi-project home page  │
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

- **VS Code** with the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
- **Node.js 20+**
- Open the **CodeWiki Local Agent** project folder in VS Code (it must be in your workspace for the `@codewiki` agent to be available)

---

### Step 1: Generate the Wiki

There are two ways to invoke the agent — use whichever you prefer.

#### Option A: Use the built-in prompt (recommended)

1. Open VS Code with the CodeWiki Local Agent project in your workspace.
2. Open **Copilot Chat** (Ctrl+Shift+I) and switch to **Agent** mode.
3. Type `/generate-wiki` and press Enter.
4. You will be prompted for:
   - **Folder path** — the absolute path to the codebase you want to document (e.g., `C:\MyProject`).
   - **Include filter** *(optional)* — comma-separated directories to scan exclusively (e.g., `src,lib`). Leave blank to scan everything.
   - **Exclude filter** *(optional)* — additional directories to exclude on top of the defaults in `config/scan-filters.json` (e.g., `tests,docs`). Leave blank to use defaults.
5. The agent will:
   1. Load file filters from `config/scan-filters.json`
   2. Recursively scan the target folder, skipping excluded directories/files
   3. Read key source files, README, and configuration files
   4. Plan the wiki structure (8–30 pages depending on project size)
   5. Generate Markdown content for each page with Mermaid diagrams and code citations
   6. Write `output/wiki-data.json` to the target folder
   7. Run validation and auto-fix any schema issues

#### Option B: Chat directly with the agent

1. Open **Copilot Chat** and switch to **Agent** mode.
2. Type a message like:
   ```
   @codewiki Analyze the codebase at C:\MyProject and generate a comprehensive wiki.
   ```
3. The agent follows the same workflow as the prompt above.

> **Output location**: The wiki JSON is written to `<target-folder>/output/wiki-data.json` by default. You can also ask the agent to write it to a custom path.

### Step 2: Publish and Preview Locally

```powershell
# From the CodeWiki Local Agent project folder:

# Validate, auto-fix, and publish as a named project on the home page
node scripts/validate-wiki-data.js C:\MyProject\output\wiki-data.json --fix --name my-project

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

Open http://localhost:3000 to see the home page with your project card. Click it to open the wiki viewer at `/wiki/my-project`.

> **Tip**: The `--fix` flag automatically repairs common schema issues (missing metadata, sections without IDs, etc.) if the LLM output drifted from the expected format.

> **Multi-wiki**: Run the validate command with a different `--name` for each project. Each call upserts into `public/wiki-registry.json`, so the home page accumulates all your wikis.

```powershell
# Add more wikis — each appears as a card on the home page
node scripts/validate-wiki-data.js C:\OtherProject\output\wiki-data.json --fix --name other-project
```

### Step 3: Production Build

```powershell
# Build for production (wiki data must already be published to public/ via Step 2)
npm run build

# Start the production server
npm start
```

Or use the all-in-one build script:

```powershell
.\scripts\Build-WikiSite.ps1 -WikiDataPath C:\MyProject\output\wiki-data.json
```

---

## Deploy to Azure Web App

### Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed and authenticated (`az login`)
- An Azure subscription

### Option A: ZIP Deploy (simplest — no Docker required)

**One-time setup** — create the Web App:

```powershell
# Create a resource group (skip if you already have one)
az group create --name codewiki-rg --location eastus

# Create an App Service Plan (B1 is sufficient for a wiki site)
az appservice plan create --name codewiki-plan --resource-group codewiki-rg --sku B1 --is-linux

# Create the Web App with Node.js 20 runtime
az webapp create --resource-group codewiki-rg --plan codewiki-plan --name my-codewiki --runtime "NODE:20-lts"

# Set the startup command (Next.js standalone output uses server.js)
az webapp config set --resource-group codewiki-rg --name my-codewiki --startup-file "node server.js"
```

**Deploy** — run this whenever you regenerate wiki content or add new projects:

```powershell
# Publish wiki(s) first (if not already done in Step 2)
node scripts/validate-wiki-data.js C:\MyProject\output\wiki-data.json --fix --name my-project

# Build and deploy in one command
.\scripts\Build-WikiSite.ps1 `
    -WikiDataPath C:\MyProject\output\wiki-data.json `
    -Deploy `
    -ResourceGroup codewiki-rg `
    -AppName my-codewiki
```

Or deploy manually:

```powershell
# Build
npm run build

# Package standalone output (includes public/wikis/ and wiki-registry.json)
Copy-Item -Path "public" -Destination ".next\standalone\public" -Recurse -Force
Copy-Item -Path ".next\static" -Destination ".next\standalone\.next\static" -Recurse -Force
Compress-Archive -Path ".next\standalone\*" -DestinationPath ".next-deploy.zip" -Force

# Deploy
az webapp deploy --resource-group codewiki-rg --name my-codewiki --src-path ".next-deploy.zip" --type zip
```

Your wiki will be live at `https://my-codewiki.azurewebsites.net`.

### Option B: Docker Container

**Build and push to Azure Container Registry:**

```powershell
# Make sure wiki(s) are published to public/ before building
node scripts/validate-wiki-data.js C:\MyProject\output\wiki-data.json --fix --name my-project

# Build and push using ACR Tasks (no local Docker needed)
az acr build --registry <ACR_NAME> --image codewiki-site:latest .

# Or build locally and push
docker build -t <ACR_NAME>.azurecr.io/codewiki-site:latest .
az acr login --name <ACR_NAME>
docker push <ACR_NAME>.azurecr.io/codewiki-site:latest
```

**Deploy to Web App for Containers:**

```powershell
az webapp create --resource-group codewiki-rg --plan codewiki-plan --name my-codewiki `
    --deployment-container-image-name <ACR_NAME>.azurecr.io/codewiki-site:latest
```

**Or run locally with Docker Compose:**

```bash
docker compose up
# Opens at http://localhost:3000
```

## Project Structure

```
.github/
  agents/
    codewiki.agent.md        # VS Code Copilot Agent definition
  prompts/
    generate-wiki.prompt.md   # Orchestration prompt
config/
  scan-filters.json             # File extension & directory filters
scripts/
  validate-wiki-data.js       # Validates wiki JSON, auto-fixes drift, copies to public/
  Build-WikiSite.ps1          # Build + optional Azure ZIP deploy
src/
  app/
    layout.tsx                # Root layout with theme provider
    page.tsx                  # Home page — multi-project catalog
    globals.css               # Theme & styling
    wiki/
      [id]/
        page.tsx              # Wiki viewer for a single project
  components/
    Markdown.tsx              # Markdown renderer with Mermaid + syntax highlighting
    Mermaid.tsx               # Mermaid diagram renderer with fullscreen
    WikiTreeView.tsx          # Hierarchical wiki navigation tree
    ThemeToggle.tsx           # Dark/light mode toggle
  types/
    wiki/
      wikipage.tsx            # WikiPage interface
      wikistructure.tsx       # WikiStructure + WikiData interfaces
      wikiregistry.ts         # WikiProject + WikiRegistry interfaces
      index.ts                # Re-exports
output/                       # Generated wiki data (gitignored)
public/
  wikis/                      # Per-project wiki JSON files (gitignored)
    snappy.json
    my-project.json
  wiki-registry.json          # Project catalog for the home page (gitignored)
  wiki-data.json              # Legacy single-wiki fallback (gitignored)
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
| Multi-Project Home | Yes (project cards) | Yes (project cards with search) |
| Q&A Chatbot | Yes (RAG with embeddings) | No (static wiki only) |
| Deep Research | Yes (multi-turn) | No |
| Wiki Generation | Streaming via WebSocket | Batch via Copilot Agent |
| Frontend | Next.js (dynamic, API-driven) | Next.js (static JSON-driven) |
| Deployment | Docker (Python + Node.js) | Docker (Node.js only) or ZIP deploy |
| Auth | Optional repo tokens | N/A (local files) |

## License

MIT
