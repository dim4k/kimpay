/** Lowercase, without accents nor punctuation: "Pierre-M." gives "pierre m". */
function simplify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

/**
 * Whether two names may be the same person: the same first word, whatever
 * the case and accents ("Pierre", "pierre M.", "Pièrre").
 */
export function sameFirstName(a: string, b: string): boolean {
    const first = simplify(a).split(' ')[0] ?? '';
    return first.length >= 2 && first === (simplify(b).split(' ')[0] ?? '');
}

/** The first of `people` who may be `name` (see sameFirstName), or null. */
export function findSimilarName<T extends { name: string }>(name: string, people: readonly T[]): T | null {
    return people.find((p) => sameFirstName(name, p.name)) ?? null;
}
