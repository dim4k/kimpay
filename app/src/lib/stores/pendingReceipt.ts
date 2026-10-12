/**
 * A receipt photo picked outside the expense form (e.g. from the empty list),
 * handed over to the form, which scans it as soon as it opens.
 */
class PendingReceipt {
    private file: File | null = null;

    set(file: File) {
        this.file = file;
    }

    /** The waiting photo, once: it is forgotten as soon as it is taken. */
    take(): File | null {
        const file = this.file;
        this.file = null;
        return file;
    }
}

export const pendingReceipt = new PendingReceipt();
