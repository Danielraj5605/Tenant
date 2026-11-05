-- Phase 3: scheduled jobs (SPEC §8). pg_cron calls the `daily` Edge Function.
--
-- One-time setup (SQL Editor), with your own values — see README "Scheduled jobs":
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.call_daily_job(p_job text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('job', p_job),
    timeout_milliseconds := 30000
  )
$$;

revoke all on function public.call_daily_job(text) from public, anon, authenticated;

-- 06:00 Asia/Kolkata = 00:30 UTC: assign today's chores and send duty reminders.
select cron.schedule('tenant-daily', '30 0 * * *', $$ select public.call_daily_job('daily') $$);

-- Sunday 18:00 Asia/Kolkata = 12:30 UTC: "Away any day next week?"
select cron.schedule('tenant-weekly', '30 12 * * 0', $$ select public.call_daily_job('weekly') $$);
