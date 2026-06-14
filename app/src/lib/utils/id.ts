/**
 * Cryptographically strong random bytes, with a non-secure fallback only when
 * the Web Crypto API is unavailable (e.g. very old / non-HTTPS contexts).
 */
function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    return bytes;
}

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID when available, falls back to getRandomValues.
 */
export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // RFC 4122 v4 built from cryptographically strong bytes.
    const bytes = randomBytes(16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return (
        hex.slice(0, 4).join('') +
        '-' +
        hex.slice(4, 6).join('') +
        '-' +
        hex.slice(6, 8).join('') +
        '-' +
        hex.slice(8, 10).join('') +
        '-' +
        hex.slice(10, 16).join('')
    );
}

/**
 * Generate a PocketBase-compatible ID (15 lowercase alphanumeric chars).
 *
 * Because a Kimpay's ID doubles as its capability secret (knowing the ID grants
 * access), this MUST be cryptographically unpredictable. Uses rejection
 * sampling over the 36-char alphabet to avoid modulo bias.
 */
export function generatePocketBaseId(): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length; // 36
    // Largest multiple of 36 that fits in a byte; values >= it are rejected.
    const maxUnbiased = 256 - (256 % charactersLength); // 252
    let result = '';
    while (result.length < 15) {
        const bytes = randomBytes(15 - result.length);
        for (const byte of bytes) {
            if (byte < maxUnbiased) {
                result += characters.charAt(byte % charactersLength);
                if (result.length === 15) break;
            }
        }
    }
    return result;
}
