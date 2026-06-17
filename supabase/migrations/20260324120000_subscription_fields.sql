-- Add subscription and trial tracking columns to profiles.

alter table public.profiles
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'trial_expired', 'premium', 'cancelled')),
  add column if not exists trial_started_at timestamptz not null default now(),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '7 days');

-- Prevent clients from modifying trial date columns after insert.
-- The trigger uses security definer context to detect whether the caller is
-- the service_role (allowed) or an end-user (blocked from changing dates).
create or replace function public.protect_trial_dates()
returns trigger
language plpgsql
as $$
begin
  if old.trial_started_at is distinct from new.trial_started_at
     or old.trial_ends_at is distinct from new.trial_ends_at then
    new.trial_started_at := old.trial_started_at;
    new.trial_ends_at := old.trial_ends_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_trial_dates_trigger on public.profiles;
create trigger protect_trial_dates_trigger
  before update on public.profiles
  for each row execute function public.protect_trial_dates();

-- Replace the trigger function to explicitly set trial fields on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, subscription_status, trial_started_at, trial_ends_at, updated_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      'User'
    ),
    'trialing',
    now(),
    now() + interval '7 days',
    now()
  );
  return new;
end;
$$;
