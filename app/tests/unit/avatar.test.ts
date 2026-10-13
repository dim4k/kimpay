import { describe, it, expect } from 'vitest';
import { AVATAR_GRADIENTS, groupAvatarLooks, nameColor, nameInitials } from '../../src/lib/utils/avatar';

const people = (...names: string[]) => names.map((name, i) => ({ id: `p${i}`, name }));
const initialsOf = (looks: ReturnType<typeof groupAvatarLooks>) => [...looks.values()].map((l) => l.initials);

describe('avatars of a group', () => {
    it('takes the first two letters of a name alone', () => {
        expect(nameInitials('Antoine')).toBe('AN');
        expect(nameInitials('José')).toBe('JO');
        expect(nameInitials(' A. Bé')).toBe('AB');
        expect(nameInitials('')).toBe('?');
        expect(initialsOf(groupAvatarLooks(people('Antoine', 'Laetitia', 'Tony')))).toEqual(['AN', 'LA', 'TO']);
    });

    it('tells apart names starting alike', () => {
        const looks = groupAvatarLooks(people('Antoine', 'Manon', 'Madleen', 'Mathieu'));
        expect(initialsOf(looks)).toEqual(['AN', 'MN', 'MD', 'MT']);
    });

    it('numbers the same name twice', () => {
        expect(initialsOf(groupAvatarLooks(people('Jo', 'Jo')))).toEqual(['J1', 'J2']);
        expect(new Set(initialsOf(groupAvatarLooks(people('Marie', 'Marie')))).size).toBe(2);
    });

    it('never gives a shared pair to a name that had it alone', () => {
        // "MN" is Mna's own: Manon (sharing "MA" with Mathieu) takes another.
        const looks = groupAvatarLooks(people('Mna', 'Manon', 'Mathieu'));
        expect(new Set(initialsOf(looks)).size).toBe(3);
        expect(looks.get('p0')!.initials).toBe('MN');
    });

    it('gives each member a color of their own while there are some left', () => {
        const names = ['Antoine', 'Laetitia', 'Tony', 'Manon', 'Madleen', 'Coralie', 'José', 'Mathieu'];
        const colors = [...groupAvatarLooks(people(...names)).values()].map((l) => l.color);
        expect(new Set(colors).size).toBe(AVATAR_GRADIENTS.length);
        // The first one keeps the color of its name.
        expect(colors[0]).toBe(nameColor('Antoine'));
    });

    it('keeps the looks of earlier members when someone is added', () => {
        const before = groupAvatarLooks(people('Antoine', 'Laetitia', 'Tony'));
        const after = groupAvatarLooks(people('Antoine', 'Laetitia', 'Tony', 'Coralie'));
        for (const id of before.keys()) expect(after.get(id)).toEqual(before.get(id));
    });
});
