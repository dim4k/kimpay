import { describe, it, expect } from 'vitest';
import { cn } from '../../src/lib/utils/cn';

describe('utils/cn', () => {
    describe('cn (className utility)', () => {
        it('should merge single class', () => {
            expect(cn('foo')).toBe('foo');
        });

        it('should merge multiple classes', () => {
            expect(cn('foo', 'bar')).toBe('foo bar');
        });

        it('should filter out falsy values', () => {
            expect(cn('foo', false, 'bar', null, undefined)).toBe('foo bar');
        });

        it('should handle conditional classes', () => {
            const isActive = true;
            const isInactive = false;
            expect(cn('base', isActive && 'active')).toBe('base active');
            expect(cn('base', isInactive && 'active')).toBe('base');
        });

        it('should merge Tailwind conflicts correctly', () => {
            // Later class should win
            expect(cn('p-4', 'p-2')).toBe('p-2');
            expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
            expect(cn('bg-white', 'bg-black')).toBe('bg-black');
        });

        it('should handle arrays', () => {
            expect(cn(['foo', 'bar'])).toBe('foo bar');
        });

        it('should handle objects', () => {
            expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
        });

        it('should handle mixed inputs', () => {
            expect(cn('base', { active: true }, ['extra', 'classes'])).toBe('base active extra classes');
        });

        it('should handle empty input', () => {
            expect(cn()).toBe('');
            expect(cn('')).toBe('');
        });

        it('should handle complex Tailwind merges', () => {
            // Hover states
            expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
            // Dark mode
            expect(cn('dark:text-white', 'dark:text-slate-200')).toBe('dark:text-slate-200');
            // Responsive
            expect(cn('md:p-4', 'md:p-6')).toBe('md:p-6');
        });
    });
});
