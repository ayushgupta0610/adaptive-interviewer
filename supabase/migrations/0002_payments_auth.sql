-- Profiles: one row per auth user; tracks the one-time free trial.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  free_trial_used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,                 -- 'starter' | 'pro'
  name text not null,
  price_inr integer not null,
  monthly_session_quota integer not null,
  provider_plan_id text,               -- Cashfree plan id
  active boolean not null default true
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references plans(id),
  provider text not null default 'cashfree',
  provider_subscription_id text unique,
  status text not null default 'pending',  -- pending|active|past_due|cancelled|expired (fail closed: not entitled until the webhook confirms payment)
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on subscriptions(user_id);

-- Per-session metering on the existing sessions table.
alter table sessions add column if not exists mode text;             -- 'text' | 'voice'
alter table sessions add column if not exists est_cost_usd numeric;  -- from src/lib/cost.ts
alter table sessions add column if not exists billed_as text;        -- 'free_trial'|'subscription'|'free_text'

alter table profiles enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select to authenticated using (id = auth.uid());
drop policy if exists plans_read on plans;
create policy plans_read on plans for select to authenticated using (true);
drop policy if exists subscriptions_self on subscriptions;
create policy subscriptions_self on subscriptions for select to authenticated using (user_id = auth.uid());
-- Writes to profiles/subscriptions happen via the service role (gating + webhooks), which bypasses RLS.

insert into plans (id, name, price_inr, monthly_session_quota) values
  ('starter','Plus',299,3),
  ('pro','Pro',699,10)
on conflict (id) do update set
  name = excluded.name,
  price_inr = excluded.price_inr,
  monthly_session_quota = excluded.monthly_session_quota;

-- Create a profile row automatically on signup.
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
