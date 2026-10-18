import '../config/env.dart';

/// ₹120 for whole amounts, ₹99.50 otherwise.
String rupees(num value) => value == value.roundToDouble() ? '₹${value.toInt()}' : '₹${value.toStringAsFixed(2)}';

/// Backend numbers arrive as strings ("120.00") or numbers.
double toDouble(Object? value) => value is num ? value.toDouble() : double.tryParse('${value ?? ''}') ?? 0;

/// Images stored as /uploads/... live next to the API: the API URL without its /api/v1 ending, so a path prefix
/// such as https://tallygen.com/nclean is kept. Absolute URLs are used as they are.
String? mediaUrl(String? path, {String apiBaseUrl = Env.apiBaseUrl}) {
  if (path == null || path.isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = apiBaseUrl.replaceFirst(RegExp(r'/api(/v\d+)?/?$'), '');
  return '$base${path.startsWith('/') ? '' : '/'}$path';
}
