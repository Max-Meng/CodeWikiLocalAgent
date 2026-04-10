'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import type { WikiRegistry, WikiProject } from '@/types/wiki';

export default function HomePage() {
  const [registry, setRegistry] = useState<WikiRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    async function loadRegistry() {
      try {
        const res = await fetch('/wiki-registry.json');
        if (!res.ok) {
          setRegistry({ projects: [] });
          return;
        }
        const data: WikiRegistry = await res.json();
        setRegistry(data);
      } catch {
        setRegistry({ projects: [] });
      } finally {
        setLoading(false);
      }
    }
    loadRegistry();
  }, []);

  const filtered = useMemo(() => {
    if (!registry) return [];
    if (!search.trim()) return registry.projects;
    const q = search.toLowerCase();
    return registry.projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.owner.toLowerCase().includes(q) ||
      p.repository.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [registry, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse delay-75"></div>
            <div className="w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse delay-150"></div>
          </div>
          <p className="text-[var(--muted)] text-sm">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--accent-primary)] text-white shadow-custom">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div>
              <h1 className="text-xl font-bold">CodeWiki</h1>
              <p className="text-sm opacity-80">AI-powered documentation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-white/90 hover:text-white transition-colors">
              Wiki Projects
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[var(--card-bg)] border-b border-[var(--border-color)] py-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Existing Projects</h2>
          </div>
          <p className="text-[var(--accent-primary)] text-sm">Browse Existing Projects</p>
        </div>
      </section>

      {/* Search & View Toggle */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search projects by name, owner, or repository..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-japanese w-full"
            />
          </div>
          <div className="flex border border-[var(--border-color)] rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--background)]'}`}
              aria-label="Grid view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--background)]'}`}
              aria-label="List view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-[var(--muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {search ? 'No matching projects' : 'No Wiki Projects Yet'}
            </h3>
            <p className="text-[var(--muted)] text-sm max-w-md mx-auto mb-6">
              {search
                ? 'Try a different search term.'
                : 'Generate a wiki using the @codewiki agent in VS Code, then publish it here.'}
            </p>
            {!search && (
              <div className="text-left max-w-md mx-auto bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 text-sm">
                <p className="font-medium text-[var(--foreground)] mb-2">Quick start:</p>
                <ol className="list-decimal pl-4 space-y-1 text-[var(--muted)]">
                  <li>Open VS Code with the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@codewiki</code> agent</li>
                  <li>Run <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/generate-wiki</code> on your project</li>
                  <li>Publish: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">node scripts/validate-wiki-data.js path/wiki-data.json --fix --name my-project</code></li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(project => (
              <ProjectListItem key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: WikiProject }) {
  return (
    <Link href={`/wiki/${project.id}`} className="block">
      <div className="card-japanese p-5 hover:shadow-lg hover:border-[var(--accent-primary)] transition-all cursor-pointer h-full">
        <h3 className="text-base font-bold text-[var(--link-color)] mb-2 hover:underline">
          {project.owner}/{project.name}
        </h3>
        {project.description && (
          <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{project.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full border border-[var(--border-color)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/5 font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>{project.pageCount} pages</span>
          <span>Generated: {new Date(project.generatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
}

function ProjectListItem({ project }: { project: WikiProject }) {
  return (
    <Link href={`/wiki/${project.id}`} className="block">
      <div className="card-japanese p-4 hover:shadow-lg hover:border-[var(--accent-primary)] transition-all cursor-pointer flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--link-color)] hover:underline truncate">
            {project.owner}/{project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-[var(--muted)] truncate mt-0.5">{project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 shrink-0">
          {project.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full border border-[var(--border-color)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/5 font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="text-xs text-[var(--muted)] shrink-0 text-right w-28">
          <div>{project.pageCount} pages</div>
          <div>{new Date(project.generatedAt).toLocaleDateString()}</div>
        </div>
      </div>
    </Link>
  );
}
