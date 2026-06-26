create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  reminder_types text[] not null default array['habit_nudge', 'crm_followup'],
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on push_subscriptions
  for select using (user_id = auth.uid());
create policy "push_subscriptions_insert_own" on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "push_subscriptions_delete_own" on push_subscriptions
  for delete using (user_id = auth.uid());