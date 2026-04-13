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

    // Add all pages from this sub-wiki
    for (const page of struct.pages) {
      if (page.id === overviewPageId) {
        // Promote: rename page ID to match subsystem section ID so tree view makes section header clickable
        allPages.push({ ...page, id: subSectionId, parentId: subSectionId });
      } else {
        allPages.push({ ...page, parentId: subSectionId });
      }
      totalPages++;
    }

    // Build inner subsections (skip the overview section — its page is now the section header)
    const innerSubsections = [];
    for (let i = 0; i < struct.sections.length; i++) {
      if (i === overviewIdx) continue; // skip — promoted to section header
      const section = struct.sections[i];
      const innerId = `sect-${wikiId}-${section.id}`;
      // Remap any references to the old overview page ID within section pages
      const remappedPages = section.pages.map(pid => pid === overviewPageId ? subSectionId : pid);
      innerSubsections.push({
        id: innerId,
        title: section.title,
        pages: remappedPages,
      });
      allSections.push({
        id: innerId,
        title: section.title,
        pages: remappedPages,
      });
    }

    // Create subsystem-level subsection (pages includes the overview page ID if promoted)
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
