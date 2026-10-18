# NClean Partner App (Flutter)

The delivery partner (delivery boy) app. See [PLAN.md](PLAN.md) for the phases. **Phases 0–3 are done:** setup; OTP login; task tabs, order detail, call / navigate and profile; and the pickup and delivery actions (picked up with piece count, handed to store, start delivery, delivered with cash collection, couldn't pick up or deliver with a reason, optional proof photo).

- App id `com.tallygen.partner`, display name **NClean Partner**.
- Flutter 3.47 / Dart 3.13. State: Riverpod 3. Navigation: go_router. HTTP: dio.
- The `core/` folder is a copy of the user app's core (network, theme, token storage, validators). Keep the two copies in step, or move them into a shared package if they drift.

## Run it

1. Start the backend (`laundry-backend` on port 5002).
2. Add a delivery boy in the admin panel (**Delivery Boys → Add**); only a name and mobile number are needed. Only numbers registered there can sign in.
3. Sign in with that number. In development the backend prints the OTP in its console.
4. Run:
   ```
   flutter run --dart-define-from-file=env/dev.json
   ```
   `env/dev.json` points to the Android emulator's `http://10.0.2.2:5002/api/v1`. For a real phone, use your PC's LAN IP instead.

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
  core/       env, dio client (token + refresh-on-401), secure token storage, theme, router, widgets, validators
  features/
    startup/   splash (app-config), maintenance / force-update screen, partner logo
    auth/      sign in → OTP on /drivers/send-otp and /drivers/verify-otp; session restore; deactivated → signed out
    home/      today's stats and task tabs: Pickups, To store, Deliveries, Completed
    orders/    /drivers/my-orders model, order card and detail, call and Google Maps navigation, action panel and sheets (status, cash, failed attempts, photos via image_picker)
    profile/   driver and their store (GET /profile), support, sign out
```

## Login rules (backend)
- Only active delivery boys created by a store can sign in; any other number gets *"This number isn't registered as a delivery partner…"*.
- OTP rules: 4 digits, 5-minute expiry, 30 s resend cooldown, and a 30-minute lock after 5 wrong tries.
- If the store deactivates a driver, the next launch or refresh signs them out.
- Brand: NClean colours and logo (`assets/images/`), with a "PARTNER" badge. The splash plays the same ironing animation as the user app (`core/widgets/ironing_splash.dart`). App icons: the sources are in `assets/icon/`; after changing them, run `dart run flutter_launcher_icons`. The web icons in `web/` are drawn separately.
