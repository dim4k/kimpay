<script lang="ts">
  import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { t, locale } from '#lib/i18n.js';
  import { parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';
  import { dismissable } from '#lib/attachments/dismissable.js';
  import IconTile from './IconTile.svelte';

  /** Local calendar date, "YYYY-MM-DD". Rendered as a row of a ListGroup. */
  let { value = $bindable(), label }: { value: string; label: string } = $props();

  let isOpen = $state(false);
  let openUp = $state(false);
  let viewDate = $state(new Date());
  let triggerRef = $state<HTMLButtonElement | null>(null);

  // Parse initial value
  $effect(() => {
    if (value) viewDate = parseLocalISODate(value);
  });

  function toggleOpen() {
      if (!isOpen && triggerRef) {
          // Check position to decide up/down
          const rect = triggerRef.getBoundingClientRect();
          const screenHeight = window.innerHeight;
          const spaceBelow = screenHeight - rect.bottom;
          
          // If less than 350px below, open up
          openUp = spaceBelow < 350;
      }
      isOpen = !isOpen;
  }

  // Calendar Logic
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  }

  // Generate grid numbers
  let days = $derived.by(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    let grid = [];
    
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

  const formatDate = toLocalISODate;

  function handleSelect(d: Date) {
      value = formatDate(d);
      viewDate = new Date(d);
      isOpen = false;
  }

  function changeMonth(delta: number) {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
  }

  let displayValue = $derived(value ? parseLocalISODate(value).toLocaleDateString($locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
  }) : $t('datepicker.placeholder'));

  let monthLabel = $derived(viewDate.toLocaleDateString($locale, { month: 'long', year: 'numeric' }));
  // Monday-first short weekday names (2024-01-01 was a Monday).
  let WEEKDAYS = $derived(
      Array.from({ length: 7 }, (_, i) =>
          new Date(2024, 0, 1 + i).toLocaleDateString($locale, { weekday: 'short' }).slice(0, 2)
      )
  );
</script>

<div class="relative w-full first:rounded-t-[inherit] last:rounded-b-[inherit]" {@attach isOpen && dismissable(() => (isOpen = false))}>
    <button
        bind:this={triggerRef}
        type="button"
        class="flex w-full min-h-14 items-center gap-3 rounded-[inherit] px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-hidden"
        onclick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
    >
        <IconTile size="sm"><CalendarIcon /></IconTile>
        <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm text-muted-foreground">{label}</span>
            <span class="truncate text-base font-medium capitalize">{displayValue}</span>
        </span>
        <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground transition-transform {isOpen ? 'rotate-90' : ''}" />
    </button>

    {#if isOpen}
        <div
            class="absolute left-2 z-50 w-[300px] max-w-[calc(100vw-2rem)] space-y-4 rounded-card border bg-popover p-4 text-popover-foreground shadow-xl {openUp ? 'bottom-full mb-2' : 'top-full mt-2'}"
            role="dialog"
            aria-label={label}
        >
            <div class="flex items-center justify-between">
                <button type="button" onclick={() => changeMonth(-1)} class="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted" aria-label={$t('datepicker.previous')}>
                    <ChevronLeft class="h-5 w-5" />
                </button>
                <span class="text-base font-bold capitalize">{monthLabel}</span>
                <button type="button" onclick={() => changeMonth(1)} class="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted" aria-label={$t('datepicker.next')}>
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
                        {@const iso = formatDate(item.date)}
                        <button
                            type="button"
                            class="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors
                                {iso === value
                                    ? 'bg-primary font-bold text-primary-foreground'
                                    : iso === formatDate(new Date())
                                        ? 'border-2 border-primary font-semibold text-primary'
                                        : item.currentMonth ? 'hover:bg-muted' : 'text-muted-foreground/50 hover:bg-muted'}"
                            aria-pressed={iso === value}
                            onclick={() => handleSelect(item.date)}
                        >
                            {item.day}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="flex justify-center border-t pt-2">
                 <button
                    type="button"
                    class="min-h-9 px-3 text-sm font-bold text-primary hover:underline"
                    onclick={() => handleSelect(new Date())}
                >
                    {$t('datepicker.today')}
                </button>
            </div>
        </div>
    {/if}
</div>
