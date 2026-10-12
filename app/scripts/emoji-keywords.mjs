// Generates src/lib/emoji/keywords/<lang>.json: the words to search the emojis
// offered by the app, in each language (CLDR names and keywords, from
// emojibase-data). Run after changing the emojis of src/lib/constants.ts:
//
//   npm run emoji:keywords

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LANGS = ['en', 'fr', 'de', 'es', 'pt'];
const OUT = new URL('../src/lib/emoji/keywords/', import.meta.url);

/** Same emoji with or without the "emoji presentation" selector. */
const bare = (emoji) => emoji.replace(/️/g, '');

// The emojis of the pickers: every string of the `emojis: [...]` arrays.
const constants = readFileSync(new URL('../src/lib/constants.ts', import.meta.url), 'utf8');
const offered = new Set(
    [...constants.matchAll(/emojis:\s*\[([^\]]*)\]/g)].flatMap(([, list]) =>
        [...list.matchAll(/'([^']+)'/g)].map(([, emoji]) => bare(emoji)),
    ),
);

mkdirSync(OUT, { recursive: true });
for (const lang of LANGS) {
    const data = require(`emojibase-data/${lang}/compact.json`);
    const keywords = {};
    for (const entry of data) {
        for (const variant of [entry, ...(entry.skins ?? [])]) {
            const emoji = bare(variant.unicode);
            if (offered.has(emoji) && !keywords[emoji]) {
                keywords[emoji] = [...new Set([entry.label, ...(entry.tags ?? [])])].join(' ').toLowerCase();
            }
        }
    }
    const missing = [...offered].filter((emoji) => !keywords[emoji]);
    if (missing.length) console.warn(`${lang}: no keywords for ${missing.join(' ')}`);
    writeFileSync(new URL(`${lang}.json`, OUT), JSON.stringify(keywords, null, 0) + '\n');
    console.log(`${lang}: ${Object.keys(keywords).length} emojis`);
}
