create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,        -- 'text' | 'voice'
  billed_as text not null,   -- 'free_trial' | 'subscription' | 'free_text'
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on usage_events(user_id, created_at);
alter table usage_events enable row level security;
drop policy if exists usage_self on usage_events;
create policy usage_self on usage_events for select to authenticated using (user_id = auth.uid());
