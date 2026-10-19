-- PMB Study Room: initial schema.
--
-- Access model
--   * Admins (profiles.role = 'admin') can see and manage everything.
--   * Students get access to a course by redeeming an invite code. A code with
--     course_id = null unlocks every course; otherwise only that course.
--   * Withdrawing a code (invite_codes.revoked_at) removes that access at once,
--     because every content policy goes through has_course_access().
--   * Writes that matter for integrity (redeeming codes, saving scores, tutor
--     rate limiting) go through security-definer functions that only the
--     service role may execute. The browser never gets the service role key.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  role        public.app_role not null default 'student',
  created_at  timestamptz not null default now()
);

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  code        text not null,
  name        text not null,
  book        jsonb not null default '{}'::jsonb,   -- title, edition, authors, publisher, isbn
  parts       jsonb not null default '{}'::jsonb,   -- { "0": "Introduction", ... }
  position    int not null default 0,
  published   boolean not null default true,
  -- Hook for an owner-supplied PDF of the book (only if they have permission).
  -- Path inside the private "course-files" storage bucket. Served to students
  -- through short-lived signed URLs after an access check, never publicly.
  pdf_path    text,
  created_at  timestamptz not null default now()
);

create table public.chapters (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  n           int not null check (n > 0),
  part        int not null default 0,
  title       text not null,
  pages       text not null default '',
  outline     text[] not null default '{}',
  summary     text[] not null default '{}',          -- paragraphs; may contain <mark>, <b>, <i>
  terms       jsonb not null default '[]'::jsonb,     -- [[term, definition], ...]
  unique (course_id, n)
);

-- Question types are open-ended: `type` names a handler in lib/questions and
-- `payload` holds that type's fields (options, answer, accepted answers, ...).
create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  chapter_n    int,
  type         text not null check (type ~ '^[a-z][a-z0-9_]*$'),
  prompt       text not null,
  payload      jsonb not null default '{}'::jsonb,
  explanation  text not null default '',
  source       text not null default 'seed',          -- 'seed' rows are replaced by the seed script
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  foreign key (course_id, chapter_n) references public.chapters (course_id, n) on delete set null (chapter_n)
);
create index questions_course_chapter_idx on public.questions (course_id, chapter_n);

create table public.invite_codes (
  id               uuid primary key default gen_random_uuid(),
  code_hash        text not null unique,             -- HMAC-SHA256 of the normalized code
  code_ciphertext  text not null,                    -- AES-256-GCM, decryptable only by the server
  label            text not null check (char_length(label) between 1 and 80),
  course_id        uuid references public.courses (id) on delete cascade,  -- null = all courses
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz
);

-- One row per redeemed code. The primary key on code_id is what makes a code
-- single-use: a second redemption violates it, whatever the timing.
-- user_id is set null (not cascaded) when a user is deleted, so a used code
-- never becomes usable again.
create table public.code_redemptions (
  code_id      uuid primary key references public.invite_codes (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  redeemed_at  timestamptz not null default now()
);
create index code_redemptions_user_idx on public.code_redemptions (user_id);

create table public.best_scores (
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  test_key    text not null check (test_key ~ '^(mock|ch[0-9]+)$'),
  best_pct    int not null check (best_pct between 0 and 100),
  last_pct    int not null check (last_pct between 0 and 100),
  attempts    int not null default 1,
  updated_at  timestamptz not null default now(),
  primary key (user_id, course_id, test_key)
);

create table public.tutor_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index tutor_messages_user_time_idx on public.tutor_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.has_course_access(p_course_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.code_redemptions r
    join public.invite_codes c on c.id = r.code_id
    where r.user_id = (select auth.uid())
      and c.revoked_at is null
      and (c.course_id is null or c.course_id = p_course_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.courses           enable row level security;
alter table public.chapters          enable row level security;
alter table public.questions         enable row level security;
alter table public.invite_codes      enable row level security;
alter table public.code_redemptions  enable row level security;
alter table public.best_scores       enable row level security;
alter table public.tutor_messages    enable row level security;

-- No insert/update/delete policies anywhere: clients can only read. All writes
-- go through server code using the service role (which bypasses RLS) after
-- the server has checked who is asking.

create policy "own profile or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "signed-in users see published courses" on public.courses
  for select to authenticated
  using (published or public.is_admin());

create policy "chapters for course members" on public.chapters
  for select to authenticated
  using (public.has_course_access(course_id));

create policy "questions for course members" on public.questions
  for select to authenticated
  using (public.has_course_access(course_id));

create policy "admins read codes" on public.invite_codes
  for select to authenticated
  using (public.is_admin());

create policy "admins read redemptions, users read their own" on public.code_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "own scores or admin" on public.best_scores
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "own tutor usage or admin" on public.tutor_messages
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Server-only functions (service role)
-- ---------------------------------------------------------------------------

-- Redeems an invite code for a user, in one transaction:
--   1. lock the code row, so concurrent redemptions of the same code queue up;
--   2. insert into code_redemptions, whose primary key rejects any second use;
--   3. create the profile if this is a new user.
-- Raises 'invalid_code', 'code_revoked' or 'code_used'.
-- Returns the course id the code unlocks (null = all courses).
create function public.redeem_invite_code(p_code_hash text, p_user_id uuid, p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_code public.invite_codes%rowtype;
begin
  select * into v_code
  from public.invite_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    raise exception 'invalid_code';
  end if;
  if v_code.revoked_at is not null then
    raise exception 'code_revoked';
  end if;

  begin
    insert into public.code_redemptions (code_id, user_id) values (v_code.id, p_user_id);
  exception when unique_violation then
    raise exception 'code_used';
  end;

  insert into public.profiles (id, name)
  values (p_user_id, left(btrim(p_name), 80))
  on conflict (id) do nothing;

  return v_code.course_id;
end;
$$;

-- Saves a finished test, keeping the best percentage per (user, course, test).
create function public.record_score(p_user_id uuid, p_course_id uuid, p_test_key text, p_pct int)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.best_scores (user_id, course_id, test_key, best_pct, last_pct)
  values (p_user_id, p_course_id, p_test_key, p_pct, p_pct)
  on conflict (user_id, course_id, test_key) do update
    set best_pct   = greatest(public.best_scores.best_pct, excluded.best_pct),
        last_pct   = excluded.last_pct,
        attempts   = public.best_scores.attempts + 1,
        updated_at = now();
$$;

-- Atomically checks the per-user hourly tutor limit and, if there is room,
-- records the message. Returns true when the message may be sent.
create function public.tutor_take_slot(p_user_id uuid, p_course_id uuid, p_limit int)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_used int;
begin
  perform pg_advisory_xact_lock(hashtextextended('tutor:' || p_user_id::text, 0));
  select count(*) into v_used
  from public.tutor_messages
  where user_id = p_user_id and created_at > now() - interval '1 hour';
  if v_used >= p_limit then
    return false;
  end if;
  insert into public.tutor_messages (user_id, course_id) values (p_user_id, p_course_id);
  return true;
end;
$$;

revoke execute on function public.redeem_invite_code(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.record_score(uuid, uuid, text, int)  from public, anon, authenticated;
revoke execute on function public.tutor_take_slot(uuid, uuid, int)      from public, anon, authenticated;
grant  execute on function public.redeem_invite_code(text, uuid, text) to service_role;
grant  execute on function public.record_score(uuid, uuid, text, int)  to service_role;
grant  execute on function public.tutor_take_slot(uuid, uuid, int)      to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for owner-uploaded course files (book PDF hook).
-- No storage policies are created, so only the service role can read or write;
-- students receive short-lived signed URLs from the server.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;
