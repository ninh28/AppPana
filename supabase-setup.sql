create table if not exists public.prdcv_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint prdcv_user_data_data_is_object check (jsonb_typeof(data) = 'object')
);

alter table public.prdcv_user_data enable row level security;

revoke all on public.prdcv_user_data from anon;
grant select, insert, update on public.prdcv_user_data to authenticated;

drop policy if exists "Users can read their own PRDCV data" on public.prdcv_user_data;
create policy "Users can read their own PRDCV data"
  on public.prdcv_user_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own PRDCV data" on public.prdcv_user_data;
create policy "Users can insert their own PRDCV data"
  on public.prdcv_user_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own PRDCV data" on public.prdcv_user_data;
create policy "Users can update their own PRDCV data"
  on public.prdcv_user_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
