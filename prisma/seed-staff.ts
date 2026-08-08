import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Creates the staff accounts needed to exercise RBAC.
//
// Run with:  npx tsx prisma/seed-staff.ts
//
// This is separate from prisma/seed.ts because it does two things that the
// fleet seed does not: it talks to Supabase Auth (not just Postgres), and it
// creates credentials. Keeping it separate means a routine `prisma db seed`
// never silently recreates login accounts.
//
// Each account is created in Supabase Auth AND given a row in the users table.
// Both halves are required: Auth proves who you are, the users row says what
// you may do. Middleware and every RLS policy read the users row.
//
// SECURITY NOTE: the passwords below are deliberately obvious placeholders for
// a demonstration environment. They are printed to the console on creation so
// they can be recorded, and they should be changed before this system is used
// with real customer data.
// ============================================================================

const prisma = new PrismaClient();

const STAFF = [
  {
    email: "owner@tigerscarrental.tt",
    password: "TigersOwner2026!",
    firstName: "Kadesh",
    lastName: "Samlalsingh",
    role: "OWNER_ADMIN" as const,
  },
  {
    email: "adminassistantagent@tigerscarrental.tt",
    password: "TigersAgent2026!",
    // Deliberately a plain, obviously-placeholder name rather than a
    // job-title standing in for one ("Admin Assistant", "Rental Agent") —
    // combined with the role label already shown in the sidebar, a
    // job-title-as-name reads as a redundant, confusing display ("Admin
    // Assistant · Admin Assistant"). Replace with Kadesh's real admin
    // assistant's name once one is hired/assigned.
    firstName: "Demo",
    lastName: "Account",
    role: "STAFF_AGENT" as const,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    );
  }

  // The service-role key is required to create users without email
  // confirmation — a normal signUp() would leave these accounts unconfirmed
  // and unable to sign in until someone clicked a link in an inbox that does
  // not exist.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const person of STAFF) {
    let authUserId: string | undefined;

    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: person.email,
        password: person.password,
        email_confirm: true,
      });

    if (createError) {
      // Already exists from a previous run — find the existing user instead of
      // failing, so this script stays re-runnable.
      //
      // IMPORTANT: listUsers() defaults to a SMALL page size (not the full
      // list). The original unpaginated call here caused a real failure:
      // once enough customer accounts had accumulated from testing, the
      // owner account — created first, chronologically — was pushed onto a
      // later page, and a plain `.find()` against the default page alone
      // never found it, even though the account genuinely existed
      // (confirmed by createUser's own "already registered" error).
      //
      // Requesting a large page size fixes this at this project's actual
      // scale — a car rental business's total account count (staff +
      // customers) is nowhere near this number. If that ever changes, this
      // would need a real pagination loop instead of one large page.
      const { data: list } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const existing = list?.users.find((u) => u.email === person.email);

      if (!existing) {
        console.error(
          `  ✗ ${person.email}: ${createError.message} (and not found among the first 1000 existing users)`
        );
        continue;
      }
      authUserId = existing.id;
      console.log(`  • ${person.email} already existed in Auth — reusing`);
    } else {
      authUserId = created.user?.id;
      console.log(`  ✓ ${person.email} created in Auth`);
    }

    if (!authUserId) continue;

    await prisma.user.upsert({
      where: { email: person.email },
      update: { authUserId, role: person.role },
      create: {
        authUserId,
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        role: person.role,
      },
    });

    console.log(`    role ${person.role} recorded`);
  }

  console.log("\nStaff accounts ready. Sign in at /admin/login:\n");
  for (const person of STAFF) {
    console.log(`  ${person.role.padEnd(21)} ${person.email}  /  ${person.password}`);
  }
  console.log("\nChange these passwords before using real customer data.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
