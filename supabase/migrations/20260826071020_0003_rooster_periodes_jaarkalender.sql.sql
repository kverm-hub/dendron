/*
# Roosterperiodes, uitzonderingen en jaarkalender

1. New Tables
- rooster_periodes: Periode met geldigheidsbereik (periode 1/2/3/4) voor rooster
- rooster_uitzonderingen: Uitzonderingen op rooster voor specifieke datum (vervallen/gewijzigd/extra)
- jaar_events: Belangrijke periodes voor hele jaar (vakanties, toetsweken)
2. Modified Tables
- rooster_items: +periode_id (verwijzing naar rooster_periodes, NOT NULL)
3. Security
- RLS enabled on all new tables
- Policies: gezin leest, alleen ouder beheert
*/

CREATE TABLE IF NOT EXISTS public.rooster_periodes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  naam text not null,
  start_datum date not null,
  eind_datum date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint rooster_periodes_datum_check check (eind_datum > start_datum)
);

CREATE INDEX IF NOT EXISTS rooster_periodes_family_id_idx ON public.rooster_periodes (family_id);

DELETE FROM public.rooster_items;

ALTER TABLE public.rooster_items
  ADD COLUMN IF NOT EXISTS periode_id uuid references public.rooster_periodes (id) on delete cascade;

DO $$ BEGIN
  ALTER TABLE public.rooster_items ALTER COLUMN periode_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS rooster_items_periode_id_idx ON public.rooster_items (periode_id);

CREATE TABLE IF NOT EXISTS public.rooster_uitzonderingen (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  datum date not null,
  origineel_item_id uuid references public.rooster_items (id) on delete set null,
  type text not null check (type in ('vervallen', 'gewijzigd', 'extra')),
  titel text,
  subject_id uuid references public.subjects (id) on delete set null,
  start_tijd time,
  eind_tijd time,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS rooster_uitzonderingen_family_datum_idx ON public.rooster_uitzonderingen (family_id, datum);

CREATE TABLE IF NOT EXISTS public.jaar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  titel text not null,
  start_datum date not null,
  eind_datum date not null,
  type text not null check (type in ('vakantie', 'toetsweek', 'anders')) default 'anders',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint jaar_events_datum_check check (eind_datum >= start_datum)
);

CREATE INDEX IF NOT EXISTS jaar_events_family_id_idx ON public.jaar_events (family_id);

ALTER TABLE public.rooster_periodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooster_uitzonderingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jaar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooster_periodes: select family" ON public.rooster_periodes;
CREATE POLICY "rooster_periodes: select family" ON public.rooster_periodes
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "rooster_periodes: insert by ouder" ON public.rooster_periodes;
CREATE POLICY "rooster_periodes: insert by ouder" ON public.rooster_periodes
  FOR INSERT WITH CHECK (family_id = public.current_family_id() and public.current_role() = 'ouder');
DROP POLICY IF EXISTS "rooster_periodes: update by ouder" ON public.rooster_periodes;
CREATE POLICY "rooster_periodes: update by ouder" ON public.rooster_periodes
  FOR UPDATE USING (family_id = public.current_family_id() and public.current_role() = 'ouder');
DROP POLICY IF EXISTS "rooster_periodes: delete by ouder" ON public.rooster_periodes;
CREATE POLICY "rooster_periodes: delete by ouder" ON public.rooster_periodes
  FOR DELETE USING (family_id = public.current_family_id() and public.current_role() = 'ouder');

DROP POLICY IF EXISTS "rooster_uitzonderingen: select family" ON public.rooster_uitzonderingen;
CREATE POLICY "rooster_uitzonderingen: select family" ON public.rooster_uitzonderingen
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "rooster_uitzonderingen: insert by ouder" ON public.rooster_uitzonderingen;
CREATE POLICY "rooster_uitzonderingen: insert by ouder" ON public.rooster_uitzonderingen
  FOR INSERT WITH CHECK (family_id = public.current_family_id() and public.current_role() = 'ouder');
DROP POLICY IF EXISTS "rooster_uitzonderingen: update by ouder" ON public.rooster_uitzonderingen;
CREATE POLICY "rooster_uitzonderingen: update by ouder" ON public.rooster_uitzonderingen
  FOR UPDATE USING (family_id = public.current_family_id() and public.current_role() = 'ouder');
DROP POLICY IF EXISTS "rooster_uitzonderingen: delete by ouder" ON public.rooster_uitzonderingen;
CREATE POLICY "rooster_uitzonderingen: delete by ouder" ON public.rooster_uitzonderingen
  FOR DELETE USING (family_id = public.current_family_id() and public.current_role() = 'ouder');

DROP POLICY IF EXISTS "jaar_events: select family" ON public.jaar_events;
CREATE POLICY "jaar_events: select family" ON public.jaar_events
  FOR SELECT USING (family_id = public.current_family_id());
DROP POLICY IF EXISTS "jaar_events: insert by ouder" ON public.jaar_events;
CREATE POLICY "jaar_events: insert by ouder" ON public.jaar_events
  FOR INSERT WITH CHECK (family_id = public.current_family_id() and public.current_role() = 'ouder');
DROP POLICY IF EXISTS "jaar_events: update by ouder" ON public.jaar_events;
CREATE POLICY "jaar_events: update by ouder" ON public.jaar_events
  FOR UPDATE USING (family_id = public.current_family_id() and public.current_role() = 'ouder');
DROP POLICY IF EXISTS "jaar_events: delete by ouder" ON public.jaar_events;
CREATE POLICY "jaar_events: delete by ouder" ON public.jaar_events
  FOR DELETE USING (family_id = public.current_family_id() and public.current_role() = 'ouder');
