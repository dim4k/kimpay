<script lang="ts">
    interface Props {
        checked: boolean;
        /** Accessible name */
        label: string;
        onchange: (checked: boolean) => void;
        disabled?: boolean;
    }

    let { checked, label, onchange, disabled = false }: Props = $props();
</script>

<button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    {disabled}
    onclick={() => onchange(!checked)}
    class="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 {checked ? 'bg-primary' : 'bg-muted-foreground/80 dark:bg-muted-foreground/50'}"
>
    <span class="inline-block h-5 w-5 rounded-full bg-card shadow-sm transition-transform duration-150 {checked ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
</button>
