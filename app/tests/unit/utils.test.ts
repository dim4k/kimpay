import { describe, it, expect, vi } from 'vitest';
import { generateUUID, generatePocketBaseId, isValidEmail } from '../../src/lib/utils/index';

describe('generateUUID', () => {
    it('should generate a string', () => {
        const uuid = generateUUID();
        expect(typeof uuid).toBe('string');
    });

    it('should generate valid UUID format', () => {
        const uuid = generateUUID();
        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
        const uuids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            uuids.add(generateUUID());
        }
        expect(uuids.size).toBe(100);
    });

    it('should use crypto.randomUUID when available', () => {
        const mockUUID = '12345678-1234-4234-8234-123456789012';
        vi.stubGlobal('crypto', { randomUUID: () => mockUUID });
        
        expect(generateUUID()).toBe(mockUUID);
        
        vi.unstubAllGlobals();
    });
});

describe('generatePocketBaseId', () => {
    it('should generate a 15-character string', () => {
        const id = generatePocketBaseId();
        expect(id).toHaveLength(15);
    });

    it('should only contain lowercase letters and numbers', () => {
        const id = generatePocketBaseId();
        expect(id).toMatch(/^[a-z0-9]{15}$/);
    });

    it('should generate unique IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(generatePocketBaseId());
        }
        expect(ids.size).toBe(100);
    });
});

describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.org')).toBe(true);
        expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
        expect(isValidEmail('a@b.fr')).toBe(true);
    });

    it('should return false for invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('notanemail')).toBe(false);
        expect(isValidEmail('@nodomain.com')).toBe(false);
        expect(isValidEmail('no@tld')).toBe(false);
        expect(isValidEmail('spaces in@email.com')).toBe(false);
        expect(isValidEmail('missing@.com')).toBe(false);
    });
});
