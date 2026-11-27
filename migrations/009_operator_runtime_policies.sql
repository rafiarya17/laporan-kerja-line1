BEGIN;
CREATE POLICY app_read_settings ON public.lkh_operator_login_settings FOR SELECT TO lkh_vercel USING (true);
CREATE POLICY app_read_accounts ON public.lkh_operator_accounts FOR SELECT TO lkh_vercel USING (enabled);
CREATE POLICY app_manage_sessions ON public.lkh_operator_sessions FOR ALL TO lkh_vercel USING (true) WITH CHECK (true);
CREATE POLICY app_manage_attempts ON public.lkh_operator_login_attempts FOR ALL TO lkh_vercel USING (true) WITH CHECK (true);
COMMIT;
