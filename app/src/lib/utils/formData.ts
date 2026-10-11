/**
 * Append a plain object's entries to a FormData instance.
 *
 * Array values are appended as repeated fields (one entry per item), matching
 * how PocketBase expects multi-value relation fields. Files are appended as
 * is, other objects as JSON (PocketBase JSON fields). Scalar values are
 * stringified. `undefined`/`null` values are skipped.
 *
 * @param data   Source object whose entries are appended.
 * @param target Optional existing FormData to append onto (a new one is
 *               created when omitted).
 */
export function objectToFormData(
    data: Record<string, unknown>,
    target: FormData = new FormData(),
): FormData {
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            value.forEach((v) => target.append(key, v as string));
        } else if (value instanceof Blob) {
            target.append(key, value);
        } else if (typeof value === "object") {
            target.append(key, JSON.stringify(value));
        } else {
            target.append(key, String(value));
        }
    }
    return target;
}
