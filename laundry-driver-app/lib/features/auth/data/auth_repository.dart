import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import 'auth_models.dart';

/// Driver login with mobile OTP on /drivers/*: only delivery boys a store has created can sign in.
/// Token refresh and logout use the shared /auth endpoints.
class AuthRepository {
  AuthRepository(this._dio, this._tokens);

  final Dio _dio;
  final TokenStorage _tokens;

  Future<OtpRequest> sendOtp(String phone, {bool resend = false}) async {
    try {
      final res = await _dio.post<dynamic>(resend ? '/drivers/resend-otp' : '/drivers/send-otp',
          data: {'phone': phone}, options: publicRequest);
      return OtpRequest.fromJson(unwrap<Map<String, dynamic>>(res));
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<AppUser> verifyOtp(String phone, String otp) async {
    try {
      final res = await _dio.post<dynamic>('/drivers/verify-otp', data: {'phone': phone, 'otp': otp}, options: publicRequest);
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

  Future<bool> hasSession() async => await _tokens.accessToken() != null;

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
