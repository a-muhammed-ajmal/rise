create table if not exists categories (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         references auth.users not null,
  name        text         not null,
  type        text         not null check (type in ('income', 'expense')),
  created_at  timestamptz  default now() not null,
  unique (user_id, name, type)
);

alter table categories enable row level security;

create policy "Users can manage their own categories"
  on categories for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
