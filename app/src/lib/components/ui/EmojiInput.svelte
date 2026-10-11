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
        class={cn("h-10 w-14 rounded-md border border-input bg-background px-3 py-2 text-xl ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors", className)}
        onclick={() => isOpen = !isOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label ?? $t('emoji.picker_label')}
    >
        {value}
    </button>

    {#if isOpen}
        <div class="absolute top-full mt-2 left-0 z-50 w-80 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 rounded-lg shadow-xl border dark:border-slate-800 p-2">
            {#each categoryOrder as categoryKey (categoryKey)}
                {@const category = EMOJI_CATEGORIES[categoryKey]}
                {#if category}
                    <div class="mb-3 last:mb-0">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                            {$t(category.labelKey)}
                        </div>
                        <div class="grid grid-cols-8 gap-0.5">
                            {#each category.emojis as emoji (emoji)}
                                <button
                                    type="button"
                                    class="aspect-square hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-lg flex items-center justify-center transition-colors {value === emoji ? 'bg-indigo-100 dark:bg-indigo-900/30' : ''}"
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
