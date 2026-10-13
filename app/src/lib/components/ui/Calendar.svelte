<script lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { t, locale } from '#lib/i18n.js';
  import { parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';

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

    return grid;
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
  // Monday-first short weekday names (2024-01-01 was a Monday).
  let WEEKDAYS = $derived(
      Array.from({ length: 7 }, (_, i) =>
          new Date(2024, 0, 1 + i).toLocaleDateString($locale, { weekday: 'short' }).slice(0, 2)
      )
  );
</script>

<div class="space-y-4" role="group" aria-label={label}>
    <div class="flex items-center justify-between">
        <button type="button" onclick={() => changeMonth(-1)} class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted" aria-label={$t('datepicker.previous')}>
            <ChevronLeft class="h-5 w-5" />
        </button>
        <span class="text-base font-bold capitalize">{monthLabel}</span>
        <button type="button" onclick={() => changeMonth(1)} class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted" aria-label={$t('datepicker.next')}>
            <ChevronRight class="h-5 w-5" />
        </button>
    </div>

    <div>
        <div class="mb-2 grid grid-cols-7 gap-1 text-center text-xs">
            {#each WEEKDAYS as day (day)}
                <div class="py-1 font-medium text-muted-foreground">{day}</div>
            {/each}
        </div>

        <div class="grid grid-cols-7 gap-1 text-center">
            {#each days as item (item.date.getTime())}
                {@const iso = toLocalISODate(item.date)}
                <button
                    type="button"
                    class="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors
                        {iso === value
                            ? 'bg-primary font-bold text-primary-foreground'
                            : iso === toLocalISODate(new Date())
                                ? 'border-2 border-primary font-semibold text-primary'
                                : item.currentMonth ? 'hover:bg-muted' : 'text-muted-foreground/50 hover:bg-muted'}"
                    aria-pressed={iso === value}
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
