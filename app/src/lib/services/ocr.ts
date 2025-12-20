import { pb } from '$lib/pocketbase';

export interface OcrResult {
    description: string;
    amount: number;
    currency: string;
    emoji: string | null;
    date: string | null;
}

export interface OcrError {
    message: string;
    error?: string;
}

/**
 * Scan a receipt image using Gemini Vision API
 * Requires user to be authenticated
 * 
 * @param imageBase64 - Base64 encoded image (with or without data URL prefix)
 * @param language - Target language for the description (e.g., 'en', 'fr')
 * @returns Extracted receipt data
 * @throws Error if not authenticated, rate limited, or OCR fails
 */
export async function scanReceipt(imageBase64: string, language: string = 'en'): Promise<OcrResult> {
    const response = await pb.send('/api/ocr/receipt', {
        method: 'POST',
        body: JSON.stringify({ image: imageBase64, language }),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // pb.send throws on non-2xx responses, so if we get here it's successful
    return response as OcrResult;
}

/**
 * Convert a File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Compress image to reduce upload size (max 1MB target)
 */
export async function compressImage(file: File, maxSizeKB = 1024): Promise<string> {
    const base64 = await fileToBase64(file);
    
    // If already small enough, return as-is
    const sizeKB = (base64.length * 0.75) / 1024;
    if (sizeKB <= maxSizeKB) {
        return base64;
    }

    // Compress using canvas
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            
            // Calculate new dimensions (max 1920px on longest side)
            const maxDim = 1920;
            let width = img.width;
            let height = img.height;
            
            if (width > height && width > maxDim) {
                height = (height * maxDim) / width;
                width = maxDim;
            } else if (height > maxDim) {
                width = (width * maxDim) / height;
                height = maxDim;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Start with quality 0.8 and reduce if needed
            let quality = 0.8;
            let result = canvas.toDataURL('image/jpeg', quality);
            
            while ((result.length * 0.75) / 1024 > maxSizeKB && quality > 0.3) {
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }
            
            resolve(result);
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = base64;
    });
}
