create or replace function public.has_premium_access(user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_active_subscription(user_uuid, 'live')
    or public.has_active_subscription(user_uuid, 'test')
    or coalesce((select topup_balance from public.user_credits where user_id = user_uuid), 0) > 0
$$;

grant execute on function public.has_premium_access(uuid) to authenticated, service_role;