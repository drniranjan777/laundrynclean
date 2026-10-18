import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/env.dart';
import '../storage/token_storage.dart';

/// Marks a request that needs no token and must never trigger a token refresh (login, OTP, public data).
final publicRequest = Options(extra: {'public': true});

/// Fires when the refresh token is rejected; the session controller signs the user out.
final sessionExpiredProvider = Provider<StreamController<void>>((ref) {
  final controller = StreamController<void>.broadcast();
  ref.onDispose(controller.close);
  return controller;
});

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: Env.apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 20),
    contentType: Headers.jsonContentType,
  ));
  dio.interceptors.add(AuthInterceptor(
    dio: dio,
    tokens: ref.watch(tokenStorageProvider),
    onSessionExpired: () => ref.read(sessionExpiredProvider).add(null),
  ));
  return dio;
});

/// The `data` part of the backend's `{ success, message, data }` envelope.
T unwrap<T>(Response<dynamic> response) => (response.data as Map<String, dynamic>)['data'] as T;

/// Adds the access token, and on a 401 refreshes it once (POST /auth/refresh-token) and retries.
/// Queued, so parallel requests that all get 401 share a single refresh.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({required this.dio, required this.tokens, required this.onSessionExpired});

  final Dio dio;
  final TokenStorage tokens;
  final void Function() onSessionExpired;

  bool _isPublic(RequestOptions options) => options.extra['public'] == true;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (!_isPublic(options)) {
      final token = await tokens.accessToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    if (err.response?.statusCode != 401 || _isPublic(options) || options.extra['retried'] == true) {
      return handler.next(err);
    }

    final refreshToken = await tokens.refreshToken();
    if (refreshToken == null) {
      await _expire();
      return handler.next(err);
    }

    try {
      // A bare Dio, so this call doesn't come back through this interceptor
      final refreshed = await Dio(BaseOptions(baseUrl: dio.options.baseUrl, contentType: Headers.jsonContentType))
          .post<Map<String, dynamic>>('/auth/refresh-token', data: {'refreshToken': refreshToken});
      final newToken = (refreshed.data?['data'] as Map<String, dynamic>?)?['token'] as String?;
      if (newToken == null) throw StateError('no token in refresh response');
      await tokens.save(access: newToken);

      options.headers['Authorization'] = 'Bearer $newToken';
      options.extra['retried'] = true;
      // Retried on a Dio without interceptors: a second 401 must not wait in this queue behind itself
      handler.resolve(await Dio(dio.options).fetch<dynamic>(options));
    } on DioException catch (refreshError) {
      if (refreshError.response?.statusCode == 401) await _expire();
      handler.next(err);
    } catch (_) {
      await _expire();
      handler.next(err);
    }
  }

  Future<void> _expire() async {
    await tokens.clear();
    onSessionExpired();
  }
}
