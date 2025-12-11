interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
}

interface ExtendedWindow extends Window {
    MSStream?: unknown;
}

interface ExtendedNavigator extends Navigator {
    standalone?: boolean;
}

class InstallStore {
    private _promptEvent: BeforeInstallPromptEvent | null = null;
    
    // State
    canInstall = $state(false);
    isIOS = $state(false);
    isStandalone = $state(false);
    showIOSInstructions = $state(false);

    constructor() {
        if (typeof window !== "undefined") {
            this.checkPlatform();
        }
    }

    checkPlatform() {
        const ua = window.navigator.userAgent;
        this.isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as ExtendedWindow).MSStream;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as ExtendedNavigator).standalone === true;
        
        // If iOS and not standalone, we can "install" (via manual instructions)
        if (this.isIOS && !this.isStandalone) {
            this.canInstall = true;
        }
    }

    setPrompt(e: unknown) {
        this._promptEvent = e as BeforeInstallPromptEvent;
        this.canInstall = true;
    }

    async install() {
        if (this.isIOS) {
            this.showIOSInstructions = true;
            return;
        }

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
