
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
export const DEFAULT_GROUP_ICON = "📁";

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
