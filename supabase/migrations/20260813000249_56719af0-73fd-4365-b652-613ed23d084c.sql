-- 1. Profiles enrichment
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE POLICY "admin manage profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Client app status / suspension
DO $$ BEGIN
  CREATE TYPE public.app_status AS ENUM ('Live','Suspended','Closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS app_url text,
  ADD COLUMN IF NOT EXISTS app_status public.app_status NOT NULL DEFAULT 'Live',
  ADD COLUMN IF NOT EXISTS suspended_at date,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- 3. Payment methods restricted
UPDATE public.payments SET method = 'Bank' WHERE method IS NULL OR method NOT IN ('MOMO','Bank','Cash');
ALTER TABLE public.payments ALTER COLUMN method SET DEFAULT 'MOMO';
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check CHECK (method IN ('MOMO','Bank','Cash'));

-- 4. Payment reminders
CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('sms','whatsapp','email')),
  message text,
  sent_by uuid REFERENCES public.team_members(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reminders TO authenticated;
GRANT ALL ON public.payment_reminders TO service_role;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders staff" ON public.payment_reminders FOR ALL TO authenticated
  USING (public.is_staff() OR public.owns_client(client_id)) WITH CHECK (public.is_staff() OR public.owns_client(client_id));

-- 5. Admin control over roles
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Demo data
INSERT INTO public.team_members (full_name, role, email, phone, active) VALUES
  ('Aline Uwase','Sales','aline@lovable.solutions','+250788100001',true),
  ('Eric Mugisha','Sales','eric@lovable.solutions','+250788100002',true),
  ('Chantal Ingabire','Support','chantal@lovable.solutions','+250788100003',true),
  ('Patrick Habimana','Dev','patrick@lovable.solutions','+250788100004',true),
  ('Diane Umutoni','Sales','diane@lovable.solutions','+250788100005',true),
  ('Kevin Nshuti','Dev','kevin@lovable.solutions','+250788100006',false)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  reps uuid[];
  names text[] := ARRAY['Kigali Heights Pharmacy','Nyamirambo Grocers','Akagera Tours','Umucyo Logistics','Green Hills Academy Shop','Inyange Distributors','Kivu Coffee Roasters','Rwanda Auto Parts','Ubumwe Hardware','Nyanza Textiles','Musanze Farm Supply','Rubavu Beach Resort','Sonrise Dental','Karongi Fisheries','Bugesera Poultry','Muhanga Millers','Gasabo Print House','Remera Fitness Club','Kicukiro Bakery','Cyangugu Tea Estate','Amahoro Insurance Brokers','Isange Legal Advisors','Ikaze Guesthouse','Urwego Microfinance','Rwenzori Water Depot','Intare Security Services','Umuganda Construction','Kigali Tech Repairs','Vision Optics','Zaria Beauty Lounge','Nile Star Freight','Twiga Furniture','Sunrise Clinic','Peace Motors','Ejo Heza Nursery','Kigali Fashion House','Rugende Dairy','Africa Mart Online','Bralirwa Depot Ltd','Highland Herbs','Rwanda Craft Collective','Cactus Digital Studio','Umurava Consulting','Bwiza Interiors','Gorilla Trek Adventures','Nyabugogo Spare Parts','Star Cinema Kigali','Ihuriro Coop Bank Agent','Kimironko Butchery','Amasezerano Events','Ruhengeri Guest Lodge','Isoko Wholesale','Kigali Cold Chain','Nova Solar Rwanda','Duhamic Agro','Kigali Language Centre','Rwandex Traders','Serena Laundry Services','Ubuzima Health Labs','Imbuto Seed Company'];
  sectors text[] := ARRAY['Healthcare','Retail','Tourism','Logistics','Education','Manufacturing','Food & Beverage','Automotive','Construction','Textiles','Agriculture','Hospitality','Professional Services','Finance','Technology','Beauty & Wellness','Real Estate','Media & Entertainment','Energy','Non-profit'];
  i int; cid uuid; rep uuid; rate numeric; signed date; st public.client_status; months int; j int; start_d date; pay_id uuid;
BEGIN
  SELECT array_agg(id) INTO reps FROM public.team_members WHERE active;
  IF (SELECT count(*) FROM public.clients) > 10 THEN RETURN; END IF;

  FOR i IN 1..60 LOOP
    rep := reps[1 + (i % array_length(reps,1))];
    rate := (25000 + (i % 12) * 15000)::numeric;
    signed := CURRENT_DATE - ((30 + i * 9) || ' days')::interval;
    st := CASE WHEN i % 17 = 0 THEN 'Churned'::public.client_status WHEN i % 11 = 0 THEN 'Paused'::public.client_status ELSE 'Active'::public.client_status END;

    INSERT INTO public.clients (business_name, contact_name, contact_email, contact_phone, industry, onboarded_by, signed_date, status, app_url)
    VALUES (names[i], split_part(names[i],' ',1) || ' Manager', lower(replace(split_part(names[i],' ',1),'''','')) || i || '@example.rw',
            '+2507881' || lpad(i::text,5,'0'), sectors[1 + (i % array_length(sectors,1))], rep, signed, st,
            'https://' || lower(regexp_replace(names[i],'[^a-zA-Z]','','g')) || '.app')
    RETURNING id INTO cid;

    INSERT INTO public.subscriptions (client_id, monthly_rate, billing_cycle, start_date, status)
    VALUES (cid, rate, 'Monthly', signed, CASE WHEN st = 'Active' THEN 'Active'::public.sub_status WHEN st = 'Paused' THEN 'Paused'::public.sub_status ELSE 'Cancelled'::public.sub_status END);

    -- payment history: fully paid clients, slightly overdue, and long overdue
    months := CASE WHEN i % 7 = 0 THEN 0 WHEN i % 5 = 0 THEN 1 ELSE 3 END;
    start_d := signed;
    FOR j IN 1..months LOOP
      INSERT INTO public.payments (client_id, amount, payment_date, months_covered, covers_period_start, covers_period_end, method, note)
      VALUES (cid, rate, start_d, 1, start_d, (start_d + interval '1 month')::date,
              (ARRAY['MOMO','Bank','Cash'])[1 + ((i + j) % 3)], 'Monthly retainer')
      RETURNING id INTO pay_id;
      start_d := (start_d + interval '1 month')::date;
    END LOOP;

    INSERT INTO public.commissions (rep_id, client_id, type, amount, status)
    VALUES (rep, cid, 'Signing Bonus', rate * 0.15, CASE WHEN i % 3 = 0 THEN 'Pending'::public.commission_status ELSE 'Paid'::public.commission_status END);

    -- suspend apps more than 14 days past their covered period
    IF months = 0 AND signed < CURRENT_DATE - interval '21 days' THEN
      UPDATE public.clients SET app_status = 'Suspended', suspended_at = (signed + interval '14 days')::date,
        suspension_reason = 'Unpaid invoice beyond 14-day grace period' WHERE id = cid;
    END IF;

    INSERT INTO public.service_logs (client_id, date, category, description, logged_by)
    VALUES (cid, (signed + interval '10 days')::date, 'Feature', 'Initial rollout and staff training', rep);
  END LOOP;

  -- prospects
  FOR i IN 1..28 LOOP
    INSERT INTO public.prospects (business_name, industry, contact_name, contact_email, contact_phone, assigned_rep, stage, source)
    VALUES ((ARRAY['Ubwiza Salon','Kigali Drone Co','Rwanda Bike Share','Nyagatare Ranch','Smart Farm RW','Lakeside Hotel','Byumba Coop','Urban Eats','Techno Girls RW','Kigali Movers','Muhabura Foods','Solar Kits Ltd','Africa Vet Care','Mount Kigali Spa','Rwanda Books','Nyamata Millers','Kigali Cargo','Ineza Childcare','Umutara Steel','Digital Ikofi','Green Waste RW','Cyber Cafe Kimisagara','Kigali Golf Shop','Isoko Fashion','Rift Valley Water','Amahoro Pharmacy','Zamuka Media','Intego Analytics'])[i],
            (ARRAY['Beauty & Wellness','Technology','Transport','Agriculture','Agriculture','Hospitality','Agriculture','Food & Beverage','Education','Logistics','Food & Beverage','Energy','Healthcare','Beauty & Wellness','Retail','Manufacturing','Logistics','Education','Manufacturing','Finance','Environmental','Technology','Retail','Textiles','Food & Beverage','Healthcare','Media & Entertainment','Technology'])[i],
            'Contact ' || i, 'prospect' || i || '@example.rw', '+2507885' || lpad(i::text,5,'0'),
            reps[1 + (i % array_length(reps,1))],
            (ARRAY['Contacted','Demo','Negotiating','Signed','Lost'])[1 + (i % 5)]::public.prospect_stage,
            (ARRAY['Referral','Cold call','Walk-in','Event','Website'])[1 + (i % 5)]);
  END LOOP;

  -- expenses
  FOR i IN 1..18 LOOP
    INSERT INTO public.expenses (date, category, amount, vendor, note, paid_by)
    VALUES (CURRENT_DATE - (i * 11 || ' days')::interval,
            (ARRAY['Hosting','Internet','Transport','Salaries','Marketing','Office'])[1 + (i % 6)],
            (15000 + i * 7300)::numeric,
            (ARRAY['MTN Rwanda','Cloud Host','Kigali Fuel','Payroll','Meta Ads','Simba Supermarket'])[1 + (i % 6)],
            'Operating cost', reps[1 + (i % array_length(reps,1))]);
  END LOOP;

  -- payouts
  FOR i IN 1..12 LOOP
    INSERT INTO public.team_payouts (team_member_id, type, amount, date_sent, method, reference, note)
    VALUES (reps[1 + (i % array_length(reps,1))],
            (ARRAY['Commission','Salary','Reimbursement'])[1 + (i % 3)]::public.payout_type,
            (80000 + i * 12000)::numeric, CURRENT_DATE - (i * 9 || ' days')::interval,
            (ARRAY['Mobile Money','Bank','Check'])[1 + (i % 3)]::public.payout_method,
            'PO-' || lpad(i::text,4,'0'), 'Monthly settlement');
  END LOOP;

  -- weekly snapshots
  FOR i IN 0..11 LOOP
    INSERT INTO public.weekly_snapshots (week_start, new_leads, deals_closed, revenue_collected, active_clients, churned_clients)
    VALUES ((date_trunc('week', CURRENT_DATE) - (i || ' weeks')::interval)::date,
            4 + (i % 7), 1 + (i % 4), (900000 + i * 145000)::numeric, 48 + i, (i % 3));
  END LOOP;
END $$;