import { Plus } from "lucide-svelte";
import type { Component } from "svelte";

// Define the shape of our FAB state
type FabProps = {
    visible: boolean;
    icon: Component;
    colorClass: string;
    onClick: (() => void) | null;
    href: string | null;
    label: string;
    disabled: boolean;
    key: string | number;
};

const DEFAULT_COLOR = "bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-200 dark:shadow-none";

class FabState {
    visible = $state(true);
    icon = $state<Component>(Plus as unknown as Component);
    colorClass = $state(DEFAULT_COLOR);
    onClick = $state<(() => void) | null>(null);
    href = $state<string | null>(null);
    label = $state("Add Expense");
    disabled = $state(false);
    key = $state("default");

    reset(kimpayId: string) {
        this.visible = true;
        this.icon = Plus as unknown as Component;
        this.colorClass = DEFAULT_COLOR;
        this.onClick = null;
        this.href = `/k/${kimpayId}/add`;
        this.label = "Add Expense";
        this.disabled = false;
        this.key = "default";
    }

    configure(props: Partial<FabProps>) {
        const typeChanged = (props.href !== undefined && !!props.href !== !!this.href);

        if (props.visible !== undefined) this.visible = props.visible;
        if (props.icon) this.icon = props.icon;
        if (props.colorClass) this.colorClass = props.colorClass;
        if (props.onClick !== undefined) this.onClick = props.onClick;
        if (props.href !== undefined) this.href = props.href;
        if (props.label) this.label = props.label;
        if (props.disabled !== undefined) this.disabled = props.disabled;
        
        if (typeChanged) {
             this.key = Date.now().toString();
        }
    }
}

export const fabState = new FabState();
