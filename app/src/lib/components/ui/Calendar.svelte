<script lang="ts">
  import { tick } from 'svelte';
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { t, locale } from '#lib/i18n.js';
  import { parseLocalISODate, toLocalISODate, weekdayLabels } from '#lib/utils/date.js';

  /** A month to pick a day from. `value`: local calendar date, "YYYY-MM-DD". */
  let { value = $bindable(), label, onselect }: { value: string; label: string; onselect?: (value: string) => void } = $props();

  // The month shown: the one of the date, then wherever the arrows lead.
  let viewDate = $state(new Date());

  $effect(() => {
    if (value) viewDate = parseLocalISODate(value);
  });

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  }

  // Six weeks, Monday first, with the ends of the months around.
  let days = $derived.by(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);

    const grid = [];

    for (let i = 0; i < firstDay; i++) {
        grid.push({
            day: prevMonthDays - firstDay + 1 + i,
            currentMonth: false,
            date: new Date(year, month - 1, prevMonthDays - firstDay + 1 + i)
        });
    }

    for (let i = 1; i <= daysInMonth; i++) {
        grid.push({
            day: i,
            currentMonth: true,
            date: new Date(year, month, i)
        });
    }

    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
         grid.push({
            day: i,
            currentMonth: false,
            date: new Date(year, month + 1, i)
        });
    }

    return grid.map((item) => ({ ...item, iso: toLocalISODate(item.date) }));
  });

  function select(d: Date) {
      value = toLocalISODate(d);
      viewDate = new Date(d);
      onselect?.(value);
  }

  function changeMonth(delta: number) {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
  }

  let monthLabel = $derived(viewDate.toLocaleDateString($locale, { month: 'long', year: 'numeric' }));
  let weekdays = $derived(weekdayLabels($locale));
  const today = toLocalISODate();

  // One day of the grid takes the Tab key (the one moved to with the arrows,
  // else the date picked, else the 1st of the month), the arrows do the rest.
  let focusIso = $state<string | null>(null);
  let tabbable = $derived(
      [focusIso, value].find((iso) => iso && days.some((d) => d.iso === iso && d.currentMonth)) ??
          days.find((d) => d.currentMonth)!.iso
  );
  let grid = $state<HTMLElement>();

  const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

  async function move(e: KeyboardEvent, from: Date) {
      const step = STEPS[e.key];
      const months = e.key === 'PageUp' ? -1 : e.key === 'PageDown' ? 1 : 0;
      if (!step && !months) return;
      e.preventDefault();
      const next = step
          ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + step)
          : new Date(from.getFullYear(), from.getMonth() + months, Math.min(from.getDate(), getDaysInMonth(from.getFullYear(), from.getMonth() + months)));
      viewDate = next;
      focusIso = toLocalISODate(next);
      await tick();
      grid?.querySelector<HTMLElement>(`[data-iso="${focusIso}"]`)?.focus();
  }

  function longDate(d: Date): string {
      return d.toLocaleDateString($locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
</script>

<div class="space-y-4" role="group" aria-label={label}>
    <div class="flex items-center justify-between">
        <button type="button" onclick={() => changeMonth(-1)} class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted" aria-label={$t('datepicker.previous')}>
            <ChevronLeft class="h-5 w-5" />
        </button>
        <span class="text-base font-bold capitalize" aria-live="polite">{monthLabel}</span>
        <button type="button" onclick={() => changeMonth(1)} class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted" aria-label={$t('datepicker.next')}>
            <ChevronRight class="h-5 w-5" />
        </button>
    </div>

    <div>
        <div class="mb-2 grid grid-cols-7 gap-1 text-center text-xs" aria-hidden="true">
            {#each weekdays as day, i (i)}
                <div class="py-1 font-medium text-muted-foreground" title={day.long}>{day.short}</div>
            {/each}
        </div>

        <div bind:this={grid} class="grid grid-cols-7 gap-1 text-center">
            {#each days as item (item.iso)}
                <button
                    type="button"
                    data-iso={item.iso}
                    tabindex={item.iso === tabbable ? 0 : -1}
                    class="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors
                        {item.iso === value
                            ? 'bg-primary font-bold text-primary-foreground'
                            : item.iso === today
                                ? 'border-2 border-primary font-semibold text-primary'
                                : item.currentMonth ? 'hover:bg-muted' : 'text-muted-foreground/50 hover:bg-muted'}"
                    aria-label={longDate(item.date)}
                    aria-pressed={item.iso === value}
                    aria-current={item.iso === today ? 'date' : undefined}
                    onkeydown={(e) => move(e, item.date)}
                    onclick={() => select(item.date)}
                >
                    {item.day}
                </button>
            {/each}
        </div>
    </div>

    <div class="flex justify-center border-t pt-2">
         <button
            type="button"
            class="min-h-11 px-3 text-sm font-bold text-primary hover:underline"
            onclick={() => select(new Date())}
        >
            {$t('datepicker.today')}
        </button>
    </div>
</div>
