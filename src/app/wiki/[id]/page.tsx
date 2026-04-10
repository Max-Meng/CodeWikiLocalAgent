'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import WikiTreeView from '@/components/WikiTreeView';
import Markdown from '@/components/Markdown';
import ThemeToggle from '@/components/theme-toggle';
import type { WikiData } from '@/types/wiki';

function generateMarkdownExport(wikiData: WikiData): string {
  const lines: string[] = [];
  lines.push(`# ${wikiData.structure.title}\n`);
  lines.push(`> ${wikiData.structure.description}\n`);
  lines.push(`Generated: ${wikiData.metadata.generated_at}\n`);
  lines.push(`Source: ${wikiData.metadata.source}\n`);
  lines.push('---\n');
  lines.push('## Table of Contents\n');
  wikiData.structure.pages.forEach(page => {
    lines.push(`- [${page.title}](#${page.id})`);
  });
  lines.push('\n---\n');
  wikiData.structure.pages.forEach(page => {
    lines.push(`<a id="${page.id}"></a>\n`);
    lines.push(page.content || `# ${page.title}\n\n*No content generated.*`);
    lines.push('\n---\n');
  });
  return lines.join('\n');
}

function generateJsonExport(wikiData: WikiData): string {
  return JSON.stringify({
    metadata: wikiData.metadata,
    pages: wikiData.structure.pages.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      filePaths: p.filePaths,
      importance: p.importance,
      relatedPages: p.relatedPages,
    })),
  }, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WikiPage() {
  const params = useParams<{ id: string }>();
  const wikiId = params.id;
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function loadWiki() {
      try {
        // Try /wikis/{id}.json first (multi-wiki mode), fall back to /wiki-data.json (legacy single-wiki)
        let res = await fetch(`/wikis/${wikiId}.json`);
        if (!res.ok) {
          res = await fetch('/wiki-data.json');
        }
        if (!res.ok) throw new Error(`Failed to load wiki data: ${res.status}`);
        const data: WikiData = await res.json();
        setWikiData(data);
        if (data.structure.pages.length > 0) {
          setCurrentPageId(data.structure.pages[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wiki data');
      } finally {
        setLoading(false);
      }
    }
    loadWiki();
  }, [wikiId]);

  const handlePageSelect = useCallback((pageId: string) => {
    setCurrentPageId(pageId);
    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const currentPage = wikiData?.structure.pages.find(p => p.id === currentPageId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse delay-75"></div>
            <div className="w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse delay-150"></div>
          </div>
          <p className="text-[var(--muted)] text-sm">Loading wiki...</p>
        </div>
      </div>
    );
  }

  if (error || !wikiData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center max-w-md">
          <div className="text-[var(--highlight)] text-4xl mb-4">⚠</div>
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Wiki Not Found</h1>
          <p className="text-[var(--muted)] text-sm mb-4">
            {error || 'No wiki-data.json found. Generate a wiki first using the Copilot Agent.'}
          </p>
          <div className="text-left bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 text-sm">
            <p className="font-medium text-[var(--foreground)] mb-2">How to generate a wiki:</p>
            <ol className="list-decimal pl-4 space-y-1 text-[var(--muted)]">
              <li>Open VS Code with the target project</li>
              <li>Open Copilot Chat and select the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@codewiki</code> agent</li>
              <li>Run the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">generate-wiki</code> prompt</li>
              <li>Copy <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">output/wiki-data.json</code> to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">public/wiki-data.json</code></li>
              <li>Run <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm run dev</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--card-bg)] border-b border-[var(--border-color)] shadow-custom">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-md hover:bg-[var(--background)] transition-colors" title="Back to all projects">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-[var(--background)] transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-[var(--foreground)]">{wikiData.structure.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative group">
              <button className="p-2 rounded-md border border-[var(--border-color)] hover:bg-[var(--accent-primary)]/10 transition-colors text-sm text-[var(--foreground)]">
                Export
              </button>
              <div className="absolute right-0 mt-1 w-40 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-custom hidden group-hover:block">
                <button
                  className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                  onClick={() => {
                    const md = generateMarkdownExport(wikiData);
                    downloadFile(md, `${wikiData.structure.title.replace(/\s+/g, '-').toLowerCase()}.md`, 'text/markdown');
                  }}
                >
                  Markdown (.md)
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                  onClick={() => {
                    const json = generateJsonExport(wikiData);
                    downloadFile(json, `${wikiData.structure.title.replace(/\s+/g, '-').toLowerCase()}.json`, 'application/json');
                  }}
                >
                  JSON (.json)
                </button>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
        {/* Description bar */}
        <div className="px-4 pb-2">
          <p className="text-xs text-[var(--muted)]">{wikiData.structure.description}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {wikiData.metadata.page_count} pages &middot; Source: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{wikiData.metadata.source}</code> &middot; Generated: {new Date(wikiData.metadata.generated_at).toLocaleDateString()}
          </p>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-72 min-h-[calc(100vh-80px)] bg-[var(--card-bg)] border-r border-[var(--border-color)] p-4 overflow-y-auto sticky top-[80px]">
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Pages</h2>
            </div>
            <WikiTreeView
              wikiStructure={wikiData.structure}
              currentPageId={currentPageId}
              onPageSelect={handlePageSelect}
            />
          </aside>
        )}

        {/* Main content */}
        <main className={`flex-1 ${sidebarOpen ? 'max-w-[calc(100vw-18rem)]' : 'max-w-full'}`}>
          {currentPage ? (
            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* Page navigation breadcrumb */}
              {currentPage.filePaths.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {currentPage.filePaths.slice(0, 5).map((fp, i) => (
                    <span key={i} className="text-xs bg-[var(--background)] text-[var(--muted)] px-2 py-1 rounded border border-[var(--border-color)]">
                      {fp}
                    </span>
                  ))}
                  {currentPage.filePaths.length > 5 && (
                    <span className="text-xs text-[var(--muted)] px-2 py-1">
                      +{currentPage.filePaths.length - 5} more
                    </span>
                  )}
                </div>
              )}

              {/* Page content */}
              <article className="card-japanese p-6">
                <Markdown content={currentPage.content} />
              </article>

              {/* Related pages */}
              {currentPage.relatedPages.length > 0 && (
                <div className="mt-6 p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Related Pages</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentPage.relatedPages.map(rpId => {
                      const rp = wikiData.structure.pages.find(p => p.id === rpId);
                      if (!rp) return null;
                      return (
                        <button
                          key={rpId}
                          onClick={() => handlePageSelect(rpId)}
                          className="text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] px-3 py-1 rounded-full hover:bg-[var(--accent-primary)]/20 transition-colors"
                        >
                          {rp.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[60vh]">
              <p className="text-[var(--muted)] text-sm">Select a page from the sidebar</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
