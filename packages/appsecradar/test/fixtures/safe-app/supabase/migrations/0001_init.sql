create table public.todos (id bigint primary key, user_id uuid, title text);
create table private.audit_log (id bigint primary key, event text);

-- RLS enabled in a separate statement later on, which is fine.
alter table public.todos enable row level security;
create policy "own todos" on public.todos for all using (auth.uid() = user_id);
