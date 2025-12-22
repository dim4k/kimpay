import { describe, it, expect, vi } from 'vitest';
import { generateUUID, generatePocketBaseId } from '../../src/lib/utils/id';
import { isValidEmail } from '../../src/lib/utils/email';

// =============================================================================
// utils/id.ts - ID Generation Tests
// =============================================================================

describe('utils/id', () => {
    describe('generateUUID', () => {
        it('should generate a string', () => {
            const uuid = generateUUID();
            expect(typeof uuid).toBe('string');
        });

        it('should generate valid UUID v4 format', () => {
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

        it('should have correct length (36 chars with hyphens)', () => {
            const uuid = generateUUID();
            expect(uuid.length).toBe(36);
        });

        it('should use crypto.randomUUID when available', () => {
            const mockUUID = '12345678-1234-4234-8234-123456789012';
            vi.stubGlobal('crypto', { randomUUID: () => mockUUID });
            
            expect(generateUUID()).toBe(mockUUID);
            
            vi.unstubAllGlobals();
        });

        it('should fallback when crypto.randomUUID is not available', () => {
            vi.stubGlobal('crypto', {});
            
            const uuid = generateUUID();
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            
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

        it('should not contain uppercase letters', () => {
            for (let i = 0; i < 10; i++) {
                const id = generatePocketBaseId();
                expect(id).toBe(id.toLowerCase());
            }
        });

        it('should not contain special characters', () => {
            for (let i = 0; i < 10; i++) {
                const id = generatePocketBaseId();
                expect(id).not.toMatch(/[-_@#$%^&*()]/);
            }
        });
    });
});

// =============================================================================
// utils/email.ts - Email Validation Tests
// =============================================================================

describe('utils/email', () => {
    describe('isValidEmail', () => {
        describe('valid emails', () => {
            it('should accept standard email format', () => {
                expect(isValidEmail('test@example.com')).toBe(true);
            });

            it('should accept email with subdomain', () => {
                expect(isValidEmail('user@mail.example.com')).toBe(true);
            });

            it('should accept email with dots in local part', () => {
                expect(isValidEmail('user.name@domain.org')).toBe(true);
            });

            it('should accept email with plus sign', () => {
                expect(isValidEmail('user+tag@example.com')).toBe(true);
            });

            it('should accept email with country TLD', () => {
                expect(isValidEmail('user@example.co.uk')).toBe(true);
                expect(isValidEmail('a@b.fr')).toBe(true);
            });

            it('should accept email with numbers', () => {
                expect(isValidEmail('user123@domain456.com')).toBe(true);
            });

            it('should accept email with hyphen in domain', () => {
                expect(isValidEmail('user@my-domain.com')).toBe(true);
            });

            it('should accept email with underscore in local part', () => {
                expect(isValidEmail('user_name@domain.com')).toBe(true);
            });
        });

        describe('invalid emails', () => {
            it('should reject empty string', () => {
                expect(isValidEmail('')).toBe(false);
            });

            it('should reject email without @', () => {
                expect(isValidEmail('notanemail')).toBe(false);
            });

            it('should reject email without domain', () => {
                expect(isValidEmail('@nodomain.com')).toBe(false);
            });

            it('should reject email without TLD', () => {
                expect(isValidEmail('no@tld')).toBe(false);
            });

            it('should reject email with spaces', () => {
                expect(isValidEmail('spaces in@email.com')).toBe(false);
                expect(isValidEmail('test @email.com')).toBe(false);
                expect(isValidEmail('test@ email.com')).toBe(false);
            });

            it('should reject email with missing local part after dot', () => {
                expect(isValidEmail('missing@.com')).toBe(false);
            });

            it('should reject email with multiple @', () => {
                expect(isValidEmail('user@@domain.com')).toBe(false);
            });

            it('should reject email with only whitespace', () => {
                expect(isValidEmail('   ')).toBe(false);
            });

            it('should reject email with trailing/leading spaces', () => {
                expect(isValidEmail(' test@example.com')).toBe(false);
                expect(isValidEmail('test@example.com ')).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle very long emails', () => {
                const longLocal = 'a'.repeat(64);
                const longDomain = 'b'.repeat(63) + '.com';
                expect(isValidEmail(`${longLocal}@${longDomain}`)).toBe(true);
            });

            it('should handle single character parts', () => {
                expect(isValidEmail('a@b.co')).toBe(true);
            });
        });
    });
});
