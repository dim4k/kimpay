/**
 * Searching the emojis of the pickers by their names and keywords (CLDR, see
 * scripts/emoji-keywords.mjs), in the user's language and in English.
 */

type Keywords = Record<string, string>;

const loaders = import.meta.glob<Keywords>('./keywords/*.json', { import: 'default' });
const loaded = new Map<string, Promise<Keywords>>();

/** The keywords of one language (loaded once, on demand). */
export function loadKeywords(lang: string): Promise<Keywords> {
    const loader = loaders[`./keywords/${lang}.json`] ?? loaders['./keywords/en.json']!;
    let keywords = loaded.get(lang);
    if (!keywords) {
        keywords = loader().catch(() => ({}));
        loaded.set(lang, keywords);
    }
    return keywords;
}

/** Same emoji with or without the "emoji presentation" selector. */
const bare = (emoji: string) => emoji.replace(/️/g, '');

/** Lowercase, without accents, for a forgiving search. */
export function normalize(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Typed or pasted emoji(s), offered as they are. */
export function isEmoji(text: string): boolean {
    return /\p{Extended_Pictographic}/u.test(text);
}

/**
 * The emojis whose words start with every word of the query ("bur" finds the
 * burger), those whose name starts with it first. `extra` adds words to some
 * emojis (e.g. the name of their category).
 */
export function searchEmojis(
    query: string,
    emojis: readonly string[],
    keywords: Keywords[],
    extra: Record<string, string> = {},
): string[] {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const results: { emoji: string; first: boolean }[] = [];
    for (const emoji of new Set(emojis)) {
        const names = keywords.map((k) => normalize(k[bare(emoji)] ?? ''));
        const haystack = ` ${[...names, normalize(extra[emoji] ?? '')].join(' ')}`.replace(/[^\p{L}\p{N}]+/gu, ' ');
        if (words.every((word) => haystack.includes(` ${word}`))) {
            results.push({ emoji, first: names.some((name) => name.startsWith(words[0]!)) });
        }
    }
    // Stable: the picker's order within each rank.
    return [...results.filter((r) => r.first), ...results.filter((r) => !r.first)].map((r) => r.emoji);
}
