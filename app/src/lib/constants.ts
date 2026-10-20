
import type { TranslationKey } from "#lib/locales/en.js";

/** Longest name of a participant, the same in every form that asks for one. */
export const NAME_MAX_LENGTH = 24;
/** A group's name: room for "Trip to Portugal, summer 2026", short enough for the header. */
export const GROUP_NAME_MAX_LENGTH = 40;
/** The note of an expense (PocketBase field `notes`) */
export const NOTES_MAX_LENGTH = 500;

// Emoji categories (labels are translated)
export interface EmojiCategory {
    labelKey: TranslationKey;
    emojis: readonly string[];
}

export const EMOJI_CATEGORIES: Record<string, EmojiCategory> = {
    FOOD: { 
        labelKey: "emoji.category.food",
        emojis: ['🍕', '🍽️', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥗', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🍙', '🍚', '🍤', '🦞', '🦀', '🐟', '🍗', '🍖', '🥩', '🥓', '🧇', '🥞', '🍳', '🥐', '🥖', '🥨', '🧀', '🥚', '🥦', '🥑', '🍅', '🌽', '🍄', '🍦', '🍨', '🍧', '🍰', '🧁', '🥧', '🍮', '🍩', '🍪', '🍫', '🍬', '🍭', '🍯', '🍎', '🍌', '🍉', '🍓', '🍒', '🍑', '🥥', '🍍', '☕', '🍵', '🧋', '🥤', '🧃', '🍺', '🍻', '🍷', '🍸', '🍹', '🥂', '🥃', '🍾', '🛒'] 
    },
    TRANSPORT: { 
        labelKey: "emoji.category.transport",
        emojis: ['🚗', '🚕', '🚙', '🚐', '🛻', '🚌', '🚎', '🚓', '🚑', '🚒', '🚚', '🚛', '🏍️', '🛵', '🚲', '🛴', '🛹', '🚇', '🚊', '🚉', '🚆', '🚄', '🚅', '🚂', '🚝', '✈️', '🛫', '🛬', '🚁', '🚀', '🛸', '🚢', '⛴️', '🛥️', '⛵', '🛶', '⚓', '⛽', '🅿️', '🚏', '🚦', '🚧'] 
    },
    LODGING: { 
        labelKey: "emoji.category.lodging",
        emojis: ['🏠', '🏡', '🏘️', '🏢', '🏬', '🏨', '🏩', '🏰', '🏯', '🛏️', '🛋️', '🚪', '🔑', '🗝️', '🛎️', '🧳', '🏕️', '⛺', '🛖', '🏚️', '🚿', '🛁', '🚽'] 
    },
    ACTIVITIES: { 
        labelKey: "emoji.category.activities",
        emojis: ['🎬', '🎭', '🎤', '🎵', '🎶', '🎧', '🎸', '🎹', '🥁', '🎺', '🎻', '🎮', '🕹️', '🎲', '🎯', '🎳', '♟️', '🃏', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '⛳', '🏊', '🏄', '🚴', '🧗', '⛷️', '🏂', '🎿', '🛷', '🏋️', '🤸', '🧘', '🤺', '🏇', '🎣', '🎫', '🎟️', '🎪', '🎨', '🖼️', '📷', '📸', '🎰', '🎢', '🎡', '🎠', '🪁', '🔭', '🔬'] 
    },
    SHOPPING: { 
        labelKey: "emoji.category.shopping",
        emojis: ['🛍️', '🛒', '👕', '👚', '👗', '👘', '🥻', '👖', '🩳', '🧥', '🧦', '👔', '👞', '👟', '🥾', '👠', '👡', '👢', '👜', '👛', '👝', '🎒', '💼', '💎', '💍', '⌚', '🕶️', '👓', '🧢', '👒', '🎩', '🧣', '🧤', '☂️', '💄', '💅'] 
    },
    TRAVEL: { 
        labelKey: "emoji.category.travel",
        emojis: ['🏝️', '🏖️', '🏜️', '🏔️', '⛰️', '🗻', '🌋', '🏞️', '🏕️', '🗺️', '🧭', '🧳', '🎒', '📸', '🗼', '🗽', '🗿', '🏛️', '⛩️', '🕌', '🕍', '⛪', '🏰', '🏯', '🎡', '🎢', '🎠', '🌅', '🌄', '🌠', '🏙️', '🌃', '🛂', '🛃', '🛅', '🏨'] 
    },
    BILLS: { 
        labelKey: "emoji.category.bills",
        emojis: ['💸', '💰', '💳', '💵', '💴', '💶', '💷', '🪙', '🧾', '🏦', '🏧', '📱', '💻', '🖥️', '⌨️', '🖨️', '📺', '📻', '☎️', '📞', '💡', '🔌', '🔋', '💧', '🚰', '🔥', '🛢️', '📡', '🌐', '📶', '📦', '📮', '✉️', '🗑️', '🧹', '🧽', '🪣', '🔧'] 
    },
    HEALTH: { 
        labelKey: "emoji.category.health",
        emojis: ['💊', '💉', '🩺', '🩹', '🩼', '🦽', '🏥', '⛑️', '🧴', '🧼', '🪥', '🦷', '👓', '🕶️', '💆', '💇', '🧖', '🧘', '🏋️', '🤸', '🏃', '🚴', '🥦', '🥗', '🛀', '😷', '🤒', '🌡️'] 
    },
    GIFTS: { 
        labelKey: "emoji.category.gifts",
        emojis: ['🎁', '🎀', '🎂', '🍰', '🧁', '🎉', '🎊', '🎈', '🎇', '🎆', '🧨', '✨', '💐', '🌹', '🌷', '🌻', '🌸', '🍾', '🥂', '🥳', '🎄', '🎅', '🤶', '🎃', '🪔', '🕯️', '💝', '💖', '💍', '👰', '🤵', '💒'] 
    },
    OTHER: { 
        labelKey: "emoji.category.other",
        emojis: ['✨', '⭐', '🌟', '💫', '🔥', '💯', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '📝', '📌', '📎', '🔧', '🛠️', '⚙️', '🔨', '🧰', '🪚', '🧱', '👶', '🧒', '👨‍👩‍👧‍👦', '🐕', '🐈', '🐾', '🌱', '🌳', '🌵', '🪴', '🎓', '📚', '📖', '🏫', '💼', '🏢', '⚽', '🎵', '❓'] 
    },
} as const;

export const EMOJI_CATEGORY_ORDER = ['FOOD', 'TRANSPORT', 'LODGING', 'ACTIVITIES', 'SHOPPING', 'TRAVEL', 'BILLS', 'HEALTH', 'GIFTS', 'OTHER'] as const;

// Curated categories for Kimpay group creation
export const KIMPAY_CATEGORY_ORDER = ['TRAVEL', 'ACTIVITIES', 'FOOD', 'GIFTS', 'SHOPPING', 'LODGING', 'OTHER'] as const;

/**
 * Category of an expense emoji (first matching category). OTHER when unknown,
 * and for the default emoji (it says nothing about the expense).
 */
export function emojiCategory(emoji: string | undefined): EmojiCategoryKey {
    if (emoji && emoji !== DEFAULT_EXPENSE_EMOJI) {
        for (const key of EMOJI_CATEGORY_ORDER) {
            if (EMOJI_CATEGORIES[key]!.emojis.includes(emoji)) return key;
        }
    }
    return 'OTHER';
}

export type EmojiCategoryKey = (typeof EMOJI_CATEGORY_ORDER)[number];

/** The color of a category in charts (a CSS variable, see app.css). */
export function categoryColor(key: EmojiCategoryKey): string {
    return `var(--category-${key.toLowerCase()})`;
}

export const DEFAULT_KIMPAY_EMOJI = "✨";
export const DEFAULT_EXPENSE_EMOJI = "💸";
export const DEFAULT_GROUP_ICON = "📁";

// =============================================================================
// Storage Keys (IndexedDB / localStorage)
// =============================================================================

export const STORAGE_KEYS = {
    /** Prefix for Kimpay data in IndexedDB */
    KIMPAY_DATA_PREFIX: 'kimpay_data_',
    /** Prefix: creator key of a group created on this device (IndexedDB) */
    OWNER_KEY_PREFIX: 'kimpay_owner_key_',
    /** Key for offline action queue */
    OFFLINE_QUEUE: 'kimpay_offline_queue',
    /** Prefix for currency rates cache in localStorage */
    RATES_CACHE_PREFIX: 'kimpay_rates_',
    /** Sort order of the expense list (localStorage) */
    EXPENSE_SORT: 'kimpay_expense_sort',
    /** Amounts of the expense list: "total" or "me" (localStorage) */
    EXPENSE_VIEW: 'kimpay_expense_view',
    /** Payment handles of a guest's profile (localStorage) */
    PAYMENT_HANDLES: 'kimpay_payment_handles',
    /** Prefix: the "Getting started" card of a Kimpay closed (localStorage) */
    SETUP_DISMISSED_PREFIX: 'kimpay_setup_dismissed_',
    /** Prefix: "show my payment links" card dismissed in a group (localStorage) */
    PAYMENT_NUDGE_DISMISSED_PREFIX: 'kimpay_payment_nudge_dismissed_',
    /** Groups archived on this device, without an account (localStorage) */
    ARCHIVED_KIMPAYS: 'kimpay_archived',
    /** An account was logged in on this device: the empty home offers to log back in (localStorage) */
    HAD_ACCOUNT: 'kimpay_had_account',
    /** Times the "swipe a group" hint was shown (localStorage) */
    SWIPE_HINT_SHOWN: 'kimpay_swipe_hint_shown',
    /** Visits where the expense list explained its swipe (left: delete) */
    EXPENSE_SWIPE_HINT_SHOWN: 'kimpay_expense_swipe_hint_shown',
    /** The group opened last on this device: where the app icon's shortcuts lead */
    LAST_GROUP: 'kimpay_last_group',
    /** Prefix: "archive this settled group?" dismissed (localStorage) */
    ARCHIVE_SUGGESTION_DISMISSED_PREFIX: 'kimpay_archive_suggestion_dismissed_',
    /** Prefix: when the history of a group was last looked at (ms, localStorage) */
    ACTIVITY_SEEN_PREFIX: 'kimpay_activity_seen_',
    /** Language of the app (localStorage) */
    LOCALE: 'locale',
    /** Theme picked: "light" or "dark", none for the system's (localStorage) */
    THEME: 'theme',
    /** Legacy key for migration (deprecated) */
    LEGACY_MY_KIMPAYS: 'my_kimpays',
} as const;
