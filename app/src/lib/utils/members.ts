import type { Participant } from '#lib/types.js';

/** Uses the group: picked this name on a device (me included), or has an account. */
export function hasJoined(participant: Pick<Participant, 'id' | 'joined' | 'user'>, myId: string | null): boolean {
    return !!participant.joined || !!participant.user || participant.id === myId;
}

/** The shares a member counts for in new expenses (1 unless set). */
export function defaultSharesOf(participant: Pick<Participant, 'default_shares'>): number {
    return participant.default_shares && participant.default_shares > 0 ? participant.default_shares : 1;
}

/**
 * The link opening the group as one of its members: their name is suggested
 * on arrival ("Are you Coralie?"), so they do not add themselves twice.
 */
export function personalInviteLink(groupLink: string, participantId: string): string {
    return `${groupLink}?as=${encodeURIComponent(participantId)}`;
}
