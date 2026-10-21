-- profiles: done right
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  plan text default 'free'
);
alter table public.profiles enable row level security;
create policy "Users manage their own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- notes: RLS forgotten
create table public.notes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users,
  content text
);

-- payments: RLS turned off to "fix" a permission error
create table if not exists payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users,
  amount_cents int
);
alter table payments enable row level security;
alter table payments disable row level security;
