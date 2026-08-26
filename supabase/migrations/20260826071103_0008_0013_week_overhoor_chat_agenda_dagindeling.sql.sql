/*
# Week-terugblik, overhoor-sessies, chat-retentie, agenda-capaciteit, werkelijke duur, dagindeling

1. New Tables
- week_terugblikken: wekelijkse duimpjes-vraag ("hoe ging je week?")
- overhoor_sessies: log van afgeronde overhoor-/oefensessies (score per beoordeling)
- opdracht_berichten: chatgeschiedenis voor "opdracht maken"-flow
- planningshulp_berichten: chatgeschiedenis voor planningshulp
- dag_instellingen: dagindeling per weekdag (ochtend/avond/eten)
2. Modified Tables
- overhoor_sessies: +transcript jsonb (toegevoegd in zelfde migratie)
- chat_messages: +delete policy voor ouder (opschonen)
- overhoor_sessies: +update policy voor ouder (transcript legen)
- families: +avond_grens time (avondgrens voor planning)
- planning_items: +actual_minutes int (werkelijke duur)
3. Security
- RLS on all new tables
- Policies: kind ziet eigen data, ouder mag meelezen en beheren
*/

CREATE TABLE IF NOT EXISTS public.week_terugblikken (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  stemming text not null check (stemming in ('goed', 'neutraal', 'moeilijk')),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS week_terugblikken_family_idx ON public.week_terugblikken (family_id, week_start);

ALTER TABLE public.week_terugblikken ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "week_terugblik: select own or ouder" ON public.week_terugblikken;
CREATE POLICY "week_terugblik: select own or ouder" ON public.week_terugblikken
  FOR SELECT USING (family_id = public.current_family_id() AND (user_id = auth.uid() OR public.current_role() = 'ouder'));
DROP POLICY IF EXISTS "week_terugblik: insert own" ON public.week_terugblikken;
CREATE POLICY "week_terugblik: insert own" ON public.week_terugblikken
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS "week_terugblik: update own" ON public.week_terugblikken;
CREATE POLICY "week_terugblik: update own" ON public.week_terugblikken
  FOR UPDATE USING (family_id = public.current_family_id() AND user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.overhoor_sessies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  leerfase text not null check (leerfase in ('eerste', 'tussentijds', 'laatste')),
  aantal_goed integer not null default 0,
  aantal_deels integer not null default 0,
  aantal_fout integer not null default 0,
  transcript jsonb not null default '[]',
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS overhoor_sessies_subject_idx ON public.overhoor_sessies (subject_id, created_at);
CREATE INDEX IF NOT EXISTS overhoor_sessies_family_idx ON public.overhoor_sessies (family_id, created_at);

ALTER TABLE public.overhoor_sessies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overhoor_sessies: select own or ouder" ON public.overhoor_sessies;
CREATE POLICY "overhoor_sessies: select own or ouder" ON public.overhoor_sessies
  FOR SELECT USING (family_id = public.current_family_id() AND (user_id = auth.uid() OR public.current_role() = 'ouder'));
DROP POLICY IF EXISTS "overhoor_sessies: insert own" ON public.overhoor_sessies;
CREATE POLICY "overhoor_sessies: insert own" ON public.overhoor_sessies
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS "overhoor_sessies: update transcript by ouder" ON public.overhoor_sessies;
CREATE POLICY "overhoor_sessies: update transcript by ouder" ON public.overhoor_sessies
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

CREATE TABLE IF NOT EXISTS public.opdracht_berichten (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS opdracht_berichten_subject_user_idx ON public.opdracht_berichten (subject_id, user_id, created_at);

CREATE TABLE IF NOT EXISTS public.planningshulp_berichten (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS planningshulp_berichten_user_idx ON public.planningshulp_berichten (user_id, created_at);

ALTER TABLE public.opdracht_berichten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planningshulp_berichten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opdracht: select own or ouder" ON public.opdracht_berichten;
CREATE POLICY "opdracht: select own or ouder" ON public.opdracht_berichten
  FOR SELECT USING (family_id = public.current_family_id() AND (user_id = auth.uid() OR public.current_role() = 'ouder'));
DROP POLICY IF EXISTS "opdracht: insert own" ON public.opdracht_berichten;
CREATE POLICY "opdracht: insert own" ON public.opdracht_berichten
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS "opdracht: delete by ouder" ON public.opdracht_berichten;
CREATE POLICY "opdracht: delete by ouder" ON public.opdracht_berichten
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

DROP POLICY IF EXISTS "planningshulp: select own or ouder" ON public.planningshulp_berichten;
CREATE POLICY "planningshulp: select own or ouder" ON public.planningshulp_berichten
  FOR SELECT USING (family_id = public.current_family_id() AND (user_id = auth.uid() OR public.current_role() = 'ouder'));
DROP POLICY IF EXISTS "planningshulp: insert own" ON public.planningshulp_berichten;
CREATE POLICY "planningshulp: insert own" ON public.planningshulp_berichten
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND user_id = auth.uid());
DROP POLICY IF EXISTS "planningshulp: delete by ouder" ON public.planningshulp_berichten;
CREATE POLICY "planningshulp: delete by ouder" ON public.planningshulp_berichten
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

DROP POLICY IF EXISTS "chat: delete by ouder" ON public.chat_messages;
CREATE POLICY "chat: delete by ouder" ON public.chat_messages
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS avond_grens time not null default '20:30';

ALTER TABLE public.planning_items
  ADD COLUMN IF NOT EXISTS actual_minutes int;

CREATE TABLE IF NOT EXISTS public.dag_instellingen (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  dag_van_week int not null check (dag_van_week between 1 and 7),
  ochtend_start time not null default '07:00',
  avond_grens time not null default '20:30',
  eten_minuten int not null default 60 check (eten_minuten >= 0 and eten_minuten <= 180),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (family_id, dag_van_week)
);

ALTER TABLE public.dag_instellingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dag_instellingen: select binnen gezin" ON public.dag_instellingen;
CREATE POLICY "dag_instellingen: select binnen gezin" ON public.dag_instellingen
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "dag_instellingen: ouder beheert" ON public.dag_instellingen;
CREATE POLICY "dag_instellingen: ouder beheert" ON public.dag_instellingen
  FOR SELECT USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "dag_instellingen: ouder insert" ON public.dag_instellingen;
CREATE POLICY "dag_instellingen: ouder insert" ON public.dag_instellingen
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "dag_instellingen: ouder update" ON public.dag_instellingen;
CREATE POLICY "dag_instellingen: ouder update" ON public.dag_instellingen
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder')
  WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');
DROP POLICY IF EXISTS "dag_instellingen: ouder delete" ON public.dag_instellingen;
CREATE POLICY "dag_instellingen: ouder delete" ON public.dag_instellingen
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');
