import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * GET /api/wiki/projects — List processed projects.
 * DELETE /api/wiki/projects — Delete a cached wiki.
 *
 * Sources (tried in order):
 * 1. Backend FastAPI (cloud mode, if FASTAPI_PORT set)
 * 2. Local wiki-registry.json (CodeWiki Local Agent static wikis)
 * 3. ~/.adalflow/wikicache/ (OrcasCodeWiki-style local caches)
 */

const BACKEND_PORT = process.env.FASTAPI_PORT;

interface ProcessedProject {
  id: string;
  owner: string;
  repo: string;
  name: string;
  repo_type: string;
  submittedAt: number;
  language: string;
  comprehensive: boolean;
  branch?: string;
  // Local agent fields
  localWiki?: boolean;
  wikiId?: string;
}

// Cache filename pattern: deepwiki_cache_{type}_{owner}_{repo}_{lang}_{mode}[_{branch}].json
const CACHE_PATTERN = /^deepwiki_cache_(\w+)_(.+?)_([^_]+)_([a-z]+(?:-[a-z]+)*)_(comprehensive|concise)(?:_(.+))?\.json$/;

function getCacheDir(): string {
  return path.join(os.homedir(), '.adalflow', 'wikicache');
}

function getRegistryProjects(): ProcessedProject[] {
  // Read from public/wiki-registry.json (CodeWiki Local Agent approach)
  const registryPath = path.join(process.cwd(), 'public', 'wiki-registry.json');
  if (!fs.existsSync(registryPath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const projects: ProcessedProject[] = (data.projects || []).map((p: Record<string, unknown>) => ({
      id: p.id || p.name,
      owner: (p.owner as string) || '',
      repo: (p.repository as string) || (p.name as string) || '',
      name: (p.name as string) || (p.title as string) || '',
      repo_type: (p.repoType as string) || 'local',
      submittedAt: p.generatedAt ? new Date(p.generatedAt as string).getTime() : 0,
      language: (p.language as string) || 'en',
      comprehensive: true,
      localWiki: true,
      wikiId: (p.id as string) || (p.name as string),
    }));
    return projects;
  } catch {
    return [];
  }
}

export async function GET() {
  // Try backend API first (handles blob storage in cloud mode)
  if (BACKEND_PORT) {
    try {
      const backendUrl = `http://127.0.0.1:${BACKEND_PORT}/api/processed_projects`;
      const resp = await fetch(backendUrl, { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        // Merge with local registry projects
        const registryProjects = getRegistryProjects();
        const merged = [...(data as ProcessedProject[]), ...registryProjects];
        return NextResponse.json(merged);
      }
    } catch {
      console.warn('[projects] Backend unavailable, falling back to local sources');
    }
  }

  // Collect from local sources
  const allProjects: ProcessedProject[] = [];

  // Source 1: wiki-registry.json (CodeWiki Local Agent)
  allProjects.push(...getRegistryProjects());

  // Source 2: ~/.adalflow/wikicache/ (OrcasCodeWiki-style)
  const cacheDir = getCacheDir();

  if (!fs.existsSync(cacheDir)) {
    // Only registry projects (or empty)
    allProjects.sort((a, b) => b.submittedAt - a.submittedAt);
    return NextResponse.json(allProjects);
  }

  try {
    const files = fs.readdirSync(cacheDir).filter(f => f.startsWith('deepwiki_cache_') && f.endsWith('.json'));
    const projects: ProcessedProject[] = [];

    for (const filename of files) {
      const match = filename.match(CACHE_PATTERN);
      if (!match) continue;

      const [, repoType, owner, repo, language, mode, branch] = match;

      // Get file modification time for sorting
      let mtime = 0;
      try {
        const stat = fs.statSync(path.join(cacheDir, filename));
        mtime = stat.mtimeMs;
      } catch { /* ignore */ }

      projects.push({
        id: filename.replace('.json', ''),
        owner,
        repo,
        name: `${owner}/${repo}`,
        repo_type: repoType,
        submittedAt: mtime,
        language,
        comprehensive: mode === 'comprehensive',
        branch: branch || undefined,
      });
    }

    // Merge adalflow projects with registry projects
    allProjects.push(...projects);
    allProjects.sort((a, b) => b.submittedAt - a.submittedAt);

    return NextResponse.json(allProjects);
  } catch (err) {
    console.error('Error scanning wiki cache directory:', err);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { owner, repo, repo_type, language, comprehensive, branch } = body;

    if (!owner || !repo || !repo_type || !language || comprehensive === undefined) {
      return NextResponse.json(
        { error: 'owner, repo, repo_type, language, and comprehensive are required' },
        { status: 400 },
      );
    }

    const cacheDir = getCacheDir();
    const mode = comprehensive ? 'comprehensive' : 'concise';
    const branchSuffix = branch || 'default';
    const filename = `deepwiki_cache_${repo_type}_${owner}_${repo}_${language}_${mode}_${branchSuffix}.json`;
    const filePath = path.join(cacheDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ message: 'Project deleted successfully' });
    }

    // Try legacy filename (no branch)
    const legacyFilename = `deepwiki_cache_${repo_type}_${owner}_${repo}_${language}_${mode}.json`;
    const legacyPath = path.join(cacheDir, legacyFilename);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
      return NextResponse.json({ message: 'Project deleted successfully' });
    }

    return NextResponse.json({ error: 'Cache file not found' }, { status: 404 });
  } catch (err) {
    console.error('Error deleting wiki cache:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to delete: ${message}` }, { status: 500 });
  }
}