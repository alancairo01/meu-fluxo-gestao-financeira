create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name varchar(40) not null default '',
  greeting varchar(120) not null default '',
  accent varchar(20) not null default 'violet' check (accent in ('violet', 'ocean', 'emerald', 'coral', 'sunset')),
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme varchar(10) not null default 'light' check (theme in ('light', 'dark')),
  font_size varchar(10) not null default 'default' check (font_size in ('default', 'large', 'extra')),
  high_contrast boolean not null default false,
  reduce_motion boolean not null default false,
  selected_month date,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_budget numeric(14,2) not null default 0 check (monthly_budget >= 0),
  category_budgets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type varchar(10) not null check (entry_type in ('income', 'expense')),
  description varchar(80) not null,
  amount numeric(14,2) not null check (amount > 0),
  entry_date date not null,
  category varchar(40) not null default 'Outros',
  notes varchar(160) not null default '',
  installment_current smallint,
  installment_total smallint,
  installment_series_id varchar(120),
  recurring_total smallint,
  recurring_series_id varchar(120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint financial_entries_installment_check check (
    (installment_current is null and installment_total is null and installment_series_id is null)
    or (
      installment_current between 1 and installment_total
      and installment_total between 2 and 120
      and installment_series_id is not null
    )
  ),
  constraint financial_entries_recurring_check check (
    (recurring_total is null and recurring_series_id is null)
    or (recurring_total between 2 and 120 and recurring_series_id is not null)
  ),
  constraint financial_entries_mode_check check (
    not (installment_current is not null and recurring_total is not null)
  )
);

create index if not exists financial_entries_user_date_idx on public.financial_entries (user_id, entry_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists preferences_set_updated_at on public.user_preferences;
create trigger preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists budgets_set_updated_at on public.financial_budgets;
create trigger budgets_set_updated_at
before update on public.financial_budgets
for each row execute function public.set_updated_at();

drop trigger if exists entries_set_updated_at on public.financial_entries;
create trigger entries_set_updated_at
before update on public.financial_entries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.financial_budgets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.financial_budgets enable row level security;
alter table public.financial_entries enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.financial_budgets to authenticated;
grant select, insert, update, delete on public.financial_entries to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists preferences_select_own on public.user_preferences;
create policy preferences_select_own on public.user_preferences
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists preferences_insert_own on public.user_preferences;
create policy preferences_insert_own on public.user_preferences
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists preferences_update_own on public.user_preferences;
create policy preferences_update_own on public.user_preferences
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists budgets_select_own on public.financial_budgets;
create policy budgets_select_own on public.financial_budgets
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists budgets_insert_own on public.financial_budgets;
create policy budgets_insert_own on public.financial_budgets
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists budgets_update_own on public.financial_budgets;
create policy budgets_update_own on public.financial_budgets
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists entries_select_own on public.financial_entries;
create policy entries_select_own on public.financial_entries
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists entries_insert_own on public.financial_entries;
create policy entries_insert_own on public.financial_entries
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists entries_update_own on public.financial_entries;
create policy entries_update_own on public.financial_entries
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists entries_delete_own on public.financial_entries;
create policy entries_delete_own on public.financial_entries
for delete to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
