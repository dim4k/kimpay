/**
 * Haptic feedback utility for mobile devices.
 * Uses the Vibration API which is supported on Android Chrome/Firefox.
 * iOS Safari does not support this API.
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

const patterns: Record<HapticPattern, number | number[]> = {
    light: 10,
    medium: 25,
    heavy: 50,
    success: [10, 50, 10],
    error: [50, 30, 50],
    warning: [30, 20, 30]
};

/**
 * Trigger haptic feedback if supported.
 * @param pattern - The haptic pattern to use
 * @returns true if vibration was triggered, false otherwise
 */
export function haptic(pattern: HapticPattern = 'light'): boolean {
    if (typeof navigator === 'undefined' || !navigator.vibrate) {
        return false;
    }
    
    try {
        navigator.vibrate(patterns[pattern]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if haptic feedback is supported on this device.
 */
export function isHapticSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}
