-- Adaptive Mock Interviewer — initial schema + RLS
-- Content (interviews) is separated from candidate data (sessions/feedback) at the
-- TABLE level; per-candidate tables are scoped via RLS keyed on auth.uid()
-- (Supabase Anonymous Auth issues a real JWT, so this is enforced, not cosmetic).

create extension if not exists pgcrypto;

-- Shared, shareable interview config + cached Plan. No candidate data.
create table if not exists interviews (
  id          uuid primary key default gen_random_uuid(),
  config_hash text unique not null,
  jd_text     text not null,
  guidelines  jsonb not null,
  plan        jsonb not null,
  created_at  timestamptz not null default now()
);

-- One row per (anonymous) candidate; id equals auth.uid().
create table if not exists candidates (
  id         uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id                uuid primary key default gen_random_uuid(),
  interview_id      uuid not null references interviews(id) on delete cascade,
  candidate_id      uuid not null references candidates(id) on delete cascade,
  el_conversation_id text,
  status            text not null default 'created',
  started_at        timestamptz,
  ended_at          timestamptz,
  recording_url     text,
  transcript        jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists feedback (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  report     jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_candidate_idx on sessions(candidate_id);
create index if not exists feedback_session_idx on feedback(session_id);

-- Row Level Security
alter table interviews enable row level security;
alter table candidates enable row level security;
alter table sessions   enable row level security;
alter table feedback   enable row level security;

-- interviews: shareable content — any authenticated user may read; insert allowed
-- (the server uses the service role; this also permits a future client-side path).
drop policy if exists interviews_read on interviews;
create policy interviews_read on interviews
  for select to authenticated using (true);
drop policy if exists interviews_insert on interviews;
create policy interviews_insert on interviews
  for insert to authenticated with check (true);

-- candidates: a user may only touch their own row.
drop policy if exists candidates_self on candidates;
create policy candidates_self on candidates
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- sessions: scoped to the owning candidate.
drop policy if exists sessions_owner on sessions;
create policy sessions_owner on sessions
  for all to authenticated using (candidate_id = auth.uid()) with check (candidate_id = auth.uid());

-- feedback: scoped via the parent session's candidate.
drop policy if exists feedback_owner on feedback;
create policy feedback_owner on feedback
  for all to authenticated
  using (exists (select 1 from sessions s where s.id = feedback.session_id and s.candidate_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = feedback.session_id and s.candidate_id = auth.uid()));
