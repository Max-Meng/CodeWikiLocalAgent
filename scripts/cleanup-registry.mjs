#!/usr/bin/env node
/**
 * Removes sub-wiki entries from wiki-registry.json, keeping only the consolidated DsMainDev entry.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const registryPath = join(import.meta.dirname, '..', 'public', 'wiki-registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

const SUB_WIKI_IDS = new Set([
  'sqlos-base', 'sqldk', 'storeng', 'query-processor', 'metadata',
  'frontend', 'hekaton', 'hadr', 'dw-engine', 'dw-query-processor',
  'tds-protocol', 'replication', 'xdb-common', 'xdb-services',
  'extensibility', 'common-libraries',
]);

const before = registry.projects.length;
registry.projects = registry.projects.filter(p => !SUB_WIKI_IDS.has(p.id));
const after = registry.projects.length;

writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log(`Removed ${before - after} sub-wiki entries. Registry now has ${after} project(s).`);
