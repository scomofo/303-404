import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadComponent } from '../test/harness.mjs';

export function studioBankSource() {
  const { inst, dispose } = loadComponent('Behringer Setup Guide.dc.html');
  try {
    const banks = { bass: inst.SONG_CARDS, drums: inst.DRUM_CARDS, voices: inst.DRUM_VOICES };
    return '// Generated from the Behringer course by npm run studio:banks. Preserve source metadata.\n' +
      'globalThis.DCStudioBanks = ' + JSON.stringify(banks, null, 2) + ';\n';
  } finally { dispose(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  writeFileSync(new URL('../studio/banks.js', import.meta.url), studioBankSource());
  console.log('Updated studio/banks.js from the Song Bank and Drum Bank.');
}
