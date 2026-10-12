<script lang="ts">
  import { Search } from "@lucide/svelte";
  import { EMOJI_CATEGORIES, EMOJI_CATEGORY_ORDER, KIMPAY_CATEGORY_ORDER, DEFAULT_EXPENSE_EMOJI } from "#lib/constants.js";
  import { t, locale } from "#lib/i18n.js";
  import { cn } from "#lib/utils/cn.js";
  import { isEmoji, loadKeywords, searchEmojis } from "#lib/emoji/search.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import Modal from "#lib/components/ui/modals/Modal.svelte";
  import ModalHeader from "#lib/components/ui/modals/ModalHeader.svelte";

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
  let query = $state("");
  let searchInput = $state<HTMLInputElement | null>(null);
  let keywords = $state<Record<string, string>[]>([]);

  const categoryOrder = $derived(variant === "kimpay" ? KIMPAY_CATEGORY_ORDER : EMOJI_CATEGORY_ORDER);
  const categories = $derived(categoryOrder.map((key) => EMOJI_CATEGORIES[key]).filter((c) => !!c));

  // The names of the emojis, in the language of the app and in English (the
  // words people often type), loaded the first time the picker opens.
  $effect(() => {
      if (!isOpen) return;
      const lang = $locale;
      Promise.all([loadKeywords(lang), lang === 'en' ? Promise.resolve({}) : loadKeywords('en')]).then((k) => (keywords = k));
  });

  // Typing right away on a computer; on a phone, the keyboard would cover
  // the emojis until asked for.
  $effect(() => {
      if (isOpen && searchInput && window.matchMedia('(pointer: fine)').matches) searchInput.focus();
  });

  let results = $derived.by(() => {
      const text = query.trim();
      if (!text) return null;
      // An emoji typed or pasted is offered as is.
      if (isEmoji(text)) return [text];
      // A category name finds its emojis too ("transport").
      const extra: Record<string, string> = {};
      for (const category of categories) {
          for (const emoji of category.emojis) extra[emoji] = `${extra[emoji] ?? ''} ${$t(category.labelKey)}`;
      }
      return searchEmojis(text, categories.flatMap((c) => c.emojis), keywords, extra);
  });

  function open() {
      query = "";
      isOpen = true;
  }

  function pick(emoji: string) {
      value = emoji;
      isOpen = false;
  }

  function onSearchKeydown(e: KeyboardEvent) {
      // Enter takes the first match.
      if (e.key === 'Enter' && results?.[0]) {
          e.preventDefault();
          pick(results[0]);
      }
  }
</script>

{#snippet grid(emojis: readonly string[])}
    <div class="grid grid-cols-8 gap-1">
        {#each emojis as emoji (emoji)}
            <button
                type="button"
                class="flex aspect-square items-center justify-center rounded-control text-2xl transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring {value === emoji ? 'bg-primary-soft' : ''}"
                aria-pressed={value === emoji}
                onclick={() => pick(emoji)}
            >
                {emoji}
            </button>
        {/each}
    </div>
{/snippet}

<button
    type="button"
    class={cn("h-11 w-14 shrink-0 rounded-control border border-input bg-card text-xl ring-offset-background transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
    onclick={open}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-label={label ?? $t('emoji.picker_label')}
>
    {value}
</button>

<!-- A sheet of its own (phones) or a dialog (larger screens): never clipped
     by the form, the sheet or the screen edge it is opened from. -->
<Modal isOpen={isOpen} onClose={() => isOpen = false} variant="sheet" label={$t('emoji.picker_title')} class="space-y-4">
    <ModalHeader title={$t('emoji.picker_title')} align="start" onClose={() => isOpen = false} />

    <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
            type="search"
            bind:ref={searchInput}
            bind:value={query}
            onkeydown={onSearchKeydown}
            placeholder={$t('emoji.search_placeholder')}
            aria-label={$t('emoji.search_placeholder')}
            autocomplete="off"
            class="pl-9"
        />
    </div>

    <!-- Fixed height: the sheet does not jump while the results change. -->
    <div class="-mx-2 h-[min(50dvh,22rem)] overflow-y-auto px-2">
        {#if results}
            {#if results.length > 0}
                {@render grid(results)}
            {:else}
                <p class="py-10 text-center text-sm text-muted-foreground">
                    {$t('emoji.no_result', { query: query.trim() })}
                </p>
            {/if}
        {:else}
            <div class="space-y-4">
                {#each categories as category (category.labelKey)}
                    <section class="space-y-1">
                        <h3 class="px-1 text-xs font-semibold text-muted-foreground">{$t(category.labelKey)}</h3>
                        {@render grid(category.emojis)}
                    </section>
                {/each}
            </div>
        {/if}
    </div>
</Modal>
