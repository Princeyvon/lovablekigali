# Agency Hub

very strict on using the attached reference as front end design... use #63a46c and #e4f0d0 as accent colors and use gradients to create cool unique dash effects

# Agency OS — Complete Project Reference

## 1. Product summary

An internal operations platform for your own digital-solutions agency — the system that runs the business building systems for other businesses. It tracks every client relationship end to end: who brought them in, what was built and changed for them, their login credentials, their billing (including irregular multi-month payments), referrals, and your own team's pay and expenses — plus performance insights across all of it.

This is the one system where you're both the builder and the user, so it gets the same discipline you've applied to every client build: single source of truth, full audit trail, role-based access.

---

## 2. Tech stack

Same stack as your client builds — no reason to introduce a new one:

- **Framework:** TanStack Start v1 (React 19, file-based routing, SSR + `createServerFn`), Vite 7

- **Styling:** Tailwind v4, shadcn/ui primitives

- **Data:** TanStack Query; Supabase (Postgres + Auth + Storage)

- **Secrets:** credentials are the one place worth treating differently — see Section 5

---

## 3. Data model (Postgres, `public` schema)

| Table | Purpose / notable columns |

|---|---|

| `team_members` | Your own staff — `full_name`, `role` (Sales/Dev/Support/Admin), contact, `active` |

| `prospects` | Businesses approached, not yet signed — `business_name`, `industry`, `contact`, `assigned_rep`, `stage` (Contacted/Demo/Negotiating/Signed/Lost), `source` |

| `clients` | Signed clients — `business_name`, `contact`, `industry`, `onboarded_by` (FK team_members — **this is who gets credit/commission**), `signed_date`, `status` (Active/Paused/Churned) |

| `client_notes` | Freeform notes per client — `note_type` (General/Prompt Draft/Spec), `content`, `created_by`, `is_draft`. This is deliberately its own table, not folded into service logs, because a half-written prompt or spec idea isn't a change made — it's a scratchpad you'll come back to |

| `service_logs` | Every change/service performed for a client after signing — `date`, `category` (Bug Fix/Feature/Maintenance/Support Call), `description`, `logged_by`. This is your build history per client, auditable on its own |

| `client_system_users` | Metadata about the *client's own* deployed system — `user_count`, `admin_name`, `admin_contact`, `roles_breakdown` (free text or structured), `last_verified_date`. Not live-synced from their app; a snapshot you update when you know it's changed |

| `client_credentials` | The vault — `client_id`, `service_name` (Gmail/Hosting/Domain Registrar/DB/etc.), `username`, `encrypted_password`, `last_rotated`, `notes`. See Section 5 for how this is actually secured |

| `credential_access_log` | Who viewed which credential, when — append-only, never editable |

| `subscriptions` | `client_id`, `monthly_rate`, `billing_cycle`, `start_date`, `status` (Active/Paused/Cancelled) |

| `payments` | `client_id`, `amount`, `payment_date`, `months_covered` (usually 1, but can be 2, 3, 6...), `covers_period_start`/`covers_period_end` — this is what makes multi-month payments trackable rather than confusing |

| `commissions` | `rep_id`, `client_id`, `type` (Signing Bonus/Recurring %), `amount`, `status` (Pending/Paid), linked to the payment or signing event that triggered it |

| `referrals` | `referring_client_id` (or `referring_rep_id` if a team member refers), `new_prospect_id`, `date`, `reward_type`/`reward_status` if you reward referrals |

| `team_payouts` | Money sent to your own team — `team_member_id`, `type` (Commission/Salary/Reimbursement), `amount`, `date_sent`, `method` (Check/Mobile Money/Bank), `reference`, `note` |

| `expenses` | Agency's own costs — `date`, `category`, `amount`, `vendor`, `note`, `paid_by` |

| `weekly_snapshots` | `week_start`, new leads, deals closed, revenue collected, active client count, churned count — the raw data behind the velocity insights in Section 7 |

| `entity_events` | Append-only audit log on every table — who changed what, when, and why for sensitive edits (payment corrections, credential changes, commission adjustments) |

---

## 4. Multi-month payments & due-date reminders

This needs its own logic rather than a simple "next month" assumption:

- Each `payments` row records exactly how many months it covers and the period it covers (`covers_period_start`/`covers_period_end`), not just an amount.

- A client's **actual next due date** is computed as the end of their latest covered period — not a flat 30 days from last payment. So if a client pays for 3 months up front, the system correctly goes quiet on reminders for that client until month 3 is nearly up, instead of pinging you (or worse, them) monthly regardless.

- Reminders fire on a configurable window before the computed due date (e.g. 5 days out), routed to whoever owns the client relationship.

- The billing screen for any client shows "paid through [date]" as the headline fact, with the raw payment history underneath.

---

## 5. Credential vault — this is worth doing properly

Given how many client Gmail/hosting/domain logins will accumulate, I'd treat this as the one part of the system that deserves more care than a convenient plaintext table:

- Store `encrypted_password` encrypted at rest (application-level encryption or a secrets-manager integration), never plaintext in the database.

- Every read of a credential is logged in `credential_access_log` — same audit instinct you've built into every client system, applied to your own data first.

- Restrict who can view credentials at all by role (Section 6) — a sales rep who onboarded a client doesn't automatically need their hosting password.

- `last_rotated` plus a configurable staleness threshold (e.g. flag anything untouched for 12+ months) gives you a rotation reminder instead of passwords sitting forever.

---

## 6. Roles & access

| Capability | Admin (you) | Sales Rep | Dev/Support |

|---|---|---|---|

| Prospects & pipeline | ✅ All | ✅ Own | 👁️ View |

| Clients — general info | ✅ Edit | 👁️ View own onboarded | 👁️ View assigned |

| Client notes & service logs | ✅ Edit | ❌ | ✅ Edit assigned clients |

| Credentials vault | ✅ Full | ❌ | ✅ Assigned clients only |

| Billing & payments | ✅ Edit | 👁️ View own clients' status | ❌ |

| Commissions | ✅ Edit | 👁️ Own only | ❌ |

| Team payouts & expenses | ✅ Only | ❌ | ❌ |

| Insights | ✅ Full | 👁️ Own performance only | ❌ |

Same "onboarded_by drives visibility" pattern you used for FireGuard's sales reps — a rep sees the clients and commission tied to them, not the whole book.

---

## 7. Insights — velocity and performance

- **Weekly velocity** — new leads, deals closed, revenue collected per week, trended so slow vs fast weeks are visible at a glance rather than felt anecdotally.

- **Rep performance** — deals closed, revenue attributed, commission earned, per rep.

- **Revenue health** — MRR, upcoming renewals, overdue payments, churn with reasons.

- **Client profitability** — service log volume (time/effort) per client against what they pay, to spot clients that cost more to support than they're worth.

- **Referral yield** — how many signed clients came from referrals vs cold outreach.

---

## 8. Screens & features

- **`/dashboard`** — Due-this-week payments, overdue accounts, this week's velocity vs last week, credential rotation alerts.

- **`/prospects`** — Pipeline by stage, assigned rep.

- **`/clients` + `/clients/$id`** — Tabs: Overview, Notes (incl. draft prompts), Service Log, System Users, Credentials, Billing.

- **`/billing`** — All subscriptions, payment history, "paid through" view, multi-month entry.

- **`/referrals`** — Referral log and outcomes.

- **`/team`** — Team members, commissions, payouts (checks/bank/mobile money).

- **`/expenses`** — Agency expense ledger.

- **`/insights`** — Section 7 in full.

- **`/admin/audit`** — Full change log, including credential access history.

---

## 9. Conventions reused from your other tools

- `entity_events` audit trail on every table, with mandatory `change_reason` on financial and credential edits.

- RLS on every table, gated through role-check helper functions, with an `owns_client()` pattern for rep visibility.

- Server logic in `*.functions.ts` via `createServerFn`.

admin user will be: admin@lovable.solutions
password: Lovable0!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lovablekigali.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ff77db32-2226-464d-9330-8572473ffdbf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
