-- Supabase schema for FrameForge
-- Run this in the Supabase SQL editor.

create table if not exists profiles (
  id uuid primary key,
  email text unique not null,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null default 'Untitled',
  prompt text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key,
  user_id uuid references profiles(id) on delete cascade,
  prompt text not null,
  style text,
  duration text,
  voice text,
  captions boolean default true,
  status text not null default 'queued',
  progress integer not null default 0,
  result jsonb,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table jobs enable row level security;

-- Profiles: users can view/update only their own row
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Projects: authenticated users can view/create/update their own projects
create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- Jobs: users can view/create/update their own jobs
create policy "Users can insert own jobs"
  on jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can view own jobs"
  on jobs for select
  using (auth.uid() = user_id);

create policy "Users can update own jobs"
  on jobs for update
  using (auth.uid() = user_id);
