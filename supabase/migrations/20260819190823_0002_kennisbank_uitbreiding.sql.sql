/*
# Kennisbank uitbreiding: toetsvormen, rooster, gestructureerde lesstof

## Wat deze migratie doet

1. **Nieuwe tabel: test_types** —Configureerbare toetsvormen per gezin (SO, MO, toetsweek, etc.)
   met studie-advies (hoe vaak leren, hoe ver van tevoren beginnen).
2. **Nieuwe kolom op planning_items: test_type_id** — koppelt een toets aan een toetsvorm.
3. **Nieuwe tabel: schedules** — wekelijks rooster per gezin (1 rij per gezin).
4. **Nieuwe tabel: schedule_blocks** — lesuren, pauzes en reistijd binnen een rooster
   (dag van week, start/eindtijd, type, optioneel vak).
5. **Kolommen toegevoegd aan materials** — source_type, chapter, assignment, image_urls,
   original_file_url, processing_status. Hiermee wordt de kennisbank gestructureerd:
   de AI kan per hoofdstuk/opdracht refereren en afbeeldingen tonen in uitleg.
6. **RLS** op alle nieuwe tabellen, scoped per gezin (zelfde patroon als bestaande tabellen).

## Nieuwe tabellen

- **test_types**: id, family_id, name, color, study_sessions (aantal aanbevolen leermomenten),
  lead_days (hoeveel dagen van tevoren beginnen), description, created_at
- **schedules**: id, family_id, created_at (1 rij per gezin)
- **schedule_blocks**: id, schedule_id, day_of_week (0=zo..6=za), start_time, end_time,
  block_type (les, pauze, reis, vrij), subject_id, label, created_at

## Gewijzigde tabellen

- **planning_items**: kolom test_type_id toegevoegd (nullable, verwijst naar test_types)
- **materials**: kolommen toegevoegd:
  - source_type (text: 'tekst'|'pdf'|'afbeelding'|'handmatig', default 'handmatig')
  - chapter (text, nullable — bijv. "Hoofdstuk 3")
  - assignment (text, nullable — bijv. "Opdracht 5")
  - image_urls (text[], default '{}' — array met storage-URLs van geëxtraheerde afbeeldingen)
  - original_file_url (text, nullable — URL naar origineel bestand in storage)
  - processing_status (text: 'klaar'|'verwerkt'|'fout', default 'klaar')

## Beveiliging

- RLS ingeschakeld op test_types, schedules, schedule_blocks.
- test_types: ouder beheert (insert/update/delete), hele gezin leest.
- schedules + schedule_blocks: ouder beheert, hele gezin leest.
- materials: bestaande policies blijven gelden; nieuwe kolommen worden automatisch
  afgedekt door de bestaande SELECT/INSERT policies.
*/

-- ---------------------------------------------------------------------------
-- Toetsvormen (SO, MO, toetsweek, etc.) met studie-advies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  study_sessions int NOT NULL DEFAULT 3,
  lead_days int NOT NULL DEFAULT 7,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_types_family_id_idx ON public.test_types (family_id);

ALTER TABLE public.test_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_types: select family" ON public.test_types;
CREATE POLICY "test_types: select family" ON public.test_types
  FOR SELECT USING (family_id = public.current_family_id());

DROP POLICY IF EXISTS "test_types: insert by ouder" ON public.test_types;
CREATE POLICY "test_types: insert by ouder" ON public.test_types
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');

DROP POLICY IF EXISTS "test_types: update by ouder" ON public.test_types;
CREATE POLICY "test_types: update by ouder" ON public.test_types
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

DROP POLICY IF EXISTS "test_types: delete by ouder" ON public.test_types;
CREATE POLICY "test_types: delete by ouder" ON public.test_types
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

-- ---------------------------------------------------------------------------
-- Kolom test_type_id op planning_items
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planning_items' AND column_name = 'test_type_id'
  ) THEN
    ALTER TABLE public.planning_items
      ADD COLUMN test_type_id uuid REFERENCES public.test_types (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Uitgebreide materials-kolommen voor gestructureerde kennisbank
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE public.materials
      ADD COLUMN source_type text NOT NULL DEFAULT 'handmatig'
      CHECK (source_type IN ('tekst', 'pdf', 'afbeelding', 'handmatig'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'chapter'
  ) THEN
    ALTER TABLE public.materials ADD COLUMN chapter text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'assignment'
  ) THEN
    ALTER TABLE public.materials ADD COLUMN assignment text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE public.materials ADD COLUMN image_urls text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'original_file_url'
  ) THEN
    ALTER TABLE public.materials ADD COLUMN original_file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.materials ADD COLUMN processing_status text NOT NULL DEFAULT 'klaar'
      CHECK (processing_status IN ('klaar', 'verwerkt', 'fout'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS materials_subject_chapter_idx
  ON public.materials (subject_id, chapter);

-- ---------------------------------------------------------------------------
-- Rooster: schedules (1 per gezin) + schedule_blocks (lesuren, reistijd, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL UNIQUE REFERENCES public.families (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedules: select family" ON public.schedules;
CREATE POLICY "schedules: select family" ON public.schedules
  FOR SELECT USING (family_id = public.current_family_id());

DROP POLICY IF EXISTS "schedules: insert by ouder" ON public.schedules;
CREATE POLICY "schedules: insert by ouder" ON public.schedules
  FOR INSERT WITH CHECK (family_id = public.current_family_id() AND public.current_role() = 'ouder');

DROP POLICY IF EXISTS "schedules: update by ouder" ON public.schedules;
CREATE POLICY "schedules: update by ouder" ON public.schedules
  FOR UPDATE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

DROP POLICY IF EXISTS "schedules: delete by ouder" ON public.schedules;
CREATE POLICY "schedules: delete by ouder" ON public.schedules
  FOR DELETE USING (family_id = public.current_family_id() AND public.current_role() = 'ouder');

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules (id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  block_type text NOT NULL CHECK (block_type IN ('les', 'pauze', 'reis', 'vrij'))
    DEFAULT 'les',
  subject_id uuid REFERENCES public.subjects (id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_blocks_schedule_idx
  ON public.schedule_blocks (schedule_id, day_of_week, start_time);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_blocks: select family" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks: select family" ON public.schedule_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_blocks.schedule_id
      AND schedules.family_id = public.current_family_id()
    )
  );

DROP POLICY IF EXISTS "schedule_blocks: insert by ouder" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks: insert by ouder" ON public.schedule_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_blocks.schedule_id
      AND schedules.family_id = public.current_family_id()
      AND public.current_role() = 'ouder'
    )
  );

DROP POLICY IF EXISTS "schedule_blocks: update by ouder" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks: update by ouder" ON public.schedule_blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_blocks.schedule_id
      AND schedules.family_id = public.current_family_id()
      AND public.current_role() = 'ouder'
    )
  );

DROP POLICY IF EXISTS "schedule_blocks: delete by ouder" ON public.schedule_blocks;
CREATE POLICY "schedule_blocks: delete by ouder" ON public.schedule_blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_blocks.schedule_id
      AND schedules.family_id = public.current_family_id()
      AND public.current_role() = 'ouder'
    )
  );
