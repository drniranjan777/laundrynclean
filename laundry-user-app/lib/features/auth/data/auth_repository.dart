import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import 'auth_models.dart';

/// Mobile number + OTP login against /auth (customers only; staff numbers get a 403 from the backend).
class AuthRepository {
  AuthRepository(this._dio, this._tokens);

  final Dio _dio;
  final TokenStorage _tokens;

  Future<OtpRequest> sendOtp(String phone, {bool resend = false}) async {
    try {
      final res = await _dio.post<dynamic>(resend ? '/auth/resend-otp' : '/auth/send-otp',
          data: {'phone': phone}, options: publicRequest);
      return OtpRequest.fromJson(unwrap<Map<String, dynamic>>(res));
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  /// Signs in and stores the tokens. Returns the user.
  Future<AppUser> verifyOtp(String phone, String otp) async {
    try {
      final res = await _dio.post<dynamic>('/auth/verify-otp', data: {'phone': phone, 'otp': otp}, options: publicRequest);
      final data = unwrap<Map<String, dynamic>>(res);
      await _tokens.save(access: data['token'] as String, refresh: data['refreshToken'] as String?);
      return AppUser.fromJson(data['user'] as Map<String, dynamic>);
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<AppUser> fetchProfile() async {
    try {
      final res = await _dio.get<dynamic>('/profile');
      return AppUser.fromJson(unwrap<Map<String, dynamic>>(res)['user'] as Map<String, dynamic>);
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> updateProfile({required String name, String? email}) async {
    try {
      await _dio.put<dynamic>('/profile', data: {
        'name': name.trim(),
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      });
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<bool> hasSession() async => await _tokens.accessToken() != null;

  /// Best effort on the server; the local tokens are always cleared.
  Future<void> logout() async {
    try {
      await _dio.post<dynamic>('/auth/logout');
    } catch (_) {
      // Signing out locally is what matters
    } finally {
      await _tokens.clear();
    }
  }

  Future<void> clearLocalSession() => _tokens.clear();
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioProvider), ref.watch(tokenStorageProvider)),
);
