import { Plus, type LucideProps } from "@lucide/svelte";
import type { Component } from "svelte";
import { get } from "svelte/store";
import { t } from "$lib/i18n";

// Define the shape of our FAB state
type FabProps = {
    visible: boolean;
    icon: Component<LucideProps>;
    colorClass: string;
    onClick: (() => void) | null;
    href: string | null;
    label: string;
    disabled: boolean;
};

const DEFAULT_COLOR = "bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-200 dark:shadow-none";

class FabState {
    visible = $state(true);
    icon = $state<Component<LucideProps>>(Plus);
    colorClass = $state(DEFAULT_COLOR);
    onClick = $state<(() => void) | null>(null);
    href = $state<string | null>(null);
    label = $state("");
    disabled = $state(false);

    reset(kimpayId: string) {
        this.visible = true;
        this.icon = Plus;
        this.colorClass = DEFAULT_COLOR;
        this.onClick = null;
        this.href = `/k/${kimpayId}/add`;
        this.label = get(t)("expense.add.title");
        this.disabled = false;
    }

    configure(props: Partial<FabProps>) {
        if (props.visible !== undefined) this.visible = props.visible;
        if (props.icon) this.icon = props.icon;
        if (props.colorClass) this.colorClass = props.colorClass;
        if (props.onClick !== undefined) this.onClick = props.onClick;
        if (props.href !== undefined) this.href = props.href;
        if (props.label) this.label = props.label;
        if (props.disabled !== undefined) this.disabled = props.disabled;
    }
}

export const fabState = new FabState();
