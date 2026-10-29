-- Safe to run more than once.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- One row per logged-in device. The refresh token is rotated on every use;
-- prev_token_hash lets a just-replaced token through for a short grace window.
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  token_hash      text not null unique,
  prev_token_hash text,
  rotated_at      timestamptz,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz not null default now()
);
create index if not exists sessions_prev_token_idx on sessions (prev_token_hash);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists login_attempts (
  id           bigserial primary key,
  email        text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on login_attempts (email, attempted_at);

create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  event_type    text not null,
  customer_name text,
  phone         text,
  start_date    date not null,
  start_slot    text not null default 'full',
  start_time    time,
  end_date      date not null,
  end_slot      text not null default 'full',
  end_time      time,
  spaces        text[] not null default '{main}',
  amount        integer,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint bookings_dates_chk check (end_date >= start_date)
);
create index if not exists bookings_user_dates_idx on bookings (user_id, start_date, end_date);

-- Full snapshot of the booking after every change, so any version can be restored.
create table if not exists booking_history (
  id         bigserial primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  action     text not null,
  snapshot   jsonb not null,
  changed_at timestamptz not null default now()
);
create index if not exists booking_history_booking_idx on booking_history (booking_id, changed_at desc);
create index if not exists booking_history_user_idx on booking_history (user_id, changed_at desc);
