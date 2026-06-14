
// Emoji categories with labels for display
export interface EmojiCategory {
    label: string;
    labelFr: string;
    emojis: readonly string[];
}

export const EMOJI_CATEGORIES: Record<string, EmojiCategory> = {
    FOOD: { 
        label: 'Food & Drinks', 
        labelFr: 'Nourriture',
        emojis: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥗', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🍙', '🍚', '🍤', '🦞', '🦀', '🐟', '🍗', '🍖', '🥩', '🥓', '🧇', '🥞', '🍳', '🥐', '🥖', '🥨', '🧀', '🥚', '🥦', '🥑', '🍅', '🌽', '🍄', '🍦', '🍨', '🍧', '🍰', '🧁', '🥧', '🍮', '🍩', '🍪', '🍫', '🍬', '🍭', '🍯', '🍎', '🍌', '🍉', '🍓', '🍒', '🍑', '🥥', '🍍', '☕', '🍵', '🧋', '🥤', '🧃', '🍺', '🍻', '🍷', '🍸', '🍹', '🥂', '🥃', '🍾', '🛒'] 
    },
    TRANSPORT: { 
        label: 'Transport', 
        labelFr: 'Transport',
        emojis: ['🚗', '🚕', '🚙', '🚐', '🛻', '🚌', '🚎', '🚓', '🚑', '🚒', '🚚', '🚛', '🏍️', '🛵', '🚲', '🛴', '🛹', '🚇', '🚊', '🚉', '🚆', '🚄', '🚅', '🚂', '🚝', '✈️', '🛫', '🛬', '🚁', '🚀', '🛸', '🚢', '⛴️', '🛥️', '⛵', '🛶', '⚓', '⛽', '🅿️', '🚏', '🚦', '🚧'] 
    },
    LODGING: { 
        label: 'Lodging', 
        labelFr: 'Hébergement',
        emojis: ['🏠', '🏡', '🏘️', '🏢', '🏬', '🏨', '🏩', '🏰', '🏯', '🛏️', '🛋️', '🚪', '🔑', '🗝️', '🛎️', '🧳', '🏕️', '⛺', '🛖', '🏚️', '🚿', '🛁', '🚽'] 
    },
    ACTIVITIES: { 
        label: 'Activities', 
        labelFr: 'Activités',
        emojis: ['🎬', '🎭', '🎤', '🎵', '🎶', '🎧', '🎸', '🎹', '🥁', '🎺', '🎻', '🎮', '🕹️', '🎲', '🎯', '🎳', '♟️', '🃏', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '⛳', '🏊', '🏄', '🚴', '🧗', '⛷️', '🏂', '🎿', '🛷', '🏋️', '🤸', '🧘', '🤺', '🏇', '🎣', '🎫', '🎟️', '🎪', '🎨', '🖼️', '📷', '📸', '🎰', '🎢', '🎡', '🎠', '🪁', '🔭', '🔬'] 
    },
    SHOPPING: { 
        label: 'Shopping', 
        labelFr: 'Shopping',
        emojis: ['🛍️', '🛒', '👕', '👚', '👗', '👘', '🥻', '👖', '🩳', '🧥', '🧦', '👔', '👞', '👟', '🥾', '👠', '👡', '👢', '👜', '👛', '👝', '🎒', '💼', '💎', '💍', '⌚', '🕶️', '👓', '🧢', '👒', '🎩', '🧣', '🧤', '☂️', '💄', '💅'] 
    },
    TRAVEL: { 
        label: 'Travel', 
        labelFr: 'Voyage',
        emojis: ['🏝️', '🏖️', '🏜️', '🏔️', '⛰️', '🗻', '🌋', '🏞️', '🏕️', '🗺️', '🧭', '🧳', '🎒', '📸', '🗼', '🗽', '🗿', '🏛️', '⛩️', '🕌', '🕍', '⛪', '🏰', '🏯', '🎡', '🎢', '🎠', '🌅', '🌄', '🌠', '🏙️', '🌃', '🛂', '🛃', '🛅', '🏨'] 
    },
    BILLS: { 
        label: 'Bills & Services', 
        labelFr: 'Factures',
        emojis: ['💸', '💰', '💳', '💵', '💴', '💶', '💷', '🪙', '🧾', '🏦', '🏧', '📱', '💻', '🖥️', '⌨️', '🖨️', '📺', '📻', '☎️', '📞', '💡', '🔌', '🔋', '💧', '🚰', '🔥', '🛢️', '📡', '🌐', '📶', '📦', '📮', '✉️', '🗑️', '🧹', '🧽', '🪣', '🔧'] 
    },
    HEALTH: { 
        label: 'Health & Wellness', 
        labelFr: 'Santé',
        emojis: ['💊', '💉', '🩺', '🩹', '🩼', '🦽', '🏥', '⛑️', '🧴', '🧼', '🪥', '🦷', '👓', '🕶️', '💆', '💇', '🧖', '🧘', '🏋️', '🤸', '🏃', '🚴', '🥦', '🥗', '🛀', '😷', '🤒', '🌡️'] 
    },
    GIFTS: { 
        label: 'Gifts & Celebrations', 
        labelFr: 'Cadeaux',
        emojis: ['🎁', '🎀', '🎂', '🍰', '🧁', '🎉', '🎊', '🎈', '🎇', '🎆', '🧨', '✨', '💐', '🌹', '🌷', '🌻', '🌸', '🍾', '🥂', '🥳', '🎄', '🎅', '🤶', '🎃', '🪔', '🕯️', '💝', '💖', '💍', '👰', '🤵', '💒'] 
    },
    OTHER: { 
        label: 'Other', 
        labelFr: 'Autre',
        emojis: ['✨', '⭐', '🌟', '💫', '🔥', '💯', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '📝', '📌', '📎', '🔧', '🛠️', '⚙️', '🔨', '🧰', '🪚', '🧱', '👶', '🧒', '👨‍👩‍👧‍👦', '🐕', '🐈', '🐾', '🌱', '🌳', '🌵', '🪴', '🎓', '📚', '📖', '🏫', '💼', '🏢', '⚽', '🎵', '❓'] 
    },
} as const;

export const EMOJI_CATEGORY_ORDER = ['FOOD', 'TRANSPORT', 'LODGING', 'ACTIVITIES', 'SHOPPING', 'TRAVEL', 'BILLS', 'HEALTH', 'GIFTS', 'OTHER'] as const;

// Curated categories for Kimpay group creation
export const KIMPAY_CATEGORY_ORDER = ['TRAVEL', 'ACTIVITIES', 'FOOD', 'GIFTS', 'SHOPPING', 'LODGING', 'OTHER'] as const;

export const DEFAULT_KIMPAY_EMOJI = "✨";
export const DEFAULT_EXPENSE_EMOJI = "💸";
export const REIMBURSEMENT_EMOJI = "🔄";

// Flat list for backward compatibility
export const KIMPAY_EMOJIS = [
    DEFAULT_KIMPAY_EMOJI,
    ...EMOJI_CATEGORIES['TRAVEL']!.emojis,
    ...EMOJI_CATEGORIES['ACTIVITIES']!.emojis.slice(0, 10),
    ...EMOJI_CATEGORIES['FOOD']!.emojis.slice(0, 10),
].filter((value, index, self) => self.indexOf(value) === index);

export const EXPENSE_EMOJIS = EMOJI_CATEGORY_ORDER.flatMap(
    cat => [...EMOJI_CATEGORIES[cat]!.emojis]
).filter((value, index, self) => self.indexOf(value) === index);


export const EXPAND = {
    // Relations to expand when fetching a single Expense
    EXPENSE_RELATIONS: "payer,involved",
    
    // Relations to expand when fetching a Kimpay
    KIMPAY_WITH_PARTICIPANTS: "participants_via_kimpay",
    KIMPAY_WITH_EXPENSES: "expenses_via_kimpay.payer,expenses_via_kimpay.involved",
    
    // Combined
    KIMPAY_FULL: "participants_via_kimpay,expenses_via_kimpay.payer,expenses_via_kimpay.involved"
} as const;

// =============================================================================
// Storage Keys (IndexedDB / localStorage)
// =============================================================================

export const STORAGE_KEYS = {
    /** Prefix for Kimpay data in IndexedDB */
    KIMPAY_DATA_PREFIX: 'kimpay_data_',
    /** Key for offline action queue */
    OFFLINE_QUEUE: 'kimpay_offline_queue',
    /** Prefix for currency rates cache in localStorage */
    RATES_CACHE_PREFIX: 'kimpay_rates_',
    /** Legacy key for migration (deprecated) */
    LEGACY_MY_KIMPAYS: 'my_kimpays',
} as const;
