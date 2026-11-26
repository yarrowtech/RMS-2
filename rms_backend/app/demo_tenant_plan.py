# ─────────────────────────────────────────────────────────────────────────
# DEMO TENANT / DEMO VENDOR — PLANNED, NOT YET BUILT
#
# This file is intentionally never imported anywhere. It exists only to
# hold the agreed plan so it survives between sessions. Build from this
# when the user says to start.
#
# GOAL
# A real, live tenant + vendor (not the separate static rms-demo folder)
# that a prospective buyer can click through and genuinely use — generate
# a real fake bill in Cashier with correct GST/tax math, raise a real fake
# PO, see it flow into GRN — using the actual production business logic,
# not a replay/mock. The separate rms-demo folder stays as-is for a
# zero-backend, instantly-shareable marketing walkthrough; this is a
# different tool for a different job (a hands-on sales demo).
#
# WHY NOT THE STATIC rms-demo FOLDER FOR THIS
# rms-demo replays pre-recorded responses; writes are hand-mocked ("just
# return generic success"). It can't do live tax/stock computation. Reusing
# the real codebase means zero duplication and zero drift as real features
# change — the alternative is reimplementing business logic a second time
# in a second codebase and hand-syncing it forever.
#
# WHY THIS IS SAFE IN THE REAL CODEBASE
# The system's existing multi-tenant isolation (same guarantee that keeps
# Citimart and Raphaaa apart) covers a demo tenant automatically — it's
# just one more tenant. The only genuinely new risk surface is external
# side-effects (money, email, SMS) actually firing for fake data, which is
# a small, finite, auditable list (see Phase 2 below), not an open-ended one.
#
# STEP-BY-STEP PLAN
#
# Phase 0 — local test database (safety net while building, optional but
# recommended): point a LOCAL .env (never the real production one) at a
# separate MongoDB — local install or a separate Atlas cluster — so none of
# this is ever built/tested against real Citimart/Raphaaa data. A clean
# USE_TEST_DB-style config switch was prototyped and then reverted per user
# request (2026-11-25) — rebuild it here first if a safe non-prod DB is
# available when this work resumes.
#
# Phase 1 — core mechanics:
#   1. Add `is_demo: true` as a field on the tenant document (demo retailer)
#      and on the vendor document (demo vendor) — the one flag everything
#      else checks.
#   2. Guard the five external side-effect paths so is_demo skips/simulates
#      instead of doing the real thing:
#        - Razorpay checkout/verify (retailer_seat_addon_routes.py,
#          retailer_store_addon_routes.py, retailer_pos_addon_routes.py,
#          retailer_subscription_routes.py, store_upgrade_routes.py)
#        - SMTP email send (email_utils.py's _send)
#        - Fast2SMS send (sms_utils.py)
#        - WhatsApp notifications (wherever that integration lives)
#        - Anthropic calls (catalogue_routes.py vendor-copilot/ask,
#          my-catalogue/assistant)
#   3. Add `demo_expires_at` stamping: one shared helper, called from the
#      normal save paths (bill save, PO creation, stock adjustment, etc.),
#      that sets `demo_expires_at = utcnow() + timedelta(hours=12)` ONLY
#      when writing under the demo tenant/vendor. Seed/baseline fixtures
#      never get this field, so they never expire.
#   4. Add a TTL index per collection that receives demo writes:
#      `expireAfterSeconds=0` on `demo_expires_at` (absolute-time semantics
#      — deletes at the stored time, not a fixed duration from index
#      creation). MongoDB's background sweep (~60s interval) handles
#      deletion with no cron job needed. Real-tenant documents never have
#      this field, so they're entirely unaffected.
#      Open question (not yet decided): fixed 12h from creation, or sliding
#      12h from last demo activity (more robust for a long guided sales
#      call where early actions might otherwise vanish mid-demo)?
#
# Phase 2 — seed data:
#   5. Seed script for the demo retailer tenant: products, stores, opening
#      stock, customers — realistic fake data, inserted WITHOUT
#      demo_expires_at (permanent baseline).
#   6. Seed script for the demo vendor: fake catalogue + pricing, also
#      permanent (no demo_expires_at).
#   7. Link the demo vendor to the demo tenant via
#      vendor_tenant_links_collection, so the full B2B loop (discover →
#      raise PO → vendor confirms/dispatches → tenant receives as GRN)
#      can be demoed end-to-end in one sitting.
#   8. Pre-create demo logins: one per department on the retailer side
#      (HQ Admin, Cashier, Inventory, Finance, ...) plus one on the vendor
#      side — handed out directly for sales use, no real onboarding/review
#      flow.
#
# Phase 3 — verify, then ship:
#   9. Manually run through every department: generate a bill, raise a PO,
#      confirm no real email/SMS/charge fired, confirm TTL actually cleans
#      up garbage after the window, confirm seed data survives untouched.
#  10. Ship the same way every other change this session has shipped —
#      direct to the real repo/production, once the guards are verified.
#
# RELATED, SEPARATE PROBLEM SURFACED DURING THIS DISCUSSION (not part of
# the demo-tenant build, but worth its own fix eventually): a real retailer
# tenant acting as a vendor to another tenant (e.g. Raphaaa selling to
# Citimart) currently maintains two disconnected stock pools — its own
# tenant-scoped inventory_collection/store_stock_collection, and a separate
# vendor_inventory_collection keyed only by vendor_id, with nothing syncing
# the two. Proposed fix (not built): a `linked_tenant_id` field on the
# vendor doc (settable only from inside that tenant's own HQ dashboard, so
# ownership is already proven), making vendor-side "My Inventory" a live
# read-through of the tenant's real central inventory instead of a copy,
# and B2B dispatch deduct directly from that same real collection (tagged
# source: "b2b_dispatch") so it shows up in the tenant's own Stock Ledger
# automatically. Open question: does B2B draw from the tenant's central/HQ
# pool only, or can individual stores opt in?
# ─────────────────────────────────────────────────────────────────────────
