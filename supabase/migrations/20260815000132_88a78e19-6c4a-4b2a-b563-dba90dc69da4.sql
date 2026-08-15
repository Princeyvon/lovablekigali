-- 1. Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  direction text NOT NULL DEFAULT 'out',
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'Cash',
  category text NOT NULL DEFAULT 'General',
  payee text,
  note text,
  source_table text NOT NULL DEFAULT 'manual',
  source_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx read" ON public.transactions;
CREATE POLICY "tx read" ON public.transactions FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "tx admin" ON public.transactions;
CREATE POLICY "tx admin" ON public.transactions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_key ON public.transactions (source_table, source_id);
CREATE INDEX IF NOT EXISTS transactions_occurred_at_idx ON public.transactions (occurred_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS transactions_touch ON public.transactions;
CREATE TRIGGER transactions_touch BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Salary
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS salary numeric NOT NULL DEFAULT 0;

-- 3. Mirror functions
CREATE OR REPLACE FUNCTION public.mirror_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table = 'payments' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT business_name INTO _name FROM public.clients WHERE id = NEW.client_id;
  INSERT INTO public.transactions (occurred_at, direction, amount, method, category, payee, note, source_table, source_id)
  VALUES (NEW.payment_date::timestamptz, 'in', NEW.amount, coalesce(NEW.method,'MOMO'), 'Client payment', coalesce(_name,'Client'), NEW.note, 'payments', NEW.id)
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET occurred_at = EXCLUDED.occurred_at, amount = EXCLUDED.amount, method = EXCLUDED.method,
        payee = EXCLUDED.payee, note = EXCLUDED.note;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.mirror_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table = 'expenses' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.transactions (occurred_at, direction, amount, method, category, payee, note, source_table, source_id)
  VALUES (NEW.date::timestamptz, 'out', NEW.amount, 'Cash', NEW.category, NEW.vendor, NEW.note, 'expenses', NEW.id)
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET occurred_at = EXCLUDED.occurred_at, amount = EXCLUDED.amount, category = EXCLUDED.category,
        payee = EXCLUDED.payee, note = EXCLUDED.note;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.mirror_payout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transactions WHERE source_table = 'team_payouts' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT full_name INTO _name FROM public.team_members WHERE id = NEW.team_member_id;
  INSERT INTO public.transactions (occurred_at, direction, amount, method, category, payee, note, source_table, source_id)
  VALUES (NEW.date_sent::timestamptz, 'out', NEW.amount,
          CASE NEW.method::text WHEN 'Mobile Money' THEN 'MOMO' WHEN 'Bank' THEN 'Bank' ELSE 'Cash' END,
          NEW.type::text, coalesce(_name,'Team member'), NEW.note, 'team_payouts', NEW.id)
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET occurred_at = EXCLUDED.occurred_at, amount = EXCLUDED.amount, method = EXCLUDED.method,
        category = EXCLUDED.category, payee = EXCLUDED.payee, note = EXCLUDED.note;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS payments_mirror ON public.payments;
CREATE TRIGGER payments_mirror AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.mirror_payment();

DROP TRIGGER IF EXISTS expenses_mirror ON public.expenses;
CREATE TRIGGER expenses_mirror AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.mirror_expense();

DROP TRIGGER IF EXISTS payouts_mirror ON public.team_payouts;
CREATE TRIGGER payouts_mirror AFTER INSERT OR UPDATE OR DELETE ON public.team_payouts
FOR EACH ROW EXECUTE FUNCTION public.mirror_payout();

-- 4. Backfill
INSERT INTO public.transactions (occurred_at, direction, amount, method, category, payee, note, source_table, source_id)
SELECT p.payment_date::timestamptz, 'in', p.amount, coalesce(p.method,'MOMO'), 'Client payment', c.business_name, p.note, 'payments', p.id
FROM public.payments p LEFT JOIN public.clients c ON c.id = p.client_id
WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.source_table = 'payments' AND t.source_id = p.id);

INSERT INTO public.transactions (occurred_at, direction, amount, method, category, payee, note, source_table, source_id)
SELECT e.date::timestamptz, 'out', e.amount, 'Cash', e.category, e.vendor, e.note, 'expenses', e.id
FROM public.expenses e
WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.source_table = 'expenses' AND t.source_id = e.id);

INSERT INTO public.transactions (occurred_at, direction, amount, method, category, payee, note, source_table, source_id)
SELECT tp.date_sent::timestamptz, 'out', tp.amount,
       CASE tp.method::text WHEN 'Mobile Money' THEN 'MOMO' WHEN 'Bank' THEN 'Bank' ELSE 'Cash' END,
       tp.type::text, m.full_name, tp.note, 'team_payouts', tp.id
FROM public.team_payouts tp LEFT JOIN public.team_members m ON m.id = tp.team_member_id
WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.source_table = 'team_payouts' AND t.source_id = tp.id);

-- 5. Audit trail
CREATE OR REPLACE FUNCTION public.audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _payload jsonb; _changed jsonb := '{}'::jsonb; k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _payload := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object('old', to_jsonb(OLD));
  ELSE
    FOR k IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k THEN
        _changed := _changed || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(OLD)->k, 'to', to_jsonb(NEW)->k));
      END IF;
    END LOOP;
    IF _changed = '{}'::jsonb THEN RETURN NEW; END IF;
    _payload := jsonb_build_object('changed', _changed);
  END IF;
  INSERT INTO public.entity_events (entity_table, entity_id, action, actor, payload)
  VALUES (TG_TABLE_NAME, CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, lower(TG_OP), auth.uid(), _payload);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','prospects','payments','expenses','team_payouts','subscriptions','team_members','user_roles','transactions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_change()', t);
  END LOOP;
END $$;