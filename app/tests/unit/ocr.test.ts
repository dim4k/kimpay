import { describe, it, expect, vi } from 'vitest';

// The scanner calls PocketBase: not needed to explain its errors.
vi.mock('#lib/pocketbase.js', () => ({ pb: {} }));

import { scanErrorKey } from '../../src/lib/services/ocr';
import { pendingReceipt } from '../../src/lib/stores/pendingReceipt';

describe('services/ocr', () => {
    describe('scanErrorKey', () => {
        it('explains the errors of the scanner from their HTTP status', () => {
            expect(scanErrorKey({ status: 401 })).toBe('expense.form.scan_login_required_desc');
            expect(scanErrorKey({ status: 429 })).toBe('expense.form.scan_rate_limited');
            expect(scanErrorKey({ status: 422 })).toBe('expense.form.scan_unreadable');
        });

        it('falls back to a generic message', () => {
            expect(scanErrorKey({ status: 500 })).toBe('error.generic');
            expect(scanErrorKey(new Error('Network down'))).toBe('error.generic');
            expect(scanErrorKey(null)).toBe('error.generic');
        });
    });
});

describe('stores/pendingReceipt', () => {
    it('hands a picked photo over once', () => {
        const photo = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
        expect(pendingReceipt.take()).toBeNull();
        pendingReceipt.set(photo);
        expect(pendingReceipt.take()).toBe(photo);
        expect(pendingReceipt.take()).toBeNull();
    });
});
