import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Access and refresh tokens, kept in the device's secure storage (Keychain / Keystore).
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';

  final FlutterSecureStorage _storage;
  String? _access; // read on every request, so kept in memory once loaded
  bool _loaded = false;

  Future<String?> accessToken() async {
    if (!_loaded) {
      _access = await _storage.read(key: _accessKey);
      _loaded = true;
    }
    return _access;
  }

  Future<String?> refreshToken() => _storage.read(key: _refreshKey);

  Future<void> save({required String access, String? refresh}) async {
    _access = access;
    _loaded = true;
    await _storage.write(key: _accessKey, value: access);
    if (refresh != null) await _storage.write(key: _refreshKey, value: refresh);
  }

  Future<void> clear() async {
    _access = null;
    _loaded = true;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());
