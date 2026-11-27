BEGIN;
CREATE VIEW public.lkh_operator_login_directory WITH (security_invoker = true) AS SELECT DISTINCT l.key AS line, btrim(o.name) AS operator_name, lower(regexp_replace(btrim(o.name), '[[:space:]]+', ' ', 'g')) AS name_key FROM public.lkh_master_cache c CROSS JOIN LATERAL jsonb_each(c.mapping) l CROSS JOIN LATERAL jsonb_array_elements_text(l.value->'operators') o(name) WHERE c.id AND o.name IS NOT NULL AND btrim(o.name) NOT IN ('','__other_option__');
CREATE TABLE public.lkh_operator_login_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false);
ALTER TABLE public.lkh_operator_login_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.lkh_operator_login_settings (id,enabled) VALUES (true,false);
COMMIT;
