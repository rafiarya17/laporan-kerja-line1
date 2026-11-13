ALTER TABLE public.lkh_trial_reports
  ADD COLUMN IF NOT EXISTS effective_payload jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'WAITING_LEADER';
CREATE TABLE IF NOT EXISTS public.lkh_trial_targets (
  date text NOT NULL, shift text NOT NULL, line text NOT NULL CHECK (line='LINE_99'),
  version integer NOT NULL, items jsonb NOT NULL, leader text NOT NULL, reason text NOT NULL,
  PRIMARY KEY(date,shift,line)
);
CREATE TABLE IF NOT EXISTS public.lkh_trial_actions (
  request_id text PRIMARY KEY, command jsonb NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION public.apply_lkh_trial_action(command jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
 p jsonb := command->'payload'; rid text := p->>'requestId';
 prior public.lkh_trial_actions%ROWTYPE;
 report public.lkh_trial_reports%ROWTYPE;
 target public.lkh_trial_targets%ROWTYPE;
 result jsonb; next_version integer;
BEGIN
 IF rid IS NULL OR length(rid)>100 THEN RAISE EXCEPTION 'INVALID_REQUEST_ID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lkh-trial:'||rid,0));
 SELECT * INTO prior FROM public.lkh_trial_actions WHERE request_id=rid;
 IF FOUND THEN
   IF prior.command <> command THEN RAISE EXCEPTION 'REQUEST_ID_CONFLICT'; END IF;
   RETURN prior.result;
 END IF;
 IF command->>'action' = 'target' THEN
   IF p->>'line' <> 'LINE_99' THEN RAISE EXCEPTION 'PILOT_ONLY'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('lkh-target:'||(p->>'date')||':'||(p->>'shift'),0));
   SELECT * INTO target FROM public.lkh_trial_targets
     WHERE date=p->>'date' AND shift=p->>'shift' AND line='LINE_99' FOR UPDATE;
   IF coalesce(target.version,0) <> (p->>'expectedVersion')::integer THEN RAISE EXCEPTION 'VERSION_CHANGED_REFRESH'; END IF;
   next_version := coalesce(target.version,0)+1;
   INSERT INTO public.lkh_trial_targets(date,shift,line,version,items,leader,reason)
     VALUES(p->>'date',p->>'shift','LINE_99',next_version,p->'items',command->>'leader',coalesce(p->>'reason',''))
     ON CONFLICT(date,shift,line) DO UPDATE SET version=EXCLUDED.version,items=EXCLUDED.items,leader=EXCLUDED.leader,reason=EXCLUDED.reason;
   result := jsonb_build_object('version',next_version);
 ELSIF command->>'action'='decide' THEN
   SELECT * INTO report FROM public.lkh_trial_reports WHERE id=p->>'id' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND'; END IF;
   IF report.version::text <> p->>'expectedHash' THEN RAISE EXCEPTION 'VERSION_CHANGED_REFRESH'; END IF;
   IF p->>'decision' NOT IN ('approve','hold','revise') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
   IF report.state NOT IN ('WAITING_LEADER','HELD') THEN RAISE EXCEPTION 'REPORT_ALREADY_APPROVED'; END IF;
   UPDATE public.lkh_trial_reports SET version=version+1,
     state=CASE p->>'decision' WHEN 'approve' THEN 'APPROVED_TEST' WHEN 'hold' THEN 'HELD' ELSE 'WAITING_LEADER' END,
     effective_payload=CASE WHEN p->>'decision'='revise' THEN p->'effectivePayload' ELSE effective_payload END
     WHERE id=report.id RETURNING * INTO report;
   result:=jsonb_build_object('id',report.id,'version',report.version,'state',report.state);
 ELSE RAISE EXCEPTION 'INVALID_ACTION';
 END IF;
 INSERT INTO public.lkh_trial_actions(request_id,command,result) VALUES(rid,command,result);
 RETURN result;
END;
$$;
GRANT SELECT,INSERT,UPDATE ON public.lkh_trial_targets,public.lkh_trial_actions TO lkh_vercel_trial;
GRANT EXECUTE ON FUNCTION public.apply_lkh_trial_action(jsonb) TO lkh_vercel_trial;
