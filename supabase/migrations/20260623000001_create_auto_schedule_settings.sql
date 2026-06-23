-- =============================================
-- Auto schedule settings
-- =============================================

CREATE TABLE IF NOT EXISTS store_auto_schedule_condition_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  condition_key TEXT NOT NULL CHECK (
    condition_key IN (
      'desired_weekly_hours',
      'day_off_preference',
      'preferred_weekday'
    )
  ),
  priority_rank INT NOT NULL CHECK (priority_rank BETWEEN 1 AND 3),
  weight INT NOT NULL DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, condition_key),
  UNIQUE (store_id, priority_rank)
);

CREATE TABLE IF NOT EXISTS store_auto_schedule_user_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES store_users(id) ON DELETE CASCADE,
  priority_rank INT NOT NULL CHECK (priority_rank >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id),
  UNIQUE (store_id, priority_rank)
);

CREATE TABLE IF NOT EXISTS store_auto_schedule_opening_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  start_source TEXT NOT NULL DEFAULT 'business_open' CHECK (
    start_source IN ('business_open', 'custom')
  ),
  custom_start_min INT CHECK (
    custom_start_min IS NULL OR custom_start_min BETWEEN 0 AND 1440
  ),
  end_min INT CHECK (end_min IS NULL OR end_min BETWEEN 0 AND 1440),
  required_headcount INT NOT NULL DEFAULT 1 CHECK (
    required_headcount BETWEEN 1 AND 99
  ),
  failure_mode TEXT NOT NULL DEFAULT 'warn_and_continue' CHECK (
    failure_mode IN ('warn_and_continue', 'block_commit')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_auto_schedule_opening_work_items (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, work_item_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_schedule_condition_store
  ON store_auto_schedule_condition_priorities(store_id, priority_rank);

CREATE INDEX IF NOT EXISTS idx_auto_schedule_user_store
  ON store_auto_schedule_user_priorities(store_id, priority_rank);

CREATE INDEX IF NOT EXISTS idx_auto_schedule_opening_items_store
  ON store_auto_schedule_opening_work_items(store_id);

DO $$ BEGIN
  CREATE TRIGGER trg_auto_schedule_condition_priorities_updated_at
  BEFORE UPDATE ON store_auto_schedule_condition_priorities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_auto_schedule_user_priorities_updated_at
  BEFORE UPDATE ON store_auto_schedule_user_priorities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_auto_schedule_opening_policies_updated_at
  BEFORE UPDATE ON store_auto_schedule_opening_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE store_auto_schedule_condition_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_auto_schedule_user_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_auto_schedule_opening_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_auto_schedule_opening_work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel_auto_schedule_condition_priorities"
ON store_auto_schedule_condition_priorities
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_condition_priorities.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
  )
);

CREATE POLICY "wr_auto_schedule_condition_priorities"
ON store_auto_schedule_condition_priorities
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_condition_priorities.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_condition_priorities.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
);

CREATE POLICY "sel_auto_schedule_user_priorities"
ON store_auto_schedule_user_priorities
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_user_priorities.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
  )
);

CREATE POLICY "wr_auto_schedule_user_priorities"
ON store_auto_schedule_user_priorities
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_user_priorities.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_user_priorities.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
);

CREATE POLICY "sel_auto_schedule_opening_policies"
ON store_auto_schedule_opening_policies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_opening_policies.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
  )
);

CREATE POLICY "wr_auto_schedule_opening_policies"
ON store_auto_schedule_opening_policies
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_opening_policies.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_opening_policies.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
);

CREATE POLICY "sel_auto_schedule_opening_work_items"
ON store_auto_schedule_opening_work_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_opening_work_items.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
  )
);

CREATE POLICY "wr_auto_schedule_opening_work_items"
ON store_auto_schedule_opening_work_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_opening_work_items.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_store_roles r
    WHERE r.store_id = store_auto_schedule_opening_work_items.store_id
      AND r.user_id = auth.uid()
      AND r.status = 'ACTIVE'
      AND r.role IN ('MASTER','SUB_MANAGER')
  )
);
