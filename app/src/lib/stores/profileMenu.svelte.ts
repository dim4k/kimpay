/**
 * Whether the profile (avatar menu) is open. Shared so that other screens
 * can offer a shortcut to it (e.g. the group settings).
 */
class ProfileMenu {
    isOpen = $state(false);

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    toggle() {
        this.isOpen = !this.isOpen;
    }
}

export const profileMenu = new ProfileMenu();
