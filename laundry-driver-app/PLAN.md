# NClean Driver App (Flutter): development plan

The delivery partner (delivery boy) app. Drivers sign in with their mobile number and an OTP, see the pickups and deliveries assigned to them, navigate to the customer, and update each order's status, from picked up all the way to delivered.

- **Folder:** `laundry-driver-app/`. The Flutter project is created here in Phase 0.
- **Backend:** `laundry-backend`, through the driver API under `/api/v1/drivers`.
- **Who creates drivers:** the admin or branch manager, on the admin panel's **Delivery Boys** page. Each driver belongs to one store (location).
- **Who assigns orders:** the admin or manager, on **Order Status** with the "Assign" button. The driver app only shows orders assigned to the signed-in driver.
- **Brand (2026-10-18):** NClean, the same as the user app (teal `#00857A`, navy `#062C5A`, wave blue and sky), with a "Partner" badge so the two apps aren't confused. The launcher icon has a light sky background, while the user app's is white.

---

## 1. Login: mobile number + OTP only

The flow is the same as in the user app (Sign In → 4-digit OTP → Home), with one difference: **only numbers already registered as drivers can sign in**. There is no self sign-up. An unknown number sees: *"This number isn't registered as a delivery partner. Please contact your store."*

> **Backend: ready (D1 done on 2026-10-18).** The OTP endpoints below are live. The older email + password login (`POST /drivers/login`) still works, but the app shouldn't use it.

| Step | Screen | API |
|---|---|---|
| 1 | Sign In: mobile number (+91) | `POST /drivers/send-otp { phone }`: only for active drivers, never creates an account. Unknown, customer and other staff numbers all get the same 404 *"This number isn't registered as a delivery partner…"* |
| 2 | Verify OTP: 4 boxes and a 30 s resend timer | `POST /drivers/verify-otp { phone, otp }` → `{ user, token, refreshToken, isNewUser }` (the same shape as the customer `/auth/verify-otp`) |
| 3 | Resend OTP | `POST /drivers/resend-otp { phone }` |
| 4 | Stay signed in / logout | `POST /auth/refresh-token`, `POST /auth/logout` |

The OTP rules are the same as for customers: 5-minute expiry, a 30-second resend cooldown, and after 5 wrong attempts a 30-minute lock (429). If the store deactivates a driver, they get a 403 on the next call and are signed out. A driver's OTP can't be used to sign in to the customer app, and the reverse is also true.

---

## 2. Tech stack

The stack is the same as the user app, so code and developers can move between the two:
- Flutter 3.47 / Dart 3.13, `flutter_riverpod`, `go_router`, `dio`, `freezed`, `flutter_secure_storage` and `pinput`.
- Firebase for push and Crashlytics.

Driver-specific packages:

| Need | Package |
|---|---|
| Call the customer, open Google Maps navigation | `url_launcher` (`tel:` and Maps intent with lat/lng or the address text) |
| Delivery proof photo | `image_picker` + image compression |
| On-duty location (optional, Phase 4) | `geolocator` (foreground only at first; background tracking later if needed) |

**Shared code.** The `core/` layer (network, auth interceptors, theme, widgets) starts as a copy of the user app's from Phase 0. If both apps keep growing, it can move into a shared local package (`packages/istreecare_core`).

```
lib/
  core/       config, network, storage, theme, router, widgets
  features/
    auth/       sign in, OTP
    home/       dashboard + stats
    tasks/      pickups, deliveries, completed lists
    order/      order detail, status actions, proof, failed attempts
    profile/    driver profile, duty toggle, logout
    notifications/
```

---

## 3. How a driver's day works (status flow)

The order statuses already exist in the backend, and the driver endpoint enforces the allowed transitions.

| Tab in the app | Order status | Driver action → new status |
|---|---|---|
| **Pickups** | `confirmed`, `pickup_scheduled` | **Picked up** → `picked_up` (confirm the item count, add notes such as stains or damage) |
| **To store** | `picked_up` | **Handed to store** → `in_process` |
| **Deliveries** | `ready` | **Start delivery** → `out_for_delivery` |
| | `out_for_delivery` | **Delivered** → `delivered` (collect cash if COD, take a proof photo) · **Couldn't deliver** → back to `ready` with a reason *(needs D3)* |
| **Completed** | `delivered` | History only |

Every card shows the order number, time slot, customer name, area, the item count, the amount to collect (for COD), and **Call** and **Navigate** buttons.

---

## 4. Phases

The time estimates assume one Flutter developer. The **D-numbers** refer to the backend changes in section 5.

> **Progress (2026-10-18):** Phases 0–**3** are done. Phase 3 was checked end to end with the customer app on the dev backend. The order the customer booked appears in Pickups with "Collect ₹220", and then:
> - Couldn't pick up ("Customer not available" plus a note) shows "1 failed attempt".
> - Picked up (2 pieces), then Handed to store; the order shows At store.
> - After the store marks it Ready: Start delivery, then Delivered. Too little cash is blocked; ₹220 marks the order paid.
>
> `booking_events` recorded every step. 15 tests pass and `flutter analyze` is clean. Proof photos are covered by the backend smoke test (the camera can't be driven in the browser preview).
>
> Phase 2 notes: Phase 2 was checked with a real dev driver (Suresh):
> - The task tabs show counts.
> - The Deliveries card has Call (Navigate is off for a POS order with no address).
> - The order detail shows the customer, payment, notes, items and store.
> - The profile shows the store from `/profile`.
>
> D2 is done. `flutter analyze` is clean and 12 tests pass. Status buttons come in Phase 3.
>
> Phase 0 and 1 notes: They were checked on the dev backend in a phone-sized browser preview:
> - A customer's number is refused.
> - The test driver signs in with OTP and the wrong-code message shows.
> - The dashboard shows `/drivers/stats`.
> - After the store deactivated the driver, the next launch signed them out.
>
> `flutter analyze` is clean and 6 tests pass. The driver's store name isn't shown yet, because `GET /profile` doesn't return it (added to D2).

### Phase 0: Project setup (≈ 2–3 days) ✅
- Run `flutter create` with app id `com.tallygen.partner` (confirmed 2026-10-18), targeting Android first. Drivers are mostly on Android; iOS is optional.
- Set up the dev and prod environments, a launcher icon (the logo with a "Partner" badge), the splash screen, the theme and the core layer (copied from the user app).
- Add the Android app to the Firebase project.
- **Done when:** the app launches against the dev backend.

### Phase 1: Login & profile (≈ 1 week) ✅
- Splash with `GET /onboarding/app-config` (force update and maintenance).
- The OTP sign-in from section 1, plus the "not registered" and "account deactivated" states.
- **Profile:** name, phone and store name, plus logout. Vehicle type isn't stored by the backend yet (see D6).
- **Done when:** a driver created in the admin panel can sign in with OTP. D1 is done, so nothing blocks this phase.

### Phase 2: Dashboard, task lists & order detail (≈ 1.5 weeks) ✅
- **Home dashboard:** today's orders, active, and delivered (`GET /drivers/stats`).
- **Task tabs:** Pickups / To store / Deliveries / Completed, from `GET /drivers/my-orders?status=…`. Pull to refresh.
- **Order detail:**
  - Customer name and phone, the full address with landmark, and a map preview from the address lat/lng.
  - Time slot, items with quantities, colour and size, and the customer note.
  - Payment method and the amount due.
- Buttons: **Call customer** and **Navigate** (Google Maps).
- **Done when:** a driver sees exactly the orders assigned to them, grouped by what they have to do next.

### Phase 3: Pickup & delivery actions (≈ 1.5 weeks) ✅
- The status buttons from section 3 (`PATCH /drivers/orders/:id/status`), each with a confirmation sheet. They're disabled while saving, and the error message from the backend is shown (for example *"Cannot change status from … to …"*).
- **Pickup:** confirm the item count and add notes or photos of damaged clothes *(storing notes and photos needs D5)*.
- **Delivery:**
  - "Cash collected ₹___" for COD orders *(D4)*.
  - A proof photo, or the customer's delivery OTP *(D5)*.
  - "Couldn't deliver" with reasons (customer not available, wrong address, rescheduled) *(D3)*.
- **Done when:** a driver can complete a full pickup → store → delivery cycle from the phone, and the admin panel's Order Status page updates to match.

### Phase 4: Notifications & duty status (≈ 1 week)
- **Push when a new order is assigned** or an order is changed or cancelled. Tapping it opens the order. Needs **D7** (part of the shared Firebase work).
- **On duty / Off duty** toggle, so the admin only assigns orders to drivers who are working *(D6)*.
- Optional: share the driver's location while on duty, so the admin can see where drivers are *(D6)*.
- **Done when:** a driver gets a push within seconds of being assigned, and the admin can see who is on duty.

### Phase 5: History, QA & release (≈ 1 week)
- **History:** delivered orders by date, and a daily summary of how many were delivered and how much cash was collected.
- Testing: poor network on the road (retry, never double-submit a status), app restart in the middle of a delivery, OTP edge cases.
- **Release:** Play Store internal or closed testing for the drivers (or a signed APK shared by the store), with Crashlytics turned on.

**Total: about 6–7 weeks** for one developer. The recommended start is after User app Phase 1, so the core layer and login are reused. With a second developer it can run in parallel from day one.

---

## 5. Backend changes the driver app needs

These are changes in `laundry-backend` and the admin panel. Order listing, stats and status updates already exist.

| # | Change | Needed by |
|---|---|---|
| D1 | ✅ **Done (2026-10-18). Driver OTP login:** `POST /drivers/send-otp`, `/drivers/verify-otp` and `/drivers/resend-otp`. Only existing, active drivers can sign in, and no account is created. It shares the customer OTP logic. **Email and password are now optional** on the admin **Delivery Boys** form; the phone is required, must be a valid mobile number, and must be unique. | Phase 1 |
| D2 | ✅ **Done (2026-10-18).** Supports `?status=a,b` and `?date=YYYY-MM-DD`, with `page` and `limit` (up to 100). It is still a plain array, and each order now includes `stage`, `customer {name, phone}` (address → POS name → account), `store`, `itemCount` and `amountToCollect`. Open orders are sorted by pickup date and slot; finished ones newest first. `GET /profile` returns the staff member's `location`. Originally planned as: **Better `my-orders`:** <ul><li>Paging and a date filter.</li><li>The customer's name and phone from their account when the address has none.</li><li>The store's name, address and phone for the "To store" drop-off.</li><li>The amount to collect for COD.</li><li>The driver's own store (name, phone) in `GET /profile`, for the profile screen.</li></ul> | Phase 2 |
| D3 | ✅ **Done (2026-10-18).** `POST /drivers/orders/:id/failed {reason, note?, photo?}`. At the pickup stage the status stays and a `pickup_failed` event is recorded. When out for delivery, the order goes back to `ready` with a `delivery_failed` event. `my-orders` shows `failedAttempts` and `lastFailure`. Original issue: **Failed delivery:** let drivers move `out_for_delivery` → `ready` with a reason (today only admins can), and record failed pickup attempts | Phase 3 |
| D4 | ✅ **Done (2026-10-18).** Delivering an unpaid COD order requires `cashCollected` ≥ the amount due; the order is then marked paid and a `cash_collected` event stores the amount. Original issue: **COD collection:** record the cash collected on delivery (mark the payment as paid, store the amount and the driver) | Phase 3 |
| D5 | ✅ **Done (2026-10-18).** An optional `photo` (base64 JPEG / PNG / WebP, max 5 MB) on any status change or failed attempt is saved under `uploads/proofs/` and linked on the event. The pickup sheet takes a piece count and a note. A customer delivery OTP isn't built (it's a client decision). Original issue: **Photos and proof:** an upload endpoint for proof-of-delivery and pickup-damage photos, and optionally a 4-digit delivery OTP sent to the customer | Phase 3 |
| D6 | **Duty status and location:** endpoints to set on/off duty and send the current location, shown on the admin's assign dropdown. A `drivers` table with `isAvailable`, `currentLat`, `currentLng` and `vehicleType` already exists, but no code writes to it yet. Create the row when a delivery boy is added (today the vehicle type entered there is dropped). | Phase 4 |
| D7 | **Push to driver on assignment:** `assignDriverToBooking` sends a Firebase push. This is part of the shared Firebase work (B2 in the user app plan). | Phase 4 |
| D9 | ✅ **Done (2026-10-18).** Admin **Order Status** cards show a red badge with the failed-attempt count and last reason. A **History** button opens a timeline: who and when, status change, reason or note, piece count at pickup, cash collected, and proof photo thumbnails that open full size. Backed by `GET /api/v1/admin/bookings/:id/events` (managers only see their own store). Staff status changes and driver assignments are now recorded too, and the staff `/bookings` list includes `failedAttempts` and `lastFailure`. Original issue: **Show driver events in the admin panel.** On Order Status, show failed attempts with their reasons, cash collected, the piece count at pickup, and proof photos (from `booking_events`). Admin status changes aren't recorded there yet. | Next |
| D8 | *(Optional)* **Separate pickup and delivery drivers.** Today a booking has one `driverId` for both legs. | Later |

The shared items are B1 (a real SMS provider for OTP) and B2 (Firebase push). They're described in `laundry-user-app/PLAN.md`.

---

## 6. Open questions for the client
1. App name and id (`NClean Partner` / `com.tallygen.partner`, confirmed), and is it Android only?
2. Will the same driver do both the pickup and the delivery of an order, or can they be different people (D8)?
3. Proof of delivery: a photo, a customer OTP, or both?
4. Should drivers see earnings or incentives in the app, or only order counts and cash collected?
5. Do drivers need live location tracking visible to the admin or the customer, or is on/off duty enough for v1?
