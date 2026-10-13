/** Gradients of the avatars without a photo. */
export const AVATAR_GRADIENTS = [
    'from-pink-500 to-rose-500',
    'from-purple-500 to-indigo-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-yellow-400 to-orange-500',
    'from-red-500 to-orange-500',
    'from-indigo-400 to-purple-500',
    'from-teal-400 to-blue-500',
] as const;

/** What an avatar without a photo shows: two letters on a gradient. */
export interface AvatarLook {
    initials: string;
    /** Index in AVATAR_GRADIENTS */
    color: number;
}

/** The gradient a name gets on its own (same name, same color). */
export function nameColor(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % AVATAR_GRADIENTS.length;
}

/** Letters and digits of a name ("Jean-Paul" gives J, e, a, n, P...), else its characters. */
function letters(name: string): string[] {
    const chars = Array.from(name.trim());
    const kept = chars.filter((c) => /[\p{L}\p{N}]/u.test(c));
    return kept.length > 0 ? kept : chars;
}

/** The first two letters of a name ("?" without one). */
export function nameInitials(name: string): string {
    return letters(name).slice(0, 2).join('').toLocaleUpperCase() || '?';
}

/**
 * The avatars of a group, so that no two members look alike: Manon, Madleen
 * and Mathieu are MN, MD and MT rather than MA three times, and each member
 * gets a color the others do not have, while there are some left.
 *
 * `people` in the order they joined: earlier members keep their look when
 * someone is added. A name alone in the group keeps its first two letters,
 * and its color when free.
 */
export function groupAvatarLooks(people: readonly { id: string; name: string }[]): Map<string, AvatarLook> {
    const initials = people.map((p) => nameInitials(p.name));
    const count = new Map<string, number>();
    initials.forEach((i) => count.set(i, (count.get(i) ?? 0) + 1));

    // Shared initials: the first letter and the next one that tells them
    // apart (the second is the one they share), else a number.
    const taken = new Set(initials.filter((i) => count.get(i) === 1));
    people.forEach((p, k) => {
        if (count.get(initials[k]!) === 1) return;
        const chars = letters(p.name);
        const first = (chars[0] ?? '?').toLocaleUpperCase();
        const candidates = chars.slice(2).map((c) => first + c.toLocaleUpperCase());
        for (let n = 1; n <= 99; n++) candidates.push(`${first}${n}`);
        const free = candidates.find((c) => !taken.has(c))!;
        taken.add(free);
        initials[k] = free;
    });

    // Colors: the name's own if no one has it yet, else the next one used
    // the least.
    const used: number[] = AVATAR_GRADIENTS.map(() => 0);
    const looks = new Map<string, AvatarLook>();
    people.forEach((p, k) => {
        const start = nameColor(p.name);
        let color = start;
        for (let step = 1; step < used.length; step++) {
            const next = (start + step) % used.length;
            if (used[next]! < used[color]!) color = next;
        }
        used[color]!++;
        looks.set(p.id, { initials: initials[k]!, color });
    });
    return looks;
}
