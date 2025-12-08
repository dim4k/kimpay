
const GROUPS = {
    MESSAGING: ["💸", "💰", "💳"],
    TRAVEL: [ "🏝️", "🏠", "🏔️", "✈️", "🚆", "🚗"],
    FOOD: ["🍕", "🍔", "🥗", "🥪", "🍦", "🍺", "🍷", "☕", "🛒"],
    ACTIVITIES: ["🎁", "⚽", "🎉", "⛽", "🎬", "🎤", "🎮", "🎫", "🎨", "🎰"],
    LIFE: ["💊", "💡", "📱", "💻", "🔧", "👶", "🎓", "💼"]
} as const;

export const DEFAULT_KIMPAY_EMOJI = "✨";
export const DEFAULT_EXPENSE_EMOJI = "💸";

// Initial list for creating a new Kimpay Group - Curated selection
export const KIMPAY_EMOJIS = [
    DEFAULT_KIMPAY_EMOJI, DEFAULT_EXPENSE_EMOJI,
    ...GROUPS.TRAVEL,
    ...GROUPS.ACTIVITIES, 
    ...GROUPS.FOOD,
    "💼", "🎉"
].filter((value, index, self) => self.indexOf(value) === index); // Unique

// Extended list for Expenses - Everything
export const EXPENSE_EMOJIS = [
    ...GROUPS.MESSAGING,
    ...GROUPS.FOOD,
    ...GROUPS.TRAVEL,
    ...GROUPS.ACTIVITIES,
    ...GROUPS.LIFE
].filter((value, index, self) => self.indexOf(value) === index); // Unique
