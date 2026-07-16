# RMS Merchant Seller Portal

## Purpose

The RMS Merchant Seller Portal is the workspace for businesses that sell to
retailers through RMS: general vendors, wholesalers, manufacturers,
distributors, exporters and fabric/raw-material suppliers.

One business has **one vendor identity and one login**. That identity can be
linked to several retailers (for example, CitiMart and Zudio). Each retailer
relationship has its own approval status, vendor code and purchase orders.
The vendor never receives access to a retailer's internal departments.

## How RMS acquires vendors

RMS supports three acquisition paths. For CitiMart, the first is the normal
and recommended route because CitiMart controls who is invited.

| Path | Who starts it | What happens |
| --- | --- | --- |
| **Retailer invitation** | CitiMart M-Buyer / Vendor List | The buyer enters the company name, contact, mobile, email and product category. RMS creates a secure, time-limited registration link. It can be emailed when SMTP is configured or copied and sent through WhatsApp/SMS. |
| **Public questionnaire** | A prospective vendor | The business completes `/vendor/questionnaire`, uploads sample product images and submits business, MOQ, price, lead-time and payment information. CitiMart reviews the lead, then accepts it and creates an invite. |
| **Self-registration** | A vendor discovering RMS | The vendor selects one or more available retailers during registration. RMS creates a separate **Pending** relationship with each selected retailer; each retailer approves or rejects only its own link. |

### CitiMart invitation journey

1. CitiMart opens **Merchandiser Buyer → Vendor List** and creates an invite.
2. RMS generates a registration link, normally valid for seven days.
3. CitiMart sends the link to the vendor by email, WhatsApp or SMS.
4. The vendor opens it, reviews the retailer information, fills the business
   profile and chooses one primary business type.
5. RMS creates the vendor identity (or reuses the same identity if that email
   already exists) and creates a **Pending** CitiMart relationship.
6. CitiMart approves the vendor in Vendor List. Approval is relationship
   specific: approval by CitiMart does not automatically approve the vendor
   for another retailer.
7. The vendor can sign in to the Merchant Seller Portal and begin maintaining
   the catalogue, receiving RFQs/POs and working with CitiMart.

### Public questionnaire journey

1. A lead opens the public questionnaire link and submits company, contact,
   product, commercial and sample-image details.
2. RMS stores the submission and sends an acknowledgement email when SMTP is
   configured.
3. CitiMart reviews the submission from **Vendor List → Questionnaires**.
4. CitiMart accepts the lead and sends the generated invitation link.
5. The process then continues through registration, approval and login.

> **Operational note:** The current public questionnaire is lead capture; it
> is not automatically attached to CitiMart until a CitiMart user reviews and
> accepts it. For a CitiMart-only campaign, use a CitiMart invitation link or
> clearly state CitiMart in the campaign message.

## Password setup and first access

There are two safe first-access cases:

1. **Password supplied while accepting an invitation:** RMS stores it securely
   and the vendor waits for retailer approval if approval is still pending.
2. **Password not yet supplied:** after approval, RMS sends a secure
   **Set up your password** link. The vendor chooses a password of at least
   eight characters.

After the password is set, the intended user journey is:

`set password → authenticated vendor session → /merchandiser-seller dashboard`

The current screen shows a success message and redirects to the vendor login
page; after login the vendor is sent to `/merchandiser-seller`. If direct
dashboard access immediately after setup is desired, the password endpoint
must return a vendor access token and the setup page must save that token
before navigating. Do not claim automatic dashboard login in vendor-facing
material until that small change is made.

## Common portal navigation

Every seller type uses the same sidebar. This keeps the product easy to learn
and avoids maintaining separate portals.

| Sidebar area | What the vendor can do |
| --- | --- |
| **Dashboard** | See a quick operational overview and open the working areas. |
| **My Categories** | Select the business classification and catalogue categories used in buyer and Business Network discovery. |
| **My Catalogue** | Add/manage sellable catalogue items with images, category, price range, MOQ, sizes, colours and descriptions; respond to buyer catalogue inquiries. |
| **Subscription** | See plan limits, current usage and upgrade options. |
| **WhatsApp** | Save the vendor's Meta/WhatsApp catalogue ID for future integration. |
| **Product List** | Maintain the vendor product list; add and edit the vendor's product records. |
| **Purchase Orders** | View retailer POs issued to this vendor, update allowed item information and submit the vendor response for buyer review. |
| **Purchase Invoices** | View purchase invoices connected to the vendor's retailer transactions. |
| **Finance & Analytics** | View invoiced, received, outstanding and overdue values; see payment history and raise a payment dispute. Vendor payment records themselves remain retailer-controlled. |
| **My Retailers** | See every linked retailer and its status: Pending, Approved, Rejected or Deactivated. Each card identifies whether it came from an invitation or self-registration. |
| **Business Network** | Opt in to marketplace discovery, find other RMS businesses and send/receive connection requests. |
| **Profile** | Maintain business profile information. |
| **Help & Support** | Access the RMS support contact details. |

## Business type: same portal, focused commercial use

Business type is a classification, **not a separate login role**. Today it
affects how the business is found in Business Network and how many business
type tags the current plan permits. It does not yet hide or add sidebar items.

| Classification | Best use of the current portal | Recommended future extension |
| --- | --- | --- |
| General vendor | Product catalogue, retailer relationships, quote/PO response and invoices. | Basic catalogue templates. |
| Wholesaler / distributor | Supply multiple retailers, manage larger catalogue ranges, price bands and repeat POs. | Retailer-specific price lists and availability by region. |
| Manufacturer | Publish made-to-order products, MOQ, lead time, colours/sizes and production capability. | Capacity calendar, sample approval and production milestones. |
| Exporter | Present export-ready products and connect with larger buyers. | Currency, Incoterms, export documents and shipment tracking. |
| Fabric/raw-material supplier | Publish fabric/material type, composition, colour, MOQ and lead time. | Roll/lot details, GSM, width, test certificates and shade cards. |

Those future extensions should be feature flags inside the common portal, not
new departments. This preserves the existing vendor workflow while allowing
the product to grow.

## Business Network

Business Network is an opt-in B2B directory for RMS businesses. A vendor must
first select a business type, then turn on marketplace visibility and provide
a short headline/description.

The vendor can:

- search visible businesses by name, category, business type and location;
- discover vendors, wholesalers, manufacturers, distributors, exporters,
  fabric suppliers and retailers that have opted in;
- send a connection request with a message;
- accept or decline incoming requests; and
- see the other business's contact details only after the connection is
  accepted.

This is intentionally separate from a retailer-vendor approval. A Business
Network connection is a mutual B2B introduction; it does not grant access to
another tenant's data or turn the two businesses into approved procurement
partners.

## Free plan and upgrade path

The free plan is useful enough for a vendor to try RMS, while upgrades unlock
visibility, scale and financial insight.

| Capability | Free | Standard — ₹499/month | Premium — ₹1,499/month |
| --- | ---: | ---: | ---: |
| Catalogue items | 5 | 10 | 25 |
| Photos per catalogue item | 1 | 3 | Unlimited |
| Catalogue visibility | 45 days | 45 days | 90 days |
| Business-type tags | 1 | 3 | Unlimited |
| Buyer inquiries per month | 20 | Unlimited | Unlimited |
| Business Network results per page | 8 | 20 | 40 |
| Business Network connection requests/month | 3 | 25 | Unlimited |
| Finance history | 3 months | 12 months | 36 months |
| Finance transaction view | 10 records | 100 records | 500 records |
| Finance export / retailer breakdown | No | Yes | Yes |
| Receipt forecast | No | No | Yes |
| Discovery priority / verified badge | No | Higher priority | Highest priority + badge |

### Upgrade messages that are honest and useful

- **Free → Standard:** “Show more product images, list up to three business
  types, connect with more businesses and export a full year of finance data.”
- **Standard → Premium:** “Gain longer catalogue visibility, unlimited media
  and connections, a verified discovery badge and 36-month finance insights
  with receipt forecasting.”

> **Important:** The current upgrade API uses a simulated payment flow for
> testing. Before charging real vendors, connect a real payment gateway
> (such as Razorpay or Stripe), verify payment webhooks server-side, and only
> then activate/renew a paid plan.

## WhatsApp status

The WhatsApp sidebar currently records a vendor's Meta catalogue ID. It is
not yet a live WhatsApp Commerce integration. Live catalogue synchronization,
messages and orders require the Meta app credentials, webhook verification,
approved phone number, catalog permissions and mounting the WhatsApp backend
routes. Until those are configured, describe it as **“prepare/connect your
Meta catalogue ID”**, not as a live order channel.

## Core procurement flow once a vendor is active

`Vendor catalogue → buyer search/RFQ → vendor quote or negotiation → buyer award → purchase order → vendor response → GRC/GRN and stock update on retailer side → invoice → payment and vendor finance visibility`

The vendor sees only the orders, invoices and payment insights that belong to
that vendor identity. Retailer stock, GRC/GRN operations and internal
departments remain retailer-side functions.

## External launch checklist

Before sharing public questionnaire or invitation links externally:

1. Configure production `VITE_API_URL` in the frontend and redeploy it.
2. Configure backend `FRONTEND_BASE_URL` and `CORS_ORIGINS` for the public
   RMS frontend domain.
3. Add a Render SPA rewrite (`/*` to `/index.html`) so direct links such as
   `/vendor/questionnaire` and password setup links load correctly.
4. Configure SMTP and test the invite, password-setup and questionnaire
   acknowledgement emails.
5. Configure Cloudinary credentials and test image upload from the public
   questionnaire.
6. Replace simulated subscription upgrades with verified payment processing
   before offering paid plans.
7. Test the full CitiMart journey with a sample vendor: invite, registration,
   approval, login, catalogue, PO, invoice and Business Network opt-in.

