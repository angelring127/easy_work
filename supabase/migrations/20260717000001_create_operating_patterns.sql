CREATE TABLE IF NOT EXISTS store_auto_schedule_operating_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 1 CHECK (sort_order >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, id)
);

CREATE TABLE IF NOT EXISTS store_auto_schedule_pattern_weekdays (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pattern_id UUID NOT NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, weekday),
  FOREIGN KEY (store_id, pattern_id)
    REFERENCES store_auto_schedule_operating_patterns(store_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_auto_schedule_pattern_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pattern_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  start_min INT NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min INT NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
  min_headcount INT NOT NULL CHECK (min_headcount BETWEEN 1 AND 99),
  sort_order INT NOT NULL DEFAULT 1 CHECK (sort_order >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  CHECK (start_min < end_min),
  FOREIGN KEY (store_id, pattern_id)
    REFERENCES store_auto_schedule_operating_patterns(store_id, id)
    ON DELETE CASCADE
);

DO $$ BEGIN
  ALTER TABLE store_job_roles
  ADD CONSTRAINT store_job_roles_store_id_id_key UNIQUE (store_id, id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS store_auto_schedule_segment_roles (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL,
  job_role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_id, job_role_id),
  FOREIGN KEY (store_id, segment_id)
    REFERENCES store_auto_schedule_pattern_segments(store_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (store_id, job_role_id)
    REFERENCES store_job_roles(store_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operating_patterns_store
  ON store_auto_schedule_operating_patterns(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pattern_weekdays_pattern
  ON store_auto_schedule_pattern_weekdays(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_segments_pattern
  ON store_auto_schedule_pattern_segments(pattern_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_segment_roles_store
  ON store_auto_schedule_segment_roles(store_id, segment_id);

DO $$ BEGIN
  CREATE TRIGGER trg_operating_patterns_updated_at
  BEFORE UPDATE ON store_auto_schedule_operating_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_pattern_weekdays_updated_at
  BEFORE UPDATE ON store_auto_schedule_pattern_weekdays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_pattern_segments_updated_at
  BEFORE UPDATE ON store_auto_schedule_pattern_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_segment_roles_updated_at
  BEFORE UPDATE ON store_auto_schedule_segment_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE store_auto_schedule_operating_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_auto_schedule_pattern_weekdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_auto_schedule_pattern_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_auto_schedule_segment_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_auto_schedule_operating_patterns"
  ON store_auto_schedule_operating_patterns;
CREATE POLICY "sel_auto_schedule_operating_patterns"
ON store_auto_schedule_operating_patterns
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_auto_schedule_operating_patterns.store_id
      AND s.owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_operating_patterns.store_id
      AND r.user_id = (SELECT auth.uid())
      AND r.status = 'ACTIVE'
  )
);

DROP POLICY IF EXISTS "wr_auto_schedule_operating_patterns"
  ON store_auto_schedule_operating_patterns;
CREATE POLICY "wr_auto_schedule_operating_patterns"
ON store_auto_schedule_operating_patterns
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_auto_schedule_operating_patterns.store_id
      AND s.owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_operating_patterns.store_id
      AND r.user_id = (SELECT auth.uid())
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER', 'SUB_MANAGER')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_auto_schedule_operating_patterns.store_id
      AND s.owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_operating_patterns.store_id
      AND r.user_id = (SELECT auth.uid())
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER', 'SUB_MANAGER')
  )
);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'store_auto_schedule_pattern_weekdays',
    'store_auto_schedule_pattern_segments',
    'store_auto_schedule_segment_roles'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'sel_' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM stores s WHERE s.id = %I.store_id AND s.owner_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM user_store_roles r WHERE r.store_id = %I.store_id AND r.user_id = (SELECT auth.uid()) AND r.status = ''ACTIVE'')
      )',
      'sel_' || table_name,
      table_name,
      table_name,
      table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'wr_' || table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM stores s WHERE s.id = %I.store_id AND s.owner_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM user_store_roles r WHERE r.store_id = %I.store_id AND r.user_id = (SELECT auth.uid()) AND r.status = ''ACTIVE'' AND r.role IN (''MASTER'', ''SUB_MANAGER''))
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM stores s WHERE s.id = %I.store_id AND s.owner_id = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM user_store_roles r WHERE r.store_id = %I.store_id AND r.user_id = (SELECT auth.uid()) AND r.status = ''ACTIVE'' AND r.role IN (''MASTER'', ''SUB_MANAGER''))
      )',
      'wr_' || table_name,
      table_name,
      table_name,
      table_name,
      table_name,
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION replace_store_auto_schedule_operating_patterns(
  p_store_id UUID,
  p_patterns JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  pattern_record JSONB;
  segment_record JSONB;
  weekday_record JSONB;
  role_record JSONB;
BEGIN
  DELETE FROM store_auto_schedule_operating_patterns
  WHERE store_id = p_store_id;

  FOR pattern_record IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_patterns, '[]'::JSONB))
  LOOP
    INSERT INTO store_auto_schedule_operating_patterns (
      id, store_id, name, is_active, sort_order
    ) VALUES (
      (pattern_record->>'id')::UUID,
      p_store_id,
      pattern_record->>'name',
      (pattern_record->>'isActive')::BOOLEAN,
      (pattern_record->>'sortOrder')::INT
    );

    FOR weekday_record IN
      SELECT value FROM jsonb_array_elements(pattern_record->'weekdays')
    LOOP
      INSERT INTO store_auto_schedule_pattern_weekdays (
        store_id, pattern_id, weekday
      ) VALUES (
        p_store_id,
        (pattern_record->>'id')::UUID,
        (weekday_record #>> '{}')::SMALLINT
      );
    END LOOP;

    FOR segment_record IN
      SELECT value FROM jsonb_array_elements(pattern_record->'segments')
    LOOP
      INSERT INTO store_auto_schedule_pattern_segments (
        id, store_id, pattern_id, name, start_min, end_min,
        min_headcount, sort_order
      ) VALUES (
        (segment_record->>'id')::UUID,
        p_store_id,
        (pattern_record->>'id')::UUID,
        segment_record->>'name',
        (segment_record->>'startMin')::INT,
        (segment_record->>'endMin')::INT,
        (segment_record->>'minHeadcount')::INT,
        (segment_record->>'sortOrder')::INT
      );

      FOR role_record IN
        SELECT value FROM jsonb_array_elements(segment_record->'requiredRoleIds')
      LOOP
        INSERT INTO store_auto_schedule_segment_roles (
          store_id, segment_id, job_role_id
        ) VALUES (
          p_store_id,
          (segment_record->>'id')::UUID,
          (role_record #>> '{}')::UUID
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
ON store_auto_schedule_operating_patterns,
   store_auto_schedule_pattern_weekdays,
   store_auto_schedule_pattern_segments,
   store_auto_schedule_segment_roles
TO authenticated;

REVOKE ALL ON FUNCTION replace_store_auto_schedule_operating_patterns(UUID, JSONB)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_store_auto_schedule_operating_patterns(UUID, JSONB)
TO authenticated;
