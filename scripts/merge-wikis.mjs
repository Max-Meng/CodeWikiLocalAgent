#!/usr/bin/env node
/**
 * Merges multiple sub-wiki JSON files into a single consolidated wiki
 * with nested sections (subsections per subsystem).
 *
 * Usage:
 *   node scripts/merge-wikis.mjs <config.json> [--publish]
 *
 * Config schema:
 *   id          - Wiki project ID (used for registry and output filename)
 *   title       - Display title for the consolidated wiki
 *   description - Short description
 *   source      - Source repository path (metadata only)
 *   overview    - { title, content?, contentFile? } — optional top-level overview page
 *   groups      - [{ title, wikis: [sub-wiki-id, ...] }, ...]
 *
 * Sub-wiki JSON files are loaded from public/wikis/<id>.json
 * Output is written to public/wiki-data.json (and optionally published via --publish)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { execSync } from 'child_process';

// --- CLI args ---
const args = process.argv.slice(2);
const configArg = args.find(a => !a.startsWith('--'));
const doPublish = args.includes('--publish');

if (!configArg) {
  console.error('Usage: node scripts/merge-wikis.mjs <config.json> [--publish]');
  console.error('  --publish  Also run validate-wiki-data.js to publish to registry');
  process.exit(1);
}

const SCRIPT_DIR = import.meta.dirname;
const PROJECT_ROOT = join(SCRIPT_DIR, '..');
const WIKIS_DIR = join(PROJECT_ROOT, 'public', 'wikis');

// --- Load config ---
const configPath = resolve(configArg);
const config = JSON.parse(readFileSync(configPath, 'utf-8'));
const { id: projectId, title, description, source, overview, groups } = config;

if (!projectId || !groups?.length) {
  console.error('Config must have "id" and "groups" (non-empty array)');
  process.exit(1);
}

// --- Load sub-wikis ---
const subWikis = new Map();
const allSubIds = groups.flatMap(g => g.wikis);

for (const id of allSubIds) {
  const filePath = join(WIKIS_DIR, `${id}.json`);
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    subWikis.set(id, data);
  } catch (e) {
    console.error(`⚠ Skipping ${id}: ${e.message}`);
  }
}

console.log(`Loaded ${subWikis.size}/${allSubIds.length} sub-wikis`);

// --- Build consolidated pages and sections ---
const allPages = [];
const rootSections = [];
const allSections = [];
let totalPages = 0;

// --- Overview page (optional) ---
if (overview) {
  const overviewId = `${projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-overview`;
  let overviewContent = overview.content || '';
  if (overview.contentFile) {
    const contentPath = resolve(dirname(configPath), overview.contentFile);
    if (existsSync(contentPath)) {
      overviewContent = readFileSync(contentPath, 'utf-8');
    } else {
      console.error(`⚠ Overview contentFile not found: ${contentPath}`);
    }
  }
  allPages.push({
    id: overviewId,
    title: overview.title || `${title} Overview`,
    content: overviewContent,
    filePaths: [],
    importance: 'high',
    relatedPages: [],
    parentId: 'sect-root-overview',
  });
  allSections.push({ id: 'sect-root-overview', title: 'Overview', pages: [overviewId] });
  rootSections.push('sect-root-overview');
  totalPages++;
}

// --- Configurable thresholds ---
const THIN_PAGE_THRESHOLD = 800;  // pages with content shorter than this are "thin"
const SECTION_MERGE_THRESHOLD = 3000;  // if total content of all pages in a section is under this, merge into one page

// --- Process each group ---
for (const group of groups) {
  const groupSectionId = `sect-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const groupSubsections = [];

  for (const wikiId of group.wikis) {
    const wiki = subWikis.get(wikiId);
    if (!wiki) continue;

    const struct = wiki.structure;
    const subSectionId = `sect-sub-${wikiId}`;

    // Detect overview section: first section with a single page and title containing "Overview"
    let overviewPageId = null;
    const overviewIdx = struct.sections.findIndex(
      s => s.pages.length === 1 && /overview/i.test(s.title)
    );
    if (overviewIdx !== -1) {
      overviewPageId = struct.sections[overviewIdx].pages[0];
    }

    // Promote overview page to subsystem section header
    if (overviewPageId) {
      const ovPage = struct.pages.find(p => p.id === overviewPageId);
      if (ovPage) {
        allPages.push({ ...ovPage, id: subSectionId, parentId: subSectionId });
        totalPages++;
      }
    }

    // Build inner subsections (skip the overview section)
    const innerSubsections = [];
    for (let i = 0; i < struct.sections.length; i++) {
      if (i === overviewIdx) continue;
      const section = struct.sections[i];
      const innerId = `sect-${wikiId}-${section.id}`;

      // Gather pages for this section (excluding the promoted overview page)
      const sectionPages = section.pages
        .filter(pid => pid !== overviewPageId)
        .map(pid => struct.pages.find(p => p.id === pid))
        .filter(Boolean);

      if (sectionPages.length === 0) {
        continue;
      }

      // Decide: merge thin pages into one combined page, or keep as individual pages
      const totalContent = sectionPages.reduce((sum, p) => sum + p.content.length, 0);
      const allThin = sectionPages.every(p => p.content.length < THIN_PAGE_THRESHOLD);
      const shouldMerge = sectionPages.length > 1 && (allThin || totalContent < SECTION_MERGE_THRESHOLD);

      if (shouldMerge) {
        // Merge all pages into a single combined page named after the section
        const combinedId = `combined-${wikiId}-${section.id}`;
        const combinedContent = sectionPages.map(p => {
          // Strip the <details> source-files block and leading # title if present,
          // then wrap each page as an ## heading inside the combined page
          let body = p.content;
          // Remove <details>...</details> block
          body = body.replace(/<details>[\s\S]*?<\/details>\s*/g, '');
          // Remove leading # Title line (we'll use ## instead)
          body = body.replace(/^#\s+[^\n]+\n+/, '');
          return `## ${p.title}\n\n${body.trim()}`;
        }).join('\n\n---\n\n');

        const combinedPage = {
          id: combinedId,
          title: section.title,
          content: combinedContent,
          filePaths: sectionPages.flatMap(p => p.filePaths || []),
          importance: sectionPages.some(p => p.importance === 'high') ? 'high' : 'medium',
          relatedPages: [],
          parentId: innerId,
        };
        allPages.push(combinedPage);
        totalPages++;

        // Section points to the single combined page (will be flattened by tree view)
        innerSubsections.push({ id: innerId, title: section.title, pages: [combinedId] });
        allSections.push({ id: innerId, title: section.title, pages: [combinedId] });

      } else {
        // Keep pages individually
        const pageIds = [];
        for (const page of sectionPages) {
          allPages.push({ ...page, parentId: innerId });
          totalPages++;
          pageIds.push(page.id);
        }
        innerSubsections.push({ id: innerId, title: section.title, pages: pageIds });
        allSections.push({ id: innerId, title: section.title, pages: pageIds });
      }
    }

    // Create subsystem-level subsection
    const subSection = {
      id: subSectionId,
      title: struct.title.replace(/ Wiki$/, ''),
      pages: overviewPageId ? [subSectionId] : [],
      subsections: innerSubsections.map(s => s.id),
    };
    allSections.push(subSection);
    groupSubsections.push(subSectionId);
  }

  // Create group-level section
  const groupSection = {
    id: groupSectionId,
    title: group.title,
    pages: [],
    subsections: groupSubsections,
  };
  allSections.push(groupSection);
  rootSections.push(groupSectionId);
}

// --- Build final consolidated wiki ---
const consolidated = {
  metadata: {
    source: source || '',
    generated_at: new Date().toISOString(),
    page_count: totalPages,
    generator: 'codewiki-merge-script',
  },
  structure: {
    id: `${projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-consolidated`,
    title: title || projectId,
    description: description || '',
    pages: allPages,
    sections: allSections,
    rootSections,
  },
};

const outPath = join(PROJECT_ROOT, 'public', 'wiki-data.json');
writeFileSync(outPath, JSON.stringify(consolidated, null, 2));

console.log(`✓ Consolidated wiki: ${totalPages} pages, ${rootSections.length} root sections, ${allSections.length} total sections`);
console.log(`  Written to: ${outPath}`);

// --- Optionally publish ---
if (doPublish) {
  const validateScript = join(SCRIPT_DIR, 'validate-wiki-data.js');
  console.log(`\nPublishing as "${projectId}"...`);
  try {
    execSync(`node "${validateScript}" "${outPath}" --fix --name ${projectId}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Publish failed:', e.message);
    process.exit(1);
  }
}
