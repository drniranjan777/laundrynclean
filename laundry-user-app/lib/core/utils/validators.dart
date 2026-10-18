/// Same rules the backend applies (`/^(\+91)?[6-9]\d{9}$/`), so the app never sends a number it will reject.
class Validators {
  Validators._();

  static const invalidMobile = 'Please enter a valid mobile number';

  /// 10 digits starting with 6–9. A pasted +91 / 0 prefix is ignored.
  static String normaliseMobile(String input) {
    var digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 12 && digits.startsWith('91')) digits = digits.substring(2);
    if (digits.length == 11 && digits.startsWith('0')) digits = digits.substring(1);
    return digits;
  }

  static String? mobile(String input) =>
      RegExp(r'^[6-9]\d{9}$').hasMatch(normaliseMobile(input)) ? null : invalidMobile;

  static String? pincode(String input) =>
      RegExp(r'^[1-9]\d{5}$').hasMatch(input.trim()) ? null : 'Please enter a valid 6-digit pin code';

  static String? optionalEmail(String input) {
    final value = input.trim();
    if (value.isEmpty) return null;
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value) ? null : 'Please enter a valid email';
  }

  /// True when [current] (e.g. 1.0.0) is older than [minimum].
  static bool isOlderVersion(String current, String minimum) {
    List<int> parts(String v) => v.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final a = parts(current), b = parts(minimum);
    for (var i = 0; i < 3; i++) {
      final x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0;
      if (x != y) return x < y;
    }
    return false;
  }
}
