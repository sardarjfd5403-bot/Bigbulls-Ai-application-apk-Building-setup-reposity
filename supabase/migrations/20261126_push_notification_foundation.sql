create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'onesignal' check (provider in ('onesignal','fcm')),
  device_id text not null,
  push_token text not null,
  platform text not null default 'android' check (platform in ('android','ios','web')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id),
  unique(provider, push_token)
);
create index if not exists push_devices_user_enabled_idx on public.push_devices(user_id) where enabled = true;
alter table public.push_devices enable row level security;
drop policy if exists "Users manage own push devices" on public.push_devices;
create policy "Users manage own push devices" on public.push_devices for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.push_devices to authenticated;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  deposits_withdrawals boolean not null default true,
  kyc_updates boolean not null default true,
  trade_updates boolean not null default true,
  marketing_updates boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences" on public.notification_preferences for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.notification_preferences to authenticated;

create table if not exists public.push_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_key text not null unique,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists push_outbox_queued_idx on public.push_notification_outbox(created_at) where status = 'queued';
alter table public.push_notification_outbox enable row level security;
revoke all on public.push_notification_outbox from anon, authenticated;
