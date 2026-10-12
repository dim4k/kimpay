<script lang="ts">
  import { EMOJI_CATEGORIES, EMOJI_CATEGORY_ORDER, KIMPAY_CATEGORY_ORDER, DEFAULT_EXPENSE_EMOJI } from "#lib/constants.js";
  import { t } from "#lib/i18n.js";
  import { cn } from "#lib/utils/cn.js";
  import { dismissable } from "#lib/attachments/dismissable.js";

  interface Props {
      value?: string;
      /** `kimpay` shows the categories relevant to a group icon */
      variant?: "expense" | "kimpay";
      /** Merged into the trigger classes */
      class?: string;
      /** Accessible label of the trigger */
      label?: string;
  }

  let { value = $bindable(DEFAULT_EXPENSE_EMOJI), variant = "expense", class: className = "", label }: Props = $props();

  let isOpen = $state(false);

  const categoryOrder = $derived(variant === "kimpay" ? KIMPAY_CATEGORY_ORDER : EMOJI_CATEGORY_ORDER);
</script>

<div class="relative" {@attach isOpen && dismissable(() => (isOpen = false))}>
    <button
        type="button"
        class={cn("h-11 w-14 shrink-0 rounded-control border border-input bg-card text-xl ring-offset-background transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
        onclick={() => isOpen = !isOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label ?? $t('emoji.picker_label')}
    >
        {value}
    </button>

    {#if isOpen}
        <div class="absolute left-0 top-full z-50 mt-2 max-h-72 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border bg-popover p-2 text-popover-foreground shadow-xl">
            {#each categoryOrder as categoryKey (categoryKey)}
                {@const category = EMOJI_CATEGORIES[categoryKey]}
                {#if category}
                    <div class="mb-3 last:mb-0">
                        <div class="mb-1 px-1 text-xs font-semibold text-muted-foreground">
                            {$t(category.labelKey)}
                        </div>
                        <div class="grid grid-cols-8 gap-0.5">
                            {#each category.emojis as emoji (emoji)}
                                <button
                                    type="button"
                                    class="flex aspect-square items-center justify-center rounded-md text-lg transition-colors hover:bg-muted {value === emoji ? 'bg-primary-soft' : ''}"
                                    aria-pressed={value === emoji}
                                    onclick={() => {
                                        value = emoji;
                                        isOpen = false;
                                    }}
                                >
                                    {emoji}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</div>
