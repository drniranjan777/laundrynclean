# NClean User App (Flutter)

The customer app. See [PLAN.md](PLAN.md) for the phases. **Phases 0–3 are done:** setup; login and location; catalogue, cart and favourites; and addresses, scheduling a pickup, offers, payment and placing the order.

- App id `com.tallygen.customer`, display name **NClean** (Android + iOS; web is used only for quick previews).
- Flutter 3.47 / Dart 3.13. State: Riverpod 3. Navigation: go_router. HTTP: dio.

## Run it

1. Start the backend (`laundry-backend` on port 5002). In development the backend **prints every OTP in its console** (`[DEV] OTP for 98xxxxxxxx: 1234`); no SMS is sent.
2. Pick the API address:
   - Android emulator: `env/dev.json` already points to `http://10.0.2.2:5002/api/v1`.
   - Real phone on the same Wi-Fi: change `env/dev.json` to `http://<your PC's LAN IP>:5002/api/v1`.
3. Run:
   ```
   flutter run --dart-define-from-file=env/dev.json
   ```

Debug builds allow plain `http` to the dev backend: on Android it's enabled only in the debug manifest, and on iOS through `NSAllowsLocalNetworking`. Production uses `env/prod.json` (https).

**Browser preview (optional):** run `flutter build web --dart-define-from-file=env/web-dev.json`, then serve `build/web` with `/api` forwarded to `http://localhost:5002`. The dev backend's CORS only allows `localhost:3000`, so call it through that proxy rather than directly.

## Test APK for a phone
The live server (`tallygen.com/nclean`) isn't running the backend yet, so test builds talk to the dev backend on the PC over Wi-Fi:
```
flutter build apk --release --dart-define=API_BASE_URL=http://<PC's Wi-Fi IP>:5002/api/v1
```
- The phone must be on the same Wi-Fi as the PC, and the backend must be running.
- Release builds are signed with the debug key for now; add a real signing key before a store upload.
- `android/app/proguard-rules.pro` keeps the classes that plugins call over JNI. Without it, the release app stops on the launch screen.

## Check it
```
flutter analyze
flutter test
```

## Structure
```
lib/
  core/       env, dio client (token + refresh-on-401), secure token storage, theme, router (bottom-nav shell), widgets, validators, formatting
  features/
    onboarding/  splash (app-config: maintenance / force update), slides from the API, blocked screen
    auth/        sign in → OTP → name (new users); session restore and sign out
    location/    pin code or GPS → serviceability → store that serves the area
    home/        home tab: area, search, offers, categories, popular items
    catalogue/   categories, items, item detail, search, item icons (same keys as the admin icon library)
    cart/        server cart (priced for the chosen store), favourites, cart bar
    address/     saved addresses (list / picker) and the address form (pin code must be served)
    checkout/    schedule pickup: address, date & per-store slot, offer code, instructions, payment (COD / wallet / Razorpay), disclaimer, order placed
    account/     account tab: profile, quick tiles (wallet, orders in progress, membership), menus
    orders/      my orders (tabs), order details with tracker, cancel, reorder, help
    wallet/      balance and history, add money (custom or bonus package, Razorpay), balance chip
    subscriptions/ membership plans, paid from the wallet (free trial once per plan), cancel
    help/        support contacts, FAQs, About / Terms / Privacy pages
```

## Notes
- Colours come from the NClean logo (see `AppColors`): teal `#00857A` buttons, navy `#062C5A` text and accents, and the wave colours blue `#007BCA` and sky `#02BEFC`. Screen layouts follow `/Screens`. The font is Montserrat via `google_fonts`, pinned to 8.2.1 because 9.x needs the new `material_ui` package. Bundle the font files before release so the first launch works offline.
- Logo files are in `assets/images/`: `logo_full.png` (with the tagline, used on the splash), `logo_wordmark.png` (app bar) and `logo_mark.png` (the "N").
- The splash plays an ironing animation (`core/widgets/ironing_splash.dart`, about 2.3 s), then opens the app once loading has finished too.
- App icons: the source images are in `assets/icon/`. After changing them, run `dart run flutter_launcher_icons` (Android and iOS). The web icons in `web/` are drawn separately.
- The chosen pin code is stored on the device. The backend's `POST /location/save` isn't used because it has a bug (see PLAN.md, B8).
- Firebase (push, Crashlytics) needs the client's Firebase project. It's planned for Phase 4.
- UPI / Card uses `razorpay_flutter` and only works on Android and iOS; on web it's disabled. Release builds need Razorpay's ProGuard rules (see the razorpay_flutter README), and the dev Razorpay keys are currently rejected (PLAN.md B13).
