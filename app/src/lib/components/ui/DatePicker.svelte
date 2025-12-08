<script lang="ts">
  import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-svelte";
  import { slide } from 'svelte/transition';
  
  let { value = $bindable(), label = "" } = $props();

  let isOpen = $state(false);
  let openUp = $state(false);
  let viewDate = $state(new Date());
  let triggerRef = $state<HTMLButtonElement | null>(null);

  // Parse initial value
  $effect(() => {
    if (value) {
      const parts = value.split('-');
      viewDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
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

  function formatDate(d: Date) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  }

  function handleSelect(d: Date) {
      value = formatDate(d);
      viewDate = new Date(d);
      isOpen = false;
  }

  function changeMonth(delta: number) {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
  }

  let displayValue = $derived(value ? new Date(value).toLocaleDateString('fr-FR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
  }) : "Sélectionner une date");

  let monthLabel = $derived(viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
</script>

<div class="relative w-full">
    <!-- Trigger -->
    <button 
        bind:this={triggerRef}
        type="button"
        class="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    {#each WEEKDAYS as day}
                        <div class="text-muted-foreground font-medium py-1">{day}</div>
                    {/each}
                </div>
                
                <div class="grid grid-cols-7 gap-1 text-center">
                    {#each days as item}
                        <button 
                            type="button"
                            class="h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm transition-all
                                {item.currentMonth ? 'text-foreground hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-muted-foreground opacity-30'}
                                {formatDate(item.date) === value ? 'bg-indigo-600 text-white hover:bg-indigo-700 !opacity-100 font-bold shadow-md scale-105' : ''}
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
                    Aujourd'hui
                </button>
            </div>
        </div>
    {/if}
</div>
