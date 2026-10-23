import { MediaQuery } from 'svelte/reactivity';

// Tailwind's `md` and `lg`: phones keep the tab bar and the sheets.
const md = new MediaQuery('min-width: 48rem');
const lg = new MediaQuery('min-width: 64rem');

/**
 * The computer layout: from `md`, a rail of tabs on the left and sheets
 * opened as a panel on the right (over the page); from `lg`, the page makes
 * room for the panel instead.
 */
class Layout {
    /** Panels open (see Modal's `panel`): the page leaves them their width. */
    panels = $state(0);

    get wide(): boolean {
        return md.current;
    }

    get large(): boolean {
        return lg.current;
    }
}

export const layout = new Layout();
