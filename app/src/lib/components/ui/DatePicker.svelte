<script lang="ts">
  import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { t, locale } from '$lib/i18n';
  import { parseLocalISODate, toLocalISODate } from '$lib/utils/date';

  let { value = $bindable() } = $props();

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

<div class="relative w-full">
    <!-- Trigger -->
    <button 
        bind:this={triggerRef}
        type="button"
        class="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onclick={toggleOpen}
    >
        <span class="capitalize">{displayValue}</span>
        <CalendarIcon class="ml-2 h-4 w-4 opacity-50" />
    </button>

    {#if isOpen}
        <!-- Backdrop (Transparent, purely for closing logic) -->
        <div class="fixed inset-0 z-40" onclick={() => isOpen = false} aria-hidden="true"></div>

        <!-- Dropdown -->
        <div 
            class="absolute left-0 z-50 w-[300px] rounded-xl border bg-card text-card-foreground shadow-xl p-4 space-y-4 {openUp ? 'bottom-full mb-2' : 'top-full mt-2'}"
            role="dialog"
            aria-modal="true"
        >
            <!-- Header -->
            <div class="flex items-center justify-between">
                <button onclick={() => changeMonth(-1)} class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ChevronLeft class="h-5 w-5" />
                </button>
                <span class="font-bold capitalize text-base">{monthLabel}</span>
                <button onclick={() => changeMonth(1)} class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ChevronRight class="h-5 w-5" />
                </button>
            </div>

            <!-- Grid -->
            <div>
                <div class="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                    {#each WEEKDAYS as day (day)}
                        <div class="text-muted-foreground font-medium py-1">{day}</div>
                    {/each}
                </div>
                
                <div class="grid grid-cols-7 gap-1 text-center">
                    {#each days as item (item.date.getTime())}
                        <button 
                            type="button"
                            class="h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm transition-all
                                {item.currentMonth ? 'text-foreground hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-muted-foreground opacity-30'}
                                {formatDate(item.date) === value ? 'bg-indigo-600 text-white hover:bg-indigo-700 opacity-100! font-bold shadow-md scale-105' : ''}
                                {formatDate(new Date()) === formatDate(item.date) && formatDate(item.date) !== value ? 'border-2 border-indigo-600 text-indigo-600 font-semibold' : ''}
                            "
                            onclick={() => handleSelect(item.date)}
                        >
                            {item.day}
                        </button>
                    {/each}
                </div>
            </div>
            
            <div class="pt-2 border-t dark:border-slate-800 flex justify-center">
                 <button 
                    class="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                    onclick={() => handleSelect(new Date())}
                >
                    {$t('datepicker.today')}
                </button>
            </div>
        </div>
    {/if}
</div>
