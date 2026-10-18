/// Build-time settings. Pass them with `--dart-define-from-file=env/dev.json` (see README).
class Env {
  Env._();

  /// Base URL of the NClean API, ending in /api/v1.
  /// The default suits the Android emulator talking to the backend on the dev PC (port 5002).
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:5002/api/v1');

  /// Compared with the backend's minimumAppVersion to force an update.
  static const appVersion = '1.0.0';
}
