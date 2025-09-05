-- =============================================
-- Schedule Extensions: stores, hours/holidays, work_items, staffing_targets, break_rules
-- =============================================

-- Stores: add extended configuration columns
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Vancouver',
  ADD COLUMN IF NOT EXISTS week_start SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS publish_cutoff_hours INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_hours_before_shift INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_lead_time_hours INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap_require_same_role BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS swap_auto_approve_threshold INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_rest_hours_between_shifts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_hours_per_day INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_hours_per_week INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_consecutive_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_labor_budget_cents INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_shift_boundary_min INT DEFAULT 1320;

-- Business hours
CREATE TABLE IF NOT EXISTS store_business_hours(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_min INT NOT NULL CHECK (open_min BETWEEN 0 AND 1440),
  close_min INT NOT NULL CHECK (close_min BETWEEN 0 AND 1440 AND close_min > open_min),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, weekday)
);

-- Store holidays
CREATE TABLE IF NOT EXISTS store_holidays(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, date)
);

-- Work items (templates)
CREATE TABLE IF NOT EXISTS work_items(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_min INT NOT NULL CHECK (start_min BETWEEN 0 AND 1440),
  end_min INT NOT NULL CHECK (end_min BETWEEN 0 AND 1440 AND end_min > start_min),
  unpaid_break_min INT NOT NULL DEFAULT 0 CHECK (unpaid_break_min >= 0),
  max_headcount INT NOT NULL DEFAULT 1 CHECK (max_headcount BETWEEN 1 AND 99),
  role_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

-- Staffing targets
CREATE TABLE IF NOT EXISTS staffing_targets(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min INT NOT NULL,
  end_min INT NOT NULL CHECK (end_min > start_min),
  role_hint TEXT,
  min_headcount INT NOT NULL DEFAULT 0,
  max_headcount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Break rules
CREATE TABLE IF NOT EXISTS break_rules(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  threshold_hours NUMERIC(4,2) NOT NULL,
  break_min INT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_work_items_store_start ON work_items(store_id, start_min);
CREATE INDEX IF NOT EXISTS idx_staffing_targets_store_weekday_start ON staffing_targets(store_id, weekday, start_min);
CREATE INDEX IF NOT EXISTS idx_business_hours_store_weekday ON store_business_hours(store_id, weekday);

-- updated_at trigger (assumes update_updated_at_column() exists)
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'update_updated_at_column';
  IF NOT FOUND THEN
    -- Fallback simple trigger
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $upd$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $upd$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_store_business_hours_updated_at
  BEFORE UPDATE ON store_business_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_store_holidays_updated_at
  BEFORE UPDATE ON store_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_work_items_updated_at
  BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_staffing_targets_updated_at
  BEFORE UPDATE ON staffing_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_break_rules_updated_at
  BEFORE UPDATE ON break_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- RLS policies
-- =============================================

ALTER TABLE store_business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_rules ENABLE ROW LEVEL SECURITY;

-- Helper predicate: user has any role in store
CREATE OR REPLACE FUNCTION has_store_read_access(p_store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_store_roles usr
    WHERE usr.store_id = p_store_id AND usr.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper predicate: user can manage store (MASTER/SUB_MANAGER)
CREATE OR REPLACE FUNCTION can_manage_store(p_store_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM user_store_roles usr
    WHERE usr.store_id = p_store_id AND usr.user_id = auth.uid()
      AND usr.role IN ('MASTER','SUB_MANAGER') AND usr.status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- store_business_hours policies (idempotent)
DO $$ BEGIN
  CREATE POLICY sbh_select ON store_business_hours
    FOR SELECT USING (has_store_read_access(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sbh_ins ON store_business_hours
    FOR INSERT WITH CHECK (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sbh_upd ON store_business_hours
    FOR UPDATE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sbh_del ON store_business_hours
    FOR DELETE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- store_holidays policies (idempotent)
DO $$ BEGIN
  CREATE POLICY sh_select ON store_holidays
    FOR SELECT USING (has_store_read_access(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sh_ins ON store_holidays
    FOR INSERT WITH CHECK (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sh_upd ON store_holidays
    FOR UPDATE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sh_del ON store_holidays
    FOR DELETE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- work_items policies (idempotent)
DO $$ BEGIN
  CREATE POLICY wi_select ON work_items
    FOR SELECT USING (has_store_read_access(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY wi_ins ON work_items
    FOR INSERT WITH CHECK (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY wi_upd ON work_items
    FOR UPDATE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY wi_del ON work_items
    FOR DELETE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- staffing_targets policies (idempotent)
DO $$ BEGIN
  CREATE POLICY st_select ON staffing_targets
    FOR SELECT USING (has_store_read_access(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY st_ins ON staffing_targets
    FOR INSERT WITH CHECK (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY st_upd ON staffing_targets
    FOR UPDATE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY st_del ON staffing_targets
    FOR DELETE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- break_rules policies (idempotent)
DO $$ BEGIN
  CREATE POLICY br_select ON break_rules
    FOR SELECT USING (has_store_read_access(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY br_ins ON break_rules
    FOR INSERT WITH CHECK (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY br_upd ON break_rules
    FOR UPDATE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY br_del ON break_rules
    FOR DELETE USING (can_manage_store(store_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


