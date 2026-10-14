<script lang="ts">
  import { ChevronLeft, CloudOff, History, Users } from "@lucide/svelte";
  import { t, locale } from '#lib/i18n.js';
  import { getActiveKimpayContext } from '#lib/stores/activeKimpay.svelte.js';
  import { offlineStore } from '#lib/stores/offline.svelte.js';
  import { formatAmount } from '#lib/services/currency.js';
  import { activityTime, listActivity, markActivitySeen, type Activity, type ExpenseSnapshot } from '#lib/services/activity.js';
  import { dayLabel, groupByDay, parseLocalISODate, toLocalISODate } from '#lib/utils/date.js';
  import { DEFAULT_EXPENSE_EMOJI } from '#lib/constants.js';
  import type { TranslationKey } from '#lib/locales/en.js';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import IconTile from '#lib/components/ui/IconTile.svelte';
  import ListGroup from '#lib/components/ui/ListGroup.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import SectionLabel from '#lib/components/ui/SectionLabel.svelte';
  import { Button } from '#lib/components/ui/button/index.js';

  const ctx = getActiveKimpayContext();
  let activeKimpay = $derived(ctx.value);
  let kimpayId = $derived(activeKimpay?.id ?? '');
  let myId = $derived(activeKimpay?.myParticipantId ?? null);

  let activities = $state<Activity[] | null>(null);
  let failed = $state(false);

  let isRetrying = $state(false);

  function load(id: string): Promise<void> {
      return listActivity(id)
          .then((list) => {
              activities = list;
              failed = false;
          })
          .catch((e) => {
              console.error("Failed to load the history", e);
              failed = true;
          });
  }

  async function retry() {
      isRetrying = true;
      await load(kimpayId);
      isRetrying = false;
  }

  // Loaded again whenever the group changes (its `updated` follows every change).
  $effect(() => {
      const id = kimpayId;
      void activeKimpay?.kimpay?.updated;
      if (!id || offlineStore.isOffline) return;
      load(id);
  });

  // Seen: no longer counted as news on the expense list.
  $effect(() => {
      if (kimpayId && activities) markActivitySeen(kimpayId);
  });

  // By day, in the user's timezone.
  let days = $derived(
      groupByDay((activities ?? []).map((a) => ({ ...a, date: toLocalISODate(new Date(activityTime(a))) })))
  );

  const ACTION_KEYS: Record<Activity['action'], TranslationKey> = {
      expense_created: 'activity.expense_created',
      expense_updated: 'activity.expense_updated',
      expense_deleted: 'activity.expense_deleted',
      reimbursement_created: 'activity.reimbursement_created',
      reimbursement_deleted: 'activity.reimbursement_deleted',
      participant_added: 'activity.participant_added',
      participant_renamed: 'activity.participant_renamed',
      participant_deleted: 'activity.participant_deleted',
      participants_merged: 'activity.participants_merged',
      participant_payment_changed: 'activity.participant_payment_changed',
      participant_defaults_changed: 'activity.participant_defaults_changed',
      currency_changed: 'activity.currency_changed',
  };

  function isExpense(a: Activity): boolean {
      return a.action.startsWith('expense_') || a.action.startsWith('reimbursement_');
  }

  /** The line's subject: the expense, "Paul → Léa", or the member(s). */
  function subject(a: Activity): string {
      const d = a.data;
      if (a.action.startsWith('reimbursement_')) return `${d.payer ?? '?'} → ${d.involved?.[0] ?? '?'}`;
      if (isExpense(a)) return d.description ?? '';
      if (a.action === 'participant_renamed' || a.action === 'currency_changed') return `${d.from} → ${d.to}`;
      if (a.action === 'participants_merged') return `${d.from} → ${d.into}`;
      return d.name ?? '';
  }

  /** "Expense edited · Léa · 14:32" */
  function meta(a: Activity): string {
      const who = a.actor && a.actor === myId ? $t('common.you') : a.actor_name;
      const time = new Date(activityTime(a)).toLocaleTimeString($locale, { hour: '2-digit', minute: '2-digit' });
      return [$t(ACTION_KEYS[a.action]), who, time].filter(Boolean).join(' · ');
  }

  const FIELD_KEYS: Partial<Record<keyof ExpenseSnapshot, TranslationKey>> = {
      description: 'expense.form.desc_label',
      amount: 'expense.form.amount_label',
      currency: 'expense.form.amount_label',
      date: 'expense.form.date_label',
      payer: 'expense.form.paid_by_label',
      involved: 'expense.list.for',
      split: 'expense.split.label',
      income: 'activity.field.type',
      photos: 'expense.form.photos_label',
      icon: 'activity.field.icon',
  };

  const SPLIT_KEYS: Record<string, TranslationKey> = {
      equal: 'expense.split.equal',
      shares: 'expense.split.shares',
      amounts: 'expense.split.amounts',
      percent: 'expense.split.percent',
  };

  function show(field: keyof ExpenseSnapshot, s: ExpenseSnapshot): string {
      switch (field) {
          case 'amount':
          case 'currency':
              return formatAmount(s.amount, s.currency, $locale);
          case 'date':
              return parseLocalISODate(s.date).toLocaleDateString($locale, { day: 'numeric', month: 'short' });
          case 'involved':
              return s.involved.join(', ');
          case 'split':
              return $t(SPLIT_KEYS[s.split] ?? 'expense.split.equal');
          case 'income':
              return s.income ? $t('expense.type.income') : $t('activity.type.expense');
          default:
              return String(s[field]);
      }
  }

  /** "PayPal: alice → bob", one line per service changed. */
  function handleChanges(a: Activity): string[] {
      const services = [['PayPal', a.data.paypal], ['Revolut', a.data.revolut]] as const;
      return services
          .filter(([, change]) => change)
          .map(([field, change]) => $t('activity.change', { field, before: change!.from || '—', after: change!.to || '—' }));
  }

  /** "Ticked by default: Yes → No", "Shares: 1 → 2". */
  function defaultsChanges(a: Activity): string[] {
      const { inactive, default_shares } = a.data;
      const yesNo = (included: boolean) => (included ? $t('common.yes') : $t('common.no'));
      return [
          inactive && $t('activity.change', { field: $t('members.defaults.include'), before: yesNo(!inactive.from), after: yesNo(!inactive.to) }),
          default_shares && $t('activity.change', { field: $t('members.defaults.shares'), before: String(default_shares.from), after: String(default_shares.to) }),
      ].filter((line): line is string => !!line);
  }

  /** "Amount: €84.00 → €92.00", one line per field changed. */
  function changes(a: Activity): string[] {
      const { before, after, changed } = a.data;
      if (!before || !after || !changed) return [];
      // Amount and currency read as one.
      const fields = changed.filter((f, i) => FIELD_KEYS[f] && !(f === 'currency' && changed.includes('amount')) && changed.indexOf(f) === i);
      return fields.map((f) => $t('activity.change', { field: $t(FIELD_KEYS[f]!), before: show(f, before), after: show(f, after) }));
  }
</script>

<div class="mx-auto w-full max-w-2xl space-y-5 px-4 py-4">
    <div class="flex items-center gap-1">
        <a
            href="/k/{kimpayId}/settings"
            class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={$t('nav.group')}
            title={$t('nav.group')}
        >
            <ChevronLeft class="h-5 w-5" />
        </a>
        <h1 class="text-xl font-bold">{$t('activity.title')}</h1>
    </div>

    {#if offlineStore.isOffline && !activities}
        <EmptyState title={$t('common.offline')} description={$t('activity.offline')}>
            {#snippet icon()}<CloudOff class="h-12 w-12" />{/snippet}
        </EmptyState>
    {:else if failed && !activities}
        <EmptyState title={$t('error.generic.title')} description={$t('error.generic')}>
            {#snippet icon()}<History class="h-12 w-12" />{/snippet}
            {#snippet action()}
                <Button variant="outline" onclick={retry} loading={isRetrying}>{$t('common.retry')}</Button>
            {/snippet}
        </EmptyState>
    {:else if !activities}
        <ListSkeleton count={4} />
    {:else if activities.length === 0}
        <EmptyState title={$t('activity.empty.title')} description={$t('activity.empty.desc')}>
            {#snippet icon()}<History class="h-12 w-12" />{/snippet}
        </EmptyState>
    {:else}
        {#each days as day (day.key)}
            <section class="space-y-2">
                <SectionLabel title={dayLabel(day.key, $locale, { today: $t('datepicker.today'), yesterday: $t('date.yesterday') })} />
                <ListGroup>
                    {#each day.items as a (a.id)}
                        {@const deleted = a.action.endsWith('_deleted')}
                        {@const lines = a.action === 'expense_updated' ? changes(a) : a.action === 'participant_payment_changed' ? handleChanges(a) : a.action === 'participant_defaults_changed' ? defaultsChanges(a) : []}
                        <div class="flex items-start gap-3 px-4 py-3" data-activity={a.action}>
                            <IconTile size="sm" tone={a.action.startsWith('reimbursement_') ? 'success' : 'muted'} class="mt-0.5 text-foreground">
                                {#if isExpense(a) && !a.action.startsWith('reimbursement_')}
                                    {a.data.icon || DEFAULT_EXPENSE_EMOJI}
                                {:else}
                                    <Users />
                                {/if}
                            </IconTile>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-base font-medium {deleted ? 'text-muted-foreground line-through' : ''}">{subject(a)}</p>
                                <p class="truncate text-sm text-muted-foreground">{meta(a)}</p>
                                {#if lines.length > 0}
                                    <ul class="mt-1 space-y-0.5 text-sm">
                                        {#each lines as line (line)}
                                            <li class="break-words">{line}</li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                            {#if isExpense(a) && a.data.amount !== undefined && a.action !== 'expense_updated'}
                                <span class="shrink-0 text-base font-semibold tabular-nums {deleted ? 'text-muted-foreground line-through' : ''}">
                                    {formatAmount(a.data.amount, a.data.currency ?? '', $locale)}
                                </span>
                            {/if}
                        </div>
                    {/each}
                </ListGroup>
            </section>
        {/each}
    {/if}
</div>
