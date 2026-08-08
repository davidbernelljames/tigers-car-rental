<div align="center">

# Tiger's Car Rental

<img src="https://readme-typing-svg.demolab.com?font=Georgia&size=20&pause=1500&colors=C8102E,000000,C8102E&center=true&vCenter=true&width=650&lines=Full+stack+booking+and+management+system;Built+for+a+real+car+rental+business;Trinidad+and+Tobago" alt="Typing animation" />

**A full stack booking and management system I built for a real, independently owned car rental business in Trinidad and Tobago, replacing WhatsApp messages and paper forms with a live, integrated web application.**

![Live Site](https://img.shields.io/badge/Live-tigers--carrental--prototype.vercel.app-orange?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase)
![WiPay](https://img.shields.io/badge/WiPay-Payments-C2540A?style=flat-square)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)

*(Live Site links to [tigers-carrental-prototype.vercel.app](https://tigers-carrental-prototype.vercel.app/))*

<br>

| 9 | 6 | 38 | 2 |
|:---:|:---:|:---:|:---:|
| Admin Screens | Live Reports | Test Cases | Full Prototype Cycles |

</div>

---

## About

Tiger's Car Rental is a small, real car rental operator based near Piarco International Airport, Trinidad. It was previously run entirely through WhatsApp messages, phone calls, and a paper booking form. I built this to replace that process from start to finish with a fully functional, deployed web application, real time vehicle availability, secure online payment, and a complete administrative back office, all built around this specific business's actual, confirmed practices rather than generic assumptions about how a car rental company operates.

This is my **Senior Seminar I & II** capstone project for a Bachelor of Science in Information Systems Management at UWI‑ROYTEC.

> This repository is shared publicly so the project's evolution, architecture, and real engineering decisions can be reviewed and read through. It is not intended for cloning, reuse, or redeployment, so I've intentionally left out setup and installation instructions. If you'd like to discuss the project or its code in more depth, reach out directly rather than standing up your own copy.

---

## Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Evolution](#project-evolution)
- [Project Structure](#project-structure)
- [Author](#author)

---

## Features

<table>
<tr>
<td valign="top" width="50%">

**Customer Facing**
- Real time vehicle search and category filtering
- A calendar directly on the booking form showing which dates are actually free, blocked dates are visually greyed out and unselectable, rather than only surfacing a conflict after submitting a range
- Full booking flow with server and client side validation
- Secure payment through WiPay's hosted checkout, no card details ever touch the app's own database
- Booking lookup by reference and email, works for guests and signed in customers alike, though its real value is for guests, who have no other way to reach a booking at all
- Signed in account portal with booking history, agreement downloads, and an editable profile
- Post rental reviews, surfaced live as homepage testimonials
- Self service extension requests and cancellation, with the refund policy shown before confirming
- Active promotions shown directly on vehicle cards while browsing, not only at checkout

</td>
<td valign="top" width="50%">

**Administrative**
- Full booking pipeline, with vehicle condition recorded at both pickup and return
- Fleet, customer, promotions, staff, and maintenance management, including real photo uploads with the option to remove one afterward
- Six live, database driven reports with CSV and PDF export and an adjustable date range
- Role based access control enforced at both the route layer and the database layer

**Under the Hood**
- Automated email for confirmations, reminders, feedback requests, and business enquiries submitted through Contact, confirmed working end to end
- Extension flow with three separated steps, so staff never handle a customer's payment directly
- Vehicle availability checked in both directions, booking against maintenance and maintenance against booking
- Row Level Security policies mirroring every application layer access rule

</td>
</tr>
</table>

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database & ORM | Supabase (PostgreSQL) + Prisma |
| Auth | Supabase Auth |
| Payments | WiPay |
| Email | Resend |
| Styling | Tailwind CSS + shadcn/ui |
| PDF Generation | @react-pdf/renderer |
| Hosting | Vercel |

---

## Project Evolution

I didn't build this system all at once. It grew through several distinct phases, each shaped by my direct, ongoing consultation with the actual business owner rather than assumptions about a typical car rental operation.

**Phase 1: 1st Low Fidelity Prototype**
Early wireframes exploring the core booking concept, covering screen flow and layout only, with no working functionality yet. This established the basic shape of the customer journey and admin structure before I wrote any real code.

**Phase 2: Senior Seminar I, System Analysis**
Full stakeholder analysis, PESTLE and market research, gap analysis, and requirements gathering I conducted directly with Tiger's Car Rental's owner. This identified the real problem, a business capable of real growth, bottlenecked entirely by manual, one at a time WhatsApp coordination.

**Phase 3: Solution Implementation Plan**
Detailed technical planning, including architecture decisions (Next.js, Prisma, Supabase, WiPay), algorithm design, and a full test plan, laying the groundwork for actual implementation.

**Phase 4: 1st Solution Prototype**
My first genuinely working, deployed version, including the core booking flow, foundational admin screens, and an initial WiPay integration I proved against a real sandbox transaction.

**Phase 5: 2nd Solution Prototype, Current**
A substantial expansion, shaped by real testing and my direct, repeated confirmation with the business owner.

- **Full 9 screen admin portal** covering bookings, fleet, customers, promotions, maintenance, staff, settings, and six live reports
- **Guest self service**, including a Find My Booking feature reachable without ever needing an account
- **Business rules corrected against real practice rather than assumption**, including a flat late fee, a confirmed two day minimum rental, and vehicle categories matched to the real four vehicle fleet
- **The maintenance provider role removed entirely** once I confirmed real providers work by phone and WhatsApp rather than logging in, replaced with a simple internal directory
- **The rental extension flow rebuilt from one function into three** after testing showed the original design let staff handle a customer's payment directly, now fully separated so staff never touch WiPay
- **A recurring Row Level Security permissions gap** between Supabase and Prisma created tables, which I diagnosed and documented after it repeatedly caused staff logins to misroute following schema resets
- **A second wave of refinement**, added after the core system was already live: real vehicle photo uploads, an editable customer profile, report export with an adjustable date range, and vehicle condition recording extended to cover return as well as pickup
- **A quiet but real gap I closed**, once I tested directly: vehicle availability was only ever checked in one direction, a booking correctly avoided scheduled maintenance, but scheduling maintenance never checked for an existing booking. I now enforce both directions, and the maintenance form itself shows the conflict before the form is even submitted
- **Automated email delivery configured and confirmed working**, with a real booking confirmation email received after a complete signup to payment test
- **Customer self service cancellation added**, after a live demonstration surfaced that the full cancellation policy, refund calculation, and calendar release already existed but had no customer facing surface at all. I extended it to cover guests and signed in customers alike, reusing the same reference and email verification already used for booking lookup and extensions rather than requiring an account
- **Promotions made visible while browsing, not only at checkout**, once it was pointed out that an automatically applied discount a customer never saw until deep into booking wasn't much of a promotion at all. I reused the same matching logic already calculating the discount to also drive a badge and a struck through price shown directly on vehicle cards, on both the homepage and the full catalogue
- **Find My Booking moved into the primary navigation**, out of the footer where it sat oddly beside legal links, so guests have as visible a path to their own booking as signed in customers have to My Account
- **A round of interface polish**, prompted by testing on a real screen rather than caught by any compiler: mismatched button and input heights on the extension request form, and table columns that stretched wider than their content ever needed
- **The Contact form actually wired to send**, after finding it had only ever been logging submissions to a server console, a harmless placeholder while email wasn't configured, but a real gap once it was. It now sends straight to the business inbox with the sender's own address set as reply to
- **A real calendar replacing the plain date inputs on Booking Details**, after testing surfaced an unnecessary extra click, a vehicle already unavailable for a chosen range only revealed that after submitting it. Blocked dates now show directly on the calendar itself, and the greying-out logic deliberately mirrors the exact boundary rules already enforced server side, a booking's own return day stays selectable as a new pickup, a maintenance day does not, so the calendar can never show something as free that the server would then reject anyway
- **A real access control gap closed on the staff side**, found through testing rather than a code review: signing in as a staff account landed on the owner's own dashboard, real revenue figures included, and stayed there indefinitely, nothing had ever actually redirected staff away, unlike every other financially sensitive screen, which was already correctly restricted. One route had simply been left off that list
- **A known category of post-login flakiness mitigated**, an occasional stale page or 404 immediately after signing in, resolved by a manual refresh. Switched that one redirect from a client-side navigation to a hard one, so the browser carries a freshly written session cookie through a genuine new request rather than racing it against a client-side fetch
- **A type conversion gap found in the photo upload endpoint**, found through testing: uploading a photo saved correctly every time, but the price field came back from that one response as a string rather than a number, the same conversion already applied everywhere else it mattered had simply been missed on this one route, and crashed the fleet table trying to format it. Same fix as the established pattern next to it
- **A way to remove a vehicle photo, not just add one**, distinguishing a photo that's only been picked locally, cleared with nothing to tell the server, from one already saved, which now removes the actual file from storage rather than just clearing the reference and leaving it behind unused
- **Deployed live on Vercel**, connected to a real Supabase Postgres database and a live WiPay sandbox integration
- **Migrated to GitHub** for version controlled, automatic deployment

---

## Project Structure

```
app/
  (customer)/     Customer facing pages
  (admin)/        Admin portal pages
  (admin-login)/  Admin authentication
  (auth)/         Shared password reset flow
  api/            All backend routes
components/       React components, organised by domain
lib/              Business logic, validation, and integrations
prisma/           Schema, migrations, and seed scripts
supabase/         Row Level Security policies
```

---

## Author

<div align="center">

**David James**
Bachelor of Science in Information Systems Management, UWI‑ROYTEC
Senior Seminar I & II Capstone Project

*Built by me, for and with Tiger's Car Rental, Piarco, Trinidad and Tobago.*

</div>
