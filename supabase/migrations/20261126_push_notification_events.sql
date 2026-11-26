-- BIGBULLS push notification event foundation.
-- Device tokens/preferences are user-owned; outbox is server-only.
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

create or replace function public.enqueue_bigbulls_push(
  p_user_id uuid, p_event_type text, p_event_key text, p_title text, p_message text, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_user_id is null then return; end if;
  insert into public.push_notification_outbox(user_id,event_type,event_key,title,message,payload)
  values(p_user_id,p_event_type,p_event_key,p_title,p_message,coalesce(p_payload,'{}'::jsonb))
  on conflict(event_key) do nothing;
  insert into public.client_notifications(user_id,title,message,category,metadata)
  values(p_user_id,p_title,p_message,p_event_type,coalesce(p_payload,'{}'::jsonb));
end;
$$;
revoke all on function public.enqueue_bigbulls_push(uuid,text,text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.notify_wallet_transaction_push() returns trigger
language plpgsql security definer set search_path=public as $$
declare t text; title_text text; message_text text; amount_text text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.kind='deposit' and new.status in ('approved','completed','credited') then
    t:='deposit_completed'; title_text:='Deposit received'; amount_text:=coalesce(new.amount_usd::text,'');
    message_text:='Your deposit has arrived' || case when amount_text<>'' then ' ($'||amount_text||').' else '.' end;
  elsif new.kind='deposit' and new.status='rejected' then
    t:='deposit_rejected'; title_text:='Deposit not approved'; message_text:='Your deposit was rejected. Open BIGBULLS for details.';
  elsif new.kind='withdrawal' and new.status in ('approved','completed','paid') then
    t:='withdrawal_approved'; title_text:='Withdrawal approved'; message_text:='Your withdrawal has been approved.';
  elsif new.kind='withdrawal' and new.status='rejected' then
    t:='withdrawal_rejected'; title_text:='Withdrawal rejected'; message_text:='Your withdrawal was rejected. Open BIGBULLS for details.';
  else return new;
  end if;
  perform public.enqueue_bigbulls_push(new.user_id,t,'wallet:'||new.id::text||':'||new.status,title_text,message_text,
    jsonb_build_object('transaction_id',new.id,'kind',new.kind,'status',new.status,'amount_usd',new.amount_usd));
  return new;
end $$;
drop trigger if exists wallet_transaction_push_event on public.wallet_transactions;
create trigger wallet_transaction_push_event after update of status on public.wallet_transactions
for each row execute function public.notify_wallet_transaction_push();

create or replace function public.notify_kyc_push() returns trigger
language plpgsql security definer set search_path=public as $$
declare t text; title_text text; message_text text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('approved','verified') then
    t:='kyc_verified'; title_text:='Identity verified'; message_text:='Your BIGBULLS identity verification is complete.';
  elsif new.status='rejected' then
    t:='kyc_rejected'; title_text:='Verification update'; message_text:='Your identity verification was not approved. Open BIGBULLS for details.';
  else return new;
  end if;
  perform public.enqueue_bigbulls_push(new.user_id,t,'kyc:'||new.id::text||':'||new.status,title_text,message_text,
    jsonb_build_object('kyc_id',new.id,'status',new.status));
  return new;
end $$;
drop trigger if exists kyc_push_event on public.kyc_submissions;
create trigger kyc_push_event after update of status on public.kyc_submissions
for each row execute function public.notify_kyc_push();

create or replace function public.notify_position_closed_push() returns trigger
language plpgsql security definer set search_path=public as $$
declare reason_text text; title_text text; message_text text;
begin
  if old.status='CLOSED' or new.status<>'CLOSED' then return new; end if;
  reason_text:=lower(coalesce(new.close_reason,'manual'));
  title_text:=case when reason_text like '%tp%' or reason_text like '%take%' then 'Take profit hit'
                   when reason_text like '%sl%' or reason_text like '%stop loss%' then 'Stop loss triggered'
                   else 'Trade closed' end;
  message_text:=new.symbol||' '||upper(new.side)||' position closed. Realized P/L: '||coalesce(new.realized_pnl::text,'0')||'.';
  perform public.enqueue_bigbulls_push(new.user_id,'trade_closed','position:'||new.id::text||':CLOSED',title_text,message_text,
    jsonb_build_object('position_id',new.id,'symbol',new.symbol,'side',new.side,'close_reason',new.close_reason,'realized_pnl',new.realized_pnl));
  return new;
end $$;
drop trigger if exists position_closed_push_event on public.bb_bbook_positions;
create trigger position_closed_push_event after update of status on public.bb_bbook_positions
for each row execute function public.notify_position_closed_push();
