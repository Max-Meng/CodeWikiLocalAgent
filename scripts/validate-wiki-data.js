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

function validate(data) {
  const errors = [];

  if (!data.metadata) errors.push('Missing "metadata" field');
  if (!data.structure) errors.push('Missing "structure" field');

  if (data.structure) {
    const s = data.structure;
    if (!s.id) errors.push('Missing structure.id');
    if (!s.title) errors.push('Missing structure.title');
    if (!Array.isArray(s.pages)) errors.push('structure.pages must be an array');
    if (!Array.isArray(s.sections)) errors.push('structure.sections must be an array');
    if (!Array.isArray(s.rootSections)) errors.push('structure.rootSections must be an array');

    if (Array.isArray(s.pages)) {
      s.pages.forEach((page, i) => {
        if (!page.id) errors.push(`Page ${i}: missing id`);
        if (!page.title) errors.push(`Page ${i}: missing title`);
        if (typeof page.content !== 'string') errors.push(`Page ${i} (${page.id}): content must be a string`);
        if (!page.content || page.content.trim().length === 0) {
          errors.push(`Page ${i} (${page.id}): content is empty`);
        }
        if (!Array.isArray(page.filePaths)) errors.push(`Page ${i} (${page.id}): filePaths must be an array`);
        if (!['high', 'medium', 'low'].includes(page.importance)) {
          errors.push(`Page ${i} (${page.id}): importance must be high|medium|low`);
        }
      });
    }

    if (Array.isArray(s.sections)) {
      s.sections.forEach((section, i) => {
        if (!section.id) errors.push(`Section ${i}: missing id`);
        if (!section.title) errors.push(`Section ${i}: missing title`);
        if (!Array.isArray(section.pages)) errors.push(`Section ${i} (${section.id}): pages must be an array`);
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
  const data = JSON.parse(raw);
  const errors = validate(data);

  if (errors.length > 0) {
    console.error('Validation errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`Valid wiki-data.json: ${data.structure.pages.length} pages, ${data.structure.sections.length} sections`);

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
