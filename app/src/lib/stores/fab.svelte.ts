import { Plus } from "lucide-svelte";


// Define the shape of our FAB state
type FabProps = {
    visible: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any; // Lucide icon type compatibility
    colorClass: string;
    onClick: (() => void) | null;
    href: string | null;
    label: string;
    disabled: boolean;
    key: string | number; // For triggering transitions
};

const DEFAULT_COLOR = "bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-200 dark:shadow-none";

class FabState {
    // Current state
    visible = $state(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon = $state<any>(Plus);
    colorClass = $state(DEFAULT_COLOR);
    onClick = $state<(() => void) | null>(null);
    href = $state<string | null>(null);
    label = $state("Add Expense");
    disabled = $state(false);
    key = $state("default");

    // Reset to default navigation button
    reset(kimpayId: string) {
        this.visible = true;
        this.icon = Plus;
        this.colorClass = DEFAULT_COLOR;
        this.onClick = null;
        this.href = `/k/${kimpayId}/add`;
        this.label = "Add Expense";
        this.disabled = false;
        this.key = "default";
    }

    // Configure for specific action
    configure(props: Partial<FabProps>) {
        // Detect if we are changing element type (href vs button)
        const typeChanged = (props.href !== undefined && !!props.href !== !!this.href);

        if (props.visible !== undefined) this.visible = props.visible;
        if (props.icon) this.icon = props.icon;
        if (props.colorClass) this.colorClass = props.colorClass;
        if (props.onClick !== undefined) this.onClick = props.onClick;
        if (props.href !== undefined) this.href = props.href;
        if (props.label) this.label = props.label;
        if (props.disabled !== undefined) this.disabled = props.disabled;
        
        // Only force re-render if element type changes, to allow CSS transitions on color/transform
        if (typeChanged) {
             this.key = Date.now().toString();
        }
    }
}

export const fabState = new FabState();
