/**
 * Validates and optionally transforms wiki-data.json for the frontend.
 * 
 * Usage:
 *   node scripts/validate-wiki-data.js <path-to-wiki-data.json>
 * 
 * If no path is given, reads from ./output/wiki-data.json
 */

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '..', 'output', 'wiki-data.json');
const outputPath = path.join(__dirname, '..', 'public', 'wiki-data.json');
const autoFix = process.argv.includes('--fix');

/**
 * Attempt to normalize common LLM drift patterns into the correct WikiData schema.
 * Returns { data, fixes[] } where fixes describes what was changed.
 */
function normalize(data) {
  const fixes = [];

  // Fix: pages at root instead of inside structure
  if (Array.isArray(data.pages) && data.structure && !Array.isArray(data.structure.pages)) {
    data.structure.pages = data.pages;
    delete data.pages;
    fixes.push('Moved root-level "pages" array into structure.pages');
  }

  // Fix: projectName / description at root instead of in structure (must run BEFORE metadata synthesis)
  if (!data.structure) data.structure = {};
  if (data.projectName && !data.structure.title) {
    data.structure.title = data.projectName;
    delete data.projectName;
    fixes.push('Moved root "projectName" to structure.title');
  }
  if (data.description && !data.structure.description) {
    data.structure.description = data.description;
    delete data.description;
    fixes.push('Moved root "description" to structure.description');
  }

  // Fix: missing metadata — synthesize from legacy fields
  if (!data.metadata) {
    data.metadata = {
      source: data.source || data.projectPath || '',
      generated_at: data.generatedAt || data.generated_at || new Date().toISOString(),
      page_count: (data.structure && Array.isArray(data.structure.pages)) ? data.structure.pages.length
                : Array.isArray(data.pages) ? data.pages.length : 0,
      generator: 'codewiki-local-agent',
    };
    // Clean up legacy root keys
    ['source', 'projectPath', 'generatedAt', 'generated_at'].forEach(k => delete data[k]);
    fixes.push('Synthesized "metadata" from legacy root-level fields');
  }

  // Fix: missing structure.id
  if (!data.structure.id) {
    const slug = (data.structure.title || 'wiki').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    data.structure.id = slug + '-wiki';
    fixes.push(`Generated structure.id: "${data.structure.id}"`);
  }

  // Fix: sections without id field
  if (Array.isArray(data.structure.sections)) {
    data.structure.sections.forEach((section, i) => {
      if (!section.id) {
        section.id = 'section-' + (section.title || `unnamed-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
        fixes.push(`Generated id for section "${section.title}": "${section.id}"`);
      }
    });
  }

  // Fix: missing rootSections — derive from sections
  if (!Array.isArray(data.structure.rootSections) && Array.isArray(data.structure.sections)) {
    data.structure.rootSections = data.structure.sections.map(s => s.id);
    fixes.push('Generated rootSections from sections array');
  }

  // Fix: pages missing relatedPages field
  if (Array.isArray(data.structure.pages)) {
    data.structure.pages.forEach(page => {
      if (!Array.isArray(page.relatedPages)) {
        page.relatedPages = [];
        fixes.push(`Added empty relatedPages to page "${page.id}"`);
      }
      if (!Array.isArray(page.filePaths)) {
        page.filePaths = [];
      }
    });
  }

  // Fix: page_count mismatch
  if (data.metadata && data.structure && Array.isArray(data.structure.pages)) {
    if (data.metadata.page_count !== data.structure.pages.length) {
      data.metadata.page_count = data.structure.pages.length;
      fixes.push(`Corrected metadata.page_count to ${data.metadata.page_count}`);
    }
  }

  return { data, fixes };
}

function validate(data) {
  const errors = [];

  if (!data.metadata) errors.push('Missing "metadata" field');
  else {
    if (typeof data.metadata.source !== 'string') errors.push('metadata.source must be a string');
    if (typeof data.metadata.generated_at !== 'string') errors.push('metadata.generated_at must be a string');
    if (typeof data.metadata.page_count !== 'number') errors.push('metadata.page_count must be a number');
    if (typeof data.metadata.generator !== 'string') errors.push('metadata.generator must be a string');
  }

  if (!data.structure) errors.push('Missing "structure" field');

  // Reject legacy root-level keys
  if (data.projectName) errors.push('Root-level "projectName" found — use structure.title instead. Run with --fix to auto-repair.');
  if (data.pages) errors.push('Root-level "pages" array found — pages must be inside structure.pages. Run with --fix to auto-repair.');
  if (data.generatedAt) errors.push('Root-level "generatedAt" found — use metadata.generated_at instead. Run with --fix to auto-repair.');

  if (data.structure) {
    const s = data.structure;
    if (!s.id) errors.push('Missing structure.id');
    if (!s.title) errors.push('Missing structure.title');
    if (!Array.isArray(s.pages)) errors.push('structure.pages must be an array');
    if (!Array.isArray(s.sections)) errors.push('structure.sections must be an array');
    if (!Array.isArray(s.rootSections)) errors.push('structure.rootSections must be an array');

    if (Array.isArray(s.pages)) {
      s.pages.forEach((page, i) => {
        const label = page.id || `index ${i}`;
        if (!page.id) errors.push(`Page ${label}: missing id`);
        if (!page.title) errors.push(`Page ${label}: missing title`);
        if (typeof page.content !== 'string') errors.push(`Page ${label}: content must be a string`);
        if (!page.content || page.content.trim().length === 0) {
          errors.push(`Page ${label}: content is empty`);
        }
        if (!Array.isArray(page.filePaths)) errors.push(`Page ${label}: filePaths must be an array`);
        if (!['high', 'medium', 'low'].includes(page.importance)) {
          errors.push(`Page ${label}: importance must be high|medium|low, got "${page.importance}"`);
        }
        if (!Array.isArray(page.relatedPages)) errors.push(`Page ${label}: relatedPages must be an array`);
      });
    }

    if (Array.isArray(s.sections)) {
      s.sections.forEach((section, i) => {
        const label = section.id || `index ${i}`;
        if (!section.id) errors.push(`Section ${label}: missing id`);
        if (!section.title) errors.push(`Section ${label}: missing title`);
        if (!Array.isArray(section.pages)) errors.push(`Section ${label}: pages must be an array`);
      });
    }
  }

  return errors;
}

// Main
try {
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  let data = JSON.parse(raw);

  // Auto-fix pass
  if (autoFix) {
    const result = normalize(data);
    data = result.data;
    if (result.fixes.length > 0) {
      console.log(`Auto-fixed ${result.fixes.length} issue(s):`);
      result.fixes.forEach(f => console.log(`  ✓ ${f}`));
      // Write the fixed version back to the input path
      fs.writeFileSync(inputPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Updated ${inputPath}`);
    }
  }

  const errors = validate(data);

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ✗ ${e}`));
    if (!autoFix) {
      console.error('\nTip: Run with --fix to attempt automatic repair.');
    }
    process.exit(1);
  }

  console.log(`✓ Valid wiki-data.json: ${data.structure.pages.length} pages, ${data.structure.sections.length} sections`);

  // Copy to public/ for the Next.js frontend
  const publicDir = path.dirname(outputPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.copyFileSync(inputPath, outputPath);
  console.log(`Copied to ${outputPath}`);

} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
