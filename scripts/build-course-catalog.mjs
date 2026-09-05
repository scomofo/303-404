// Compile the learner-facing step labels from the courses themselves. The same
// dependency-free loader used by the tests runs only at maintenance time; the
// home page needs neither the course engines nor React to show saved progress.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { GUIDES, loadComponent } from '../test/harness.mjs';

export function buildCatalog() {
  return GUIDES.map(({ file }) => {
    const { inst, dispose } = loadComponent(file);
    try {
      return {
        id: inst.persistenceKey.split('/')[1],
        file,
        storageKey: inst.persistenceKey,
        version: inst.persistenceVersion,
        steps: inst.STEPS.map(step => ({
          id: step.id, title: step.title, week: step.weekTag,
          items: step.items?.length || 0,
        })),
      };
    } finally {
      dispose();
    }
  });
}

export function catalogSource() {
  return '// Generated from the six courses by npm run catalog. Do not edit by hand.\n' +
    'globalThis.DCCourseCatalog = ' + JSON.stringify(buildCatalog(), null, 2) + ';\n';
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const destination = fileURLToPath(new URL('../course-catalog.js', import.meta.url));
  writeFileSync(destination, catalogSource());
  console.log('Updated course-catalog.js from all six guides.');
}
