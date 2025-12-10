interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
}

class InstallStore {
    private _promptEvent: BeforeInstallPromptEvent | null = null;
    canInstall = $state(false);

    setPrompt(e: unknown) {
        this._promptEvent = e as BeforeInstallPromptEvent;
        this.canInstall = true;
    }

    async install() {
        if (!this._promptEvent) return;

        // Show the install prompt
        this._promptEvent.prompt();

        // Wait for the user to respond to the prompt
        await this._promptEvent.userChoice;

        // We've used the prompt, and can't use it again, clear store
        this._promptEvent = null;
        this.canInstall = false;
    }
}

export const installStore = new InstallStore();
