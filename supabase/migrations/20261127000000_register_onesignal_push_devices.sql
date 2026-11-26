create unique index if not exists push_devices_user_provider_device_uidx
  on public.push_devices (user_id, provider, device_id);

alter table public.push_devices enable row level security;

grant select, insert, update on public.push_devices to authenticated;

drop policy if exists push_devices_select_own on public.push_devices;
create policy push_devices_select_own
  on public.push_devices for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_devices_insert_own on public.push_devices;
create policy push_devices_insert_own
  on public.push_devices for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists push_devices_update_own on public.push_devices;
create policy push_devices_update_own
  on public.push_devices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
