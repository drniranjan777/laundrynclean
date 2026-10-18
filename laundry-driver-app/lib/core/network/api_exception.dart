import 'package:dio/dio.dart';

/// An API failure with a message that can be shown to the user as is.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isNetworkError => statusCode == null;

  /// The backend answers errors as `{ success: false, message }`; anything else gets a friendly default.
  factory ApiException.from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final data = error.response?.data;
      final status = error.response?.statusCode;
      if (data is Map && data['message'] is String && (data['message'] as String).isNotEmpty) {
        return ApiException(data['message'] as String, statusCode: status);
      }
      switch (error.type) {
        case DioExceptionType.connectionError:
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.sendTimeout:
          return ApiException("Can't reach NClean. Check your internet connection and try again.");
        default:
          return ApiException('Something went wrong. Please try again.', statusCode: status);
      }
    }
    return ApiException('Something went wrong. Please try again.');
  }

  @override
  String toString() => message;
}
