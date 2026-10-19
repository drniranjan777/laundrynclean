# NClean User App (Flutter): development plan

The customer app for NClean, a premium ironing and laundry service with doorstep pickup and delivery. Customers sign in with their mobile number and an OTP, choose clothes, book a pickup slot, pay, and track the order until it is delivered.

- **Folder:** `laundry-user-app/`. The Flutter project is created here in Phase 0.
- **Backend:** `laundry-backend` (Node/Express + Postgres). The app uses the public API under `/api/v1`.
- **Designs available:** splash, onboarding, sign-in (with the invalid-number error), and choose location (pincode or current location). They are in `Screens/`. Every other screen follows the same style until designs arrive.
- **Brand (2026-10-18): NClean.** The colours come from the logo: teal `#00857A` for the main buttons (a deeper shade of the logo teal `#05AB9C`, so white text is readable), navy `#062C5A` for text and accents, and the wave colours blue `#007BCA` and sky `#02BEFC`. The admin panel uses the same colours.

---

## 1. Login: mobile number + OTP only

There is no email or password and no social login. The backend already supports this flow.

| Step | Screen | API | Rules the backend enforces |
|---|---|---|---|
| 1 | Sign In: enter mobile number (the `+91` prefix is fixed) | `POST /auth/send-otp { phone }` | 10-digit Indian number; otherwise *"Please enter a valid mobile number"* (matches the design). A new number creates a customer account automatically. A staff number gets a 403 (B4). |
| 2 | Verify OTP: 4 boxes, a 30 s resend timer, and "Change number" | `POST /auth/verify-otp { phone, otp }` | The OTP is **4 digits** and valid for **5 min**. After **5 wrong tries** the number is locked for **30 min**; the API returns 429 with a message. |
| 3 | Resend OTP | `POST /auth/resend-otp` | 30 s cooldown (429 if requested sooner) |
| 4 | New user only: "Tell us your name" (name required, email optional) | `PUT /profile` | `isNewUser` comes back from verify-otp |
| 5 | Stay signed in | `POST /auth/refresh-token` | The access token is refreshed silently. A failed refresh sends the user back to Sign In. |
| 6 | Logout | `POST /auth/logout` | Clears the stored tokens |

- A blocked account returns 403 with *"Your account has been blocked…"*; the app shows it as is.
- **Dev testing:** in development the backend prints the OTP in its console (`[DEV] OTP for 98xxxxxxxx: 1234`) instead of sending an SMS.
- **Android:** SMS auto-read of the OTP (SMS Retriever API) is added in Phase 1 once the real SMS template exists.

---

## 2. Tech stack

| Area | Choice | Why |
|---|---|---|
| Flutter / Dart | Flutter 3.47 stable, Dart 3.13 (installed at `C:\src\flutter`) | |
| State management | `flutter_riverpod` | Simple, testable, works well with async API calls |
| Navigation | `go_router` | Auth redirects (signed out → Sign In) and deep links from push notifications |
| HTTP | `dio` with interceptors | Attaches the token, refreshes it on 401, and maps the backend error `message` into a UI error |
| Models | `freezed` + `json_serializable` | Typed API models |
| Secure storage | `flutter_secure_storage` (tokens), `shared_preferences` (onboarding seen, last pincode) | |
| OTP input | `pinput` (+ `smart_auth` for Android SMS auto-read) | |
| Location | `geolocator` + `geocoding` | Covers "Use my current location" |
| Payments | `razorpay_flutter` | The backend already uses Razorpay (orders + signature verification) |
| Push | `firebase_messaging` + `flutter_local_notifications` | Order status updates |
| Crashes / analytics | `firebase_crashlytics`, `firebase_analytics` | |
| Media | `cached_network_image`, `video_player` (onboarding video) | |

**Environments.** dev and prod use `--dart-define-from-file=env/dev.json`.
- dev API: `http://10.0.2.2:5002/api/v1` on the Android emulator, or the PC's LAN IP on a real phone.
- prod: the live API URL.

**Project structure (feature-first)**

```
lib/
  core/        config (env), network (dio + interceptors), storage, theme, router, common widgets
  features/
    auth/        sign in, OTP, profile completion
    onboarding/  splash, slides, app config (force update / maintenance)
    location/    pincode check, current location, serviceability
    catalogue/   categories, items, search, item detail, favourites
    cart/
    address/
    booking/     dates, slots, promo, payment, confirm
    orders/      list, detail, timeline, cancel, invoice
    wallet/  subscriptions/  offers/  profile/  content/  notifications/  reviews/
```

---

## 3. Phases

Each phase ends with a build that can be installed on a phone and demoed. The time estimates assume one Flutter developer, and backend work can run in parallel. The **B-numbers** refer to the backend changes in section 4.

> **Progress (2026-10-18):** Phases 0–**3** are done. Phase 3 was checked end to end on the dev backend:
> - A new customer adds an address from checkout (the form is pre-filled, and the pin code must be one we serve).
> - Dates and per-store slots load, an invalid offer code shows its error, and the instructions note is saved.
> - COD is selected; Wallet is disabled with ₹0, and UPI / Card is disabled on web.
> - The disclaimer has to be ticked before the order is placed, then "Pickup booked!" shows (order 0018, ₹220, pay on delivery), and the cart is emptied.
> - Deleting an address that an order uses shows a clear message.
>
> 21 tests pass and `flutter analyze` is clean. Razorpay can't be tested in dev: the keys in `.env` are rejected ("Authentication failed"), and the app shows that error.
>
> Phase 2 notes: Phase 2 was checked in the browser preview:
> - Home shows the area, search, categories and popular items.
> - A category's sub-category chips and items work.
> - Adding with + / − on item cards works.
> - Item detail lets you pick colour and size, adds to the cart, and saves a favourite.
> - The cart is priced by the store, lines can be changed or removed, and the ₹50 delivery fee shows with the free-delivery hint.
> - The Favourites tab and search ("cur" finds the curtains) work.
>
> `flutter analyze` is clean and 16 tests pass.
>
> Phase 0 and 1 notes: They were checked on the dev backend in a phone-sized browser preview: onboarding → sign in (including the invalid-number and staff-number errors) → OTP (including the wrong-code message) → name → pin code (served and not served) → home → reload restores the session → sign out. `flutter analyze` is clean and 10 tests pass. Still open from Phase 0: the Firebase project (needs the client's account), plus the launcher icon and native splash (need the high-resolution logo).

### Phase 0: Project setup (≈ 3–4 days) ✅
- Run `flutter create` with app id `com.tallygen.customer` (confirmed 2026-10-18), targeting Android and iOS.
- Set up the dev and prod environments, app name, launcher icon and native splash (the logo from the splash design).
- Theme: brand colours, typography close to the designs, buttons, inputs (including the error state), and loaders.
- Core layer: the dio client with token and refresh interceptors, a common error model, secure storage, the go_router shell with an auth guard, and Riverpod setup.
- Set up a Firebase project (Android and iOS apps) for push and Crashlytics.
- **Done when:** the app launches against the dev backend and shows the splash screen.

### Phase 1: Splash, onboarding, login, location (≈ 1.5 weeks) ✅
- **Splash:** calls `GET /onboarding/app-config` and handles force update and maintenance mode, then routes to onboarding (first launch), Sign In, or Home.
- **Onboarding:** slides from `GET /onboarding/slides` (supports video, as in the design), with Skip and Continue.
- **Sign In → OTP → profile completion** as described in section 1, including resend timer, attempt messages and error states.
- **Choose your location:**
  - Pincode: `POST /location/check-pincode`.
  - "Use my current location": GPS, then the phone's own geocoder turns the position into a pincode, which is checked the same way. The backend's `check-coordinates` is still a placeholder (B9).
  - The choice is kept **on the device**. `POST /location/save` isn't used because of its bug (B8).
  - If the area isn't served, show a "We're not in your area yet" message.
- **Done when:** a new user can install the app, sign in with OTP, set a serviceable pincode, and land on Home.

### Phase 2: Catalogue & cart (≈ 1.5 weeks) ✅
- **Home:**
  - Categories (Garment, Bedsheets, Curtains, …) and sub-categories (Man, Woman, Kids).
  - Search: `GET /categories/items/search`.
  - Offers banner: `GET /promocodes`.
- **Item list and detail:** `GET /categories/:id/items`.
  - Prices come from **the store that serves the user's pincode** (the backend applies per-location prices).
  - Each item shows its icon or image, plus colour and size options.
- **Cart:** add, change quantity and remove (`/cart`), with the subtotal shown.
- **Favourites:** `/cart/favorites`.
- **Done when:** a user can browse their store's items at that store's prices and build a cart.

### Phase 3: Address & booking (≈ 2 weeks) ✅
- **Address book:** `/addresses`. Add, edit, delete and set default. Optionally drop a map pin to fill in lat/lng.
- **Schedule pickup:**
  - Dates: `GET /bookings/available-dates`.
  - Slots: `GET /bookings/time-slots?date=…&addressId=…`. **Always send `addressId`** so the slots and "remaining" counts are for the store that serves that address; slot capacity is per store.
- **Review order:** items, subtotal, delivery fee, GST, discount and total. Promo codes are applied with `POST /promocodes/apply`. The disclaimer comes from `GET /content/disclaimer` and must be accepted.
- **Payment:** Cash on delivery, Wallet, or UPI/Card through Razorpay.
  - Confirm with `POST /bookings/confirm`.
  - For Razorpay, open the checkout, then call `POST /bookings/:id/verify-payment`.
- Order placed screen with the order number.
- **Done when:** a user can book a pickup end to end with COD and with Razorpay (test mode).

> **Done (2026-10-19), Schedule Pickup for bulk orders.** A two-screen flow, entered from the **Direct Schedule Pickup → Book Pickup** card on Home. The card only shows while the admin has Schedule Pickup and bulk bookings switched on.
> - **Screen 1 (`/pickup`).**
>   - Header: back, logo and wallet chip. Then the pickup address and store (with Change) and the "For Bulk Orders Only" card.
>   - **Step 1, days:** a horizontal strip from `GET /pickups/dates?addressId=`. Same-day pickup is never offered: tomorrow is the earliest by default. The window, working days, holidays and the store's own window come from the admin. A disabled day says why when tapped.
>   - **Step 2, slots:** from `GET /pickups/slots?date=&addressId=`, as selected / available / full / unavailable cards, with "N left" when few remain. Slots are per store and per weekday, with date-specific capacity.
>   - Then the store's delivery charge card (amounts from the admin's rule) and **Next**.
> - **Screen 2 (`/pickup/review`).**
>   - Store, address, date & slot (each with Change) and order type Bulk Pickup.
>   - Summary: billed after pickup, pickup & delivery charge rule, member discount, payable now ₹0.
>   - The rules (from the admin's instructions and policies), payment method (Cash on delivery / Pay online after billing), instructions for the partner.
>   - **Confirm Pickup** calls `POST /pickups` with an idempotency key, so a retry never makes a second order. A full slot or a closed date sends the customer back to screen 1 with fresh availability.
> - **Pickup Booked! (`/pickup/booked`):** order number, date and weekday, slot, store, amount (after pickup) and payment method, plus Back to Home and Track this order.
> - **Orders:** bulk pickups show "Bulk pickup / To be billed" until the store bills them. Once billed, an online-payment order shows **Pay ₹X now**: `POST /bookings/:id/pay` → Razorpay → `verify-payment`. The same button now lets a customer pay again for an app order whose Razorpay payment failed (B11).
> - Tests: `test/schedule_pickup_test.dart` covers the models and the draft (the selection and idempotency key are kept between screens). It also checks screens 1 and 2 and the confirmation at 320×640, 390×844 and 430×932 with no overflow, the paused state, and bulk order details. `flutter analyze` is clean and the full suite passes.

### Phase 4: Orders, tracking & notifications (≈ 1.5 weeks) — orders done, notifications open

> **Done (2026-10-18), account features.** All four "Soon" items on the Account tab now work, styled after the `Screens/` board in the NClean colours.
> - **My orders.** Ongoing / Completed / Cancelled tabs. Each card shows the order number, date, items, total and a status chip, plus the pickup slot (or the expected delivery once it's picked up).
> - **Order details.**
>   - A status header and a tracker. The tracker shows each step with when it happened, plus any missed pickup / delivery attempt with its reason.
>   - Items, pickup details (slot, expected delivery, address, store, instructions), and the bill and payment.
>   - **Cancel** (pending / confirmed; a wallet or online payment goes back to the wallet), **Reorder** (puts the catalogue items back in the cart), and **Help** (call the store or support, WhatsApp, FAQs).
>   - The order-placed screen has a **Track order** button.
> - **Wallet.**
>   - Balance with total added and total spent, recharge offers, and paged history (with a title, description and the balance after each line).
>   - **Add money:** an amount with quick picks, or a bonus package, paid with Razorpay, then a success sheet.
>   - A wallet balance chip on Home. At checkout, **Add money** appears when the balance is too low to pay with the wallet.
> - **Membership.**
>   - The current plan (status, end date, days left, benefits, cancel) and the plans, with Activated and free-trial badges.
>   - Plans are paid from the wallet. If the balance is short, the app offers to add exactly what's missing.
>   - Member discount and free delivery show in the cart and the checkout bill.
> - **Help & support:** call / WhatsApp / email support (from app-config), searchable FAQs by topic, and About / Terms / Privacy.
> - **Account:** profile card, quick tiles (wallet, orders in progress, membership), grouped menus with live subtitles, sign out.
> - Checked on an Android emulator against the dev backend, with a test customer: every screen; a wallet subscription purchase; member pricing at checkout; cancel; reorder. Wallet top-up stops at Razorpay with the dev keys (B13). `flutter analyze` is clean and 30 tests pass.
- **My Orders:** Active and Past tabs (`GET /bookings`).
- **Order detail:** items, slot, address, payment, and a status timeline.
  - Statuses: Pending → Confirmed → Pickup scheduled → Picked up → In process → Ready → Out for delivery → Delivered.
  - Step timestamps need **B5**; until then the timeline shows only the current step.
- **Cancel order:** `PATCH /bookings/:id/cancel`. The amount paid goes back to the wallet; show that message.
- Reorder: puts the same items back in the cart.
- **Push notifications:** status changes and offers; tapping one opens the order. The device token is registered with `PUT /profile/device-token`. Needs **B2**.
- **Notification inbox.** Needs **B3**.
- Invoice view or download after delivery. Needs **B6**.
- **Done when:** a user can follow an order from booking to delivery and gets a push at each step.

### Phase 5: Wallet, subscriptions & offers (≈ 1 week) — wallet and subscriptions done (see Phase 4 note); offers list open
- **Wallet:** balance and transactions (`/wallet`, `/wallet/transactions`).
- **Add money** with packages (`/wallet/packages`) through Razorpay (`/wallet/create-order` → `/wallet/add-money`).
- **Subscriptions:** plans, subscribe, my subscription, history and cancel (`/subscriptions/*`).
- Offers / promo codes list.
- **Done when:** wallet top-up and subscription purchase work in Razorpay test mode.

### Phase 6: Profile, reviews, help & content (≈ 1 week) — help & content done; profile edit, reviews and delete account open
- **Profile:** edit name and email (`PUT /profile`). A profile photo would need an upload endpoint, which the backend doesn't have yet, so it's left out of v1.
- **Reviews:** rate items after delivery (`POST /reviews`) and list my reviews.
- **Help:**
  - FAQs: `GET /content/faq`.
  - About, Terms and Privacy: `GET /content/about|terms|privacy`.
  - Contact support: call or WhatsApp the store phone.
- **Delete my account:** required by Google Play and the App Store. Needs **B7**.
- **Done when:** every menu item works and the store compliance items are in place.

### Phase 7: QA & release (≈ 1.5 weeks)
- Test on low-end Android, a recent Android and an iPhone. Cover no network, slow network, OTP edge cases, payment failure and cancellation, and an unserviceable pincode.
- Check Crashlytics and analytics events (sign-up, booking placed, payment success or failure).
- Production config: live API URL, live Razorpay key, real SMS provider (**B1**), FCM.
- Store assets: icon, screenshots, description, privacy policy URL, data-safety form.
- Release: Play Store internal testing → production, and TestFlight → App Store.

**Total: about 11–12 weeks** for one developer. Phases 5 and 6 can run alongside 4 if a second developer joins.

---

## 4. Backend changes the user app needs

These are changes in `laundry-backend`. The rest of the API the app needs already exists.

| # | Change | Needed by |
|---|---|---|
| B1 | **Real SMS provider for OTP** (MSG91, Twilio, etc.). Today `sms.service.js` only logs the OTP in development. A DLT-registered template is needed in India. | Phase 7 (dev works without it) |
| B2 | **Firebase push.** `sendPushNotification` is a TODO. Send a push on every order status change and on offers. | Phase 4 |
| B3 | **Notifications API:** `GET /notifications`, mark as read. The model and service exist, but there's no route. | Phase 4 |
| B4 | ✅ **Done (2026-10-18). Customer-only login on `/auth`.** A staff number (driver, branch manager or admin) now gets a 403 *"This number belongs to a staff account and can't be used in the customer app."* on send-otp and verify-otp, and no OTP is sent. New numbers are still registered as customers. | Phase 1 |
| B5 | ✅ **Done (2026-10-18).** `GET /bookings/:id` returns a `timeline`, oldest first, built from `booking_events`: statuses reached and failed attempts with their reason, without internal notes. It also returns the pickup `address` and the store phone. The order's own creation time is its "confirmed" step. | Phase 4 |
| B6 | **Customer invoice** (PDF or HTML link) for delivered orders | Phase 4 |
| B7 | **Delete account** endpoint (anonymise the user, keep orders for accounting) | Phase 6 |
| B8 | ✅ **Fixed (2026-10-18).** `/location/save` no longer writes addresses. It returns `isServiceable`, `location` and the default `addressId`. Original issue: **`POST /location/save` was broken.** <ul><li>For a customer with no default address it creates an address without the required `fullName`, so it fails.</li><li>For a customer who has one, it overwrites the pincode of their real default address.</li></ul>Fix it (or drop it); the app doesn't call it today. | Before Phase 3 |
| B10 | ✅ **Done (2026-10-18).** `GET /cart` and `GET /cart/favorites` accept `?locationId=`, so a new customer with no address yet sees their store's prices in the cart, the same as in the catalogue. Cart and favourite items now include `icon` and `categoryId`, and favourites are priced for the store (with `isAvailable`). | Phase 2 |
| B11 | ✅ **Done (2026-10-19).** `POST /bookings/:id/pay` starts a new Razorpay order for the order's total (card / UPI, unpaid, not cancelled); the app shows **Pay ₹X now** on the order and verifies with `verify-payment`. Original issue: **Retry payment for an unpaid online order.** If Razorpay fails or is cancelled after confirm, the booking stays `pending` / unpaid, and there's no endpoint to create a new Razorpay order for it. Add `POST /bookings/:id/pay` (new Razorpay order for the same total), or let the customer switch to COD. | Before launch |
| B12 | **Soft-delete addresses.** An address used by any order can't be deleted (409 with a clear message, added 2026-10-18). Add `deleted_at` so customers can hide old addresses while orders keep theirs. | Later |
| B14 | ✅ **Done (2026-10-18). Subscriptions are paid, and their benefits apply.**<ul><li>`POST /subscriptions/subscribe` used to activate any plan for free. Now it debits the wallet (400 with the amount to add when the balance is short).</li><li>A plan's trial days are a free trial, given once per plan.</li><li>A cancelled plan stays current, with its benefits, until its end date (`my-subscription` returns it as `cancelled`).</li><li>Members get free delivery and their plan's % off in `GET /cart` (`memberDiscount`, `membership`) and at `/bookings/confirm` (added to any promo discount in the booking's `discount`).</li><li>Wallet history gets a `subscription` entry type (migration 026), and wallet order payments name the order.</li></ul> | Phase 5 |
| B13 | **Razorpay keys for dev / test.** The keys in the dev `.env` are rejected by Razorpay. Add test-mode keys to exercise UPI / Card end to end on a phone. | Before Phase 7 |
| B9 | **`POST /location/check-coordinates` is a placeholder** (it always says "not serviceable"). Wire it to a geocoding API so web and devices without a geocoder can use "current location". | Optional |

---

## 5. Open questions for the client
1. App name on the stores and bundle id (`com.tallygen.customer`, confirmed).
2. Which SMS provider will be used, and is a DLT template already registered?
3. The Razorpay live account and keys, and whether COD is allowed for every order.
4. Designs for the screens after "Choose your location" (Home, cart, booking, orders), or should we follow the current style?
5. Is there a minimum order value or a delivery fee rule to show in the app?
6. Languages: English only at launch, or also Hindi or a regional language?
