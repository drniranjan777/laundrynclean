import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Loaded once in main() and injected with an override, so providers can read it synchronously.
final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPrefsProvider is overridden in main()'),
);

class PrefKeys {
  PrefKeys._();
  static const onboardingSeen = 'onboarding_seen';
  static const serviceArea = 'service_area';
}
