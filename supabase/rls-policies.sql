-- ===========================================================================
-- Tiger's Car Rental — Row Level Security Policies
-- INFO 0412 Senior Seminar II · Phase 3
--
-- The database-layer half of the two-layer RBAC required by SIP Section 2.3.
-- The route layer lives in middleware.ts. This file is what protects the DATA
-- if a request ever reaches Postgres without going through a Next.js route.
--
-- HOW TO APPLY:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole file
--   -> Run. It is idempotent: safe to run more than once.
--
-- IMPORTANT — how this interacts with the application:
--
--   Prisma connects using the Postgres connection string, which authenticates
--   as the database owner and therefore BYPASSES RLS. That is intentional and
--   normal for a server-side ORM: every Prisma query in this project already
--   runs behind a Next.js route that has been access-checked by middleware.
--
--   These policies exist to protect the OTHER door — Supabase's auto-generated
--   PostgREST API, reachable by anyone holding the publishable (anon) key,
--   which ships to the browser by design. Without RLS, that key alone would be
--   enough to read every customer's name, email, phone and ID number.
--
--   The project was created with "Automatically expose new tables" OFF and
--   "Enable automatic RLS" ON, so tables should already have RLS enabled.
--   These statements re-assert it explicitly rather than assuming.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Helper functions
--
-- SECURITY DEFINER is required here: these run inside policies on the users
-- table itself, and a plain query would recurse into the very policy being
-- evaluated. search_path is pinned to prevent search-path hijacking, which is
-- the standard hardening for SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.users
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'OWNER_ADMIN', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('OWNER_ADMIN', 'STAFF_AGENT'),
    false
  );
$$;

-- Resolves the Customer row belonging to the current auth user.
-- Matches on auth_user_id first (the correct link), falling back to email.
-- The email fallback covers customers who booked as guests before signing up,
-- whose rows were created without an auth_user_id.
create or replace function public.current_customer_id()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select customer_id
  from public.customers
  where auth_user_id = auth.uid()
     or (auth_user_id is null and email = auth.jwt() ->> 'email')
  order by (auth_user_id = auth.uid()) desc
  limit 1;
$$;


-- ===========================================================================
-- BASE GRANTS
--
-- REAL BUG FIXED HERE, discovered during Phase 4 testing: Postgres has two
-- separate layers of access control. RLS policies (below) control WHICH ROWS
-- a role can see. But before RLS is even evaluated, the role needs a base
-- GRANT just to touch the table at all — without it, Postgres returns
-- "permission denied for table X" (error 42501), regardless of how correct
-- the RLS policies are.
--
-- Supabase's own dashboard sets these grants up automatically for tables
-- created through its UI. Every table in this schema was created through
-- Prisma migrations instead, which do NOT receive that automatic grant —
-- so this gap existed from the moment RLS was first enabled in Phase 3, on
-- every single table, and simply hadn't been noticed yet: almost all of this
-- project's actual reads/writes go through Prisma (a direct Postgres
-- connection that bypasses PostgREST, RLS, and grants entirely), so nothing
-- had actually exercised the Supabase-client path against most of these
-- tables. Phase 4's middleware was the first code to query `users` through
-- the Supabase client rather than Prisma, and immediately hit it.
--
-- Granting the operation type here does NOT bypass RLS — a role can be
-- granted UPDATE on a whole table and RLS will still restrict it to rows the
-- policy allows. The grant and the policy are both required; neither alone
-- is sufficient.
-- ===========================================================================

grant usage on schema public to anon, authenticated;

-- Genuinely public reads — reachable by anonymous visitors, matching each
-- table's own "public_read" / "active_read" policy below.
grant select on public.vehicles to anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant select on public.promotions to anon, authenticated;

-- Authenticated-only reads and writes. The specific operations granted here
-- mirror what each table's policies below actually define — a table with
-- only a "_read" policy gets select only; one with a "_write" / "for all"
-- policy also gets insert/update/delete. RLS still narrows every one of
-- these to the specific rows (and, via is_staff()/is_owner_admin(), the
-- specific roles) each policy already specifies.
grant select, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.payment_transactions to authenticated;
grant insert, update, delete on public.promotions to authenticated;
grant select, insert, update, delete on public.maintenance_records to authenticated;
grant select, insert, update, delete on public.rental_agreements to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant insert, update, delete on public.vehicles to authenticated;
-- The exact grant this project's error surfaced was missing:
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.system_settings to authenticated;


-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------

alter table public.customers            enable row level security;
alter table public.vehicles             enable row level security;
alter table public.bookings             enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.promotions           enable row level security;
alter table public.maintenance_records  enable row level security;
alter table public.rental_agreements    enable row level security;
alter table public.reviews              enable row level security;
alter table public.users                enable row level security;
alter table public.system_settings      enable row level security;


-- ---------------------------------------------------------------------------
-- VEHICLES — the only genuinely public table
--
-- The fleet catalogue is public marketing content (S1/S2 render it to
-- anonymous visitors), so anon may read it. Only staff may modify it.
-- ---------------------------------------------------------------------------

drop policy if exists "vehicles_public_read" on public.vehicles;
create policy "vehicles_public_read"
  on public.vehicles for select
  using (true);

drop policy if exists "vehicles_staff_write" on public.vehicles;
create policy "vehicles_staff_write"
  on public.vehicles for all
  using (public.is_staff())
  with check (public.is_staff());


-- ---------------------------------------------------------------------------
-- CUSTOMERS — personal data: names, emails, phones, ID numbers
--
-- A customer may read and update only their own row. Staff may read all
-- (needed for pickup verification), but only the owner may delete.
-- Anonymous users get nothing.
-- ---------------------------------------------------------------------------

drop policy if exists "customers_self_read" on public.customers;
create policy "customers_self_read"
  on public.customers for select
  using (
    auth_user_id = auth.uid()
    or (auth_user_id is null and email = auth.jwt() ->> 'email')
    or public.is_staff()
  );

drop policy if exists "customers_self_update" on public.customers;
create policy "customers_self_update"
  on public.customers for update
  using (auth_user_id = auth.uid() or public.is_staff())
  with check (auth_user_id = auth.uid() or public.is_staff());

drop policy if exists "customers_owner_delete" on public.customers;
create policy "customers_owner_delete"
  on public.customers for delete
  using (public.is_owner_admin());


-- ---------------------------------------------------------------------------
-- BOOKINGS
--
-- Customers see only their own bookings. Staff see all — they need the day's
-- pickups and returns. Note that INSERT is NOT granted to anon here: guest
-- bookings are created server-side through /api/booking/create (via Prisma,
-- which bypasses RLS), so there is no need to open a write path through the
-- public API.
-- ---------------------------------------------------------------------------

drop policy if exists "bookings_own_read" on public.bookings;
create policy "bookings_own_read"
  on public.bookings for select
  using (
    customer_id = public.current_customer_id()
    or public.is_staff()
  );

drop policy if exists "bookings_staff_write" on public.bookings;
create policy "bookings_staff_write"
  on public.bookings for all
  using (public.is_staff())
  with check (public.is_staff());


-- ---------------------------------------------------------------------------
-- PAYMENT TRANSACTIONS — financial records
--
-- Customers may read transactions on their own bookings. Writes are
-- owner-only: nothing but the WiPay callback (server-side, via Prisma) should
-- ever create these, and a STAFF_AGENT has no reason to edit payment history.
-- ---------------------------------------------------------------------------

drop policy if exists "payments_own_read" on public.payment_transactions;
create policy "payments_own_read"
  on public.payment_transactions for select
  using (
    booking_id in (
      select booking_id from public.bookings
      where customer_id = public.current_customer_id()
    )
    or public.is_staff()
  );

drop policy if exists "payments_owner_write" on public.payment_transactions;
create policy "payments_owner_write"
  on public.payment_transactions for all
  using (public.is_owner_admin())
  with check (public.is_owner_admin());


-- ---------------------------------------------------------------------------
-- RENTAL AGREEMENTS — contain customer ID numbers
--
-- Read scoped to the owning customer. Only the owner-admin may modify.
-- ---------------------------------------------------------------------------

drop policy if exists "agreements_own_read" on public.rental_agreements;
create policy "agreements_own_read"
  on public.rental_agreements for select
  using (
    booking_id in (
      select booking_id from public.bookings
      where customer_id = public.current_customer_id()
    )
    or public.is_staff()
  );

drop policy if exists "agreements_owner_write" on public.rental_agreements;
create policy "agreements_owner_write"
  on public.rental_agreements for all
  using (public.is_owner_admin())
  with check (public.is_owner_admin());


-- ---------------------------------------------------------------------------
-- PROMOTIONS
--
-- Active promotions are readable by anyone: the discount is applied to prices
-- shown publicly on S2, so the promotion itself is not a secret. Expired and
-- future promotions stay hidden, since forthcoming campaigns are commercially
-- sensitive. Only the owner manages them (A7 is owner-only in middleware too).
-- ---------------------------------------------------------------------------

drop policy if exists "promotions_active_read" on public.promotions;
create policy "promotions_active_read"
  on public.promotions for select
  using (
    (start_date <= current_date and expiry_date >= current_date)
    or public.is_staff()
  );

drop policy if exists "promotions_owner_write" on public.promotions;
create policy "promotions_owner_write"
  on public.promotions for all
  using (public.is_owner_admin())
  with check (public.is_owner_admin());


-- ---------------------------------------------------------------------------
-- MAINTENANCE RECORDS — staff-only, same shape as every other staff table.
-- ---------------------------------------------------------------------------

drop policy if exists "maintenance_staff_provider_read" on public.maintenance_records;
drop policy if exists "maintenance_staff_read" on public.maintenance_records;
create policy "maintenance_staff_read"
  on public.maintenance_records for select
  using (public.is_staff());

drop policy if exists "maintenance_staff_write" on public.maintenance_records;
create policy "maintenance_staff_write"
  on public.maintenance_records for all
  using (public.is_staff())
  with check (public.is_staff());


-- ---------------------------------------------------------------------------
-- REVIEWS
--
-- Reviews are public content (S1 renders them to anonymous visitors), but a
-- customer may only write a review attached to their own booking.
-- ---------------------------------------------------------------------------

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read"
  on public.reviews for select
  using (true);

drop policy if exists "reviews_own_insert" on public.reviews;
create policy "reviews_own_insert"
  on public.reviews for insert
  with check (customer_id = public.current_customer_id());

drop policy if exists "reviews_own_update" on public.reviews;
create policy "reviews_own_update"
  on public.reviews for update
  using (customer_id = public.current_customer_id() or public.is_staff())
  with check (customer_id = public.current_customer_id() or public.is_staff());

drop policy if exists "reviews_staff_delete" on public.reviews;
create policy "reviews_staff_delete"
  on public.reviews for delete
  using (public.is_staff());


-- ---------------------------------------------------------------------------
-- USERS — the staff roster and, critically, the role column
--
-- A user may read their own row (middleware does exactly this). Only the
-- owner-admin may read the full roster or change anything.
--
-- This table is the most security-critical in the schema: write access to
-- `role` is write access to every other policy in this file, since they all
-- derive from it. Hence owner-only, with no staff exception.
-- ---------------------------------------------------------------------------

drop policy if exists "users_self_read" on public.users;
create policy "users_self_read"
  on public.users for select
  using (auth_user_id = auth.uid() or public.is_owner_admin());

drop policy if exists "users_owner_write" on public.users;
create policy "users_owner_write"
  on public.users for all
  using (public.is_owner_admin())
  with check (public.is_owner_admin());


-- ---------------------------------------------------------------------------
-- SYSTEM SETTINGS — deposit rate, cancellation terms, business details
--
-- Staff may read (the deposit rate is needed to quote a balance at pickup);
-- only the owner may change them. A9 is owner-only in middleware to match.
-- ---------------------------------------------------------------------------

drop policy if exists "settings_staff_read" on public.system_settings;
create policy "settings_staff_read"
  on public.system_settings for select
  using (public.is_staff());

drop policy if exists "settings_owner_write" on public.system_settings;
create policy "settings_owner_write"
  on public.system_settings for all
  using (public.is_owner_admin())
  with check (public.is_owner_admin());


-- ---------------------------------------------------------------------------
-- STORAGE — rental-agreements bucket
--
-- These PDFs contain customer ID numbers, so this is the single most sensitive
-- artefact the system produces. The bucket is private, but "private" alone
-- only means there is no public URL; without a policy, any authenticated user
-- could still read any object in it.
--
-- Files are written by the callback as: {customer_id}/{booking_ref}.pdf
-- The policy below scopes reads to the folder matching the caller's own
-- customer_id — the reason for that path layout.
-- ---------------------------------------------------------------------------

drop policy if exists "agreements_read_own" on storage.objects;
create policy "agreements_read_own"
  on storage.objects for select
  using (
    bucket_id = 'rental-agreements'
    and (
      (storage.foldername(name))[1] = public.current_customer_id()::text
      or public.is_staff()
    )
  );

-- No INSERT/UPDATE/DELETE policies are defined for this bucket. Uploads are
-- performed exclusively by the server using the service-role key, which
-- bypasses RLS. Granting write access to any client role would let a customer
-- overwrite their own signed agreement.

-- Vehicle photos are public marketing images; staff manage them.
drop policy if exists "vehicle_photos_public_read" on storage.objects;
create policy "vehicle_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

drop policy if exists "vehicle_photos_staff_write" on storage.objects;
create policy "vehicle_photos_staff_write"
  on storage.objects for insert
  with check (bucket_id = 'vehicle-photos' and public.is_staff());


-- ===========================================================================
-- Verification
--
-- After running this, confirm RLS is enabled everywhere:
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--   order by tablename;
--
-- Every row should show rowsecurity = true.
--
-- Confirm the grants from this run actually took effect — this is what was
-- missing and caused "permission denied for table users":
--
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee = 'authenticated'
--   order by table_name, privilege_type;
--
-- Should list select/insert/update/delete rows for `users` among the results.
-- ===========================================================================
