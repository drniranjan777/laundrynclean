import 'package:url_launcher/url_launcher.dart';

/// Opens the phone dialer, email app, WhatsApp or a web page. Returns false when nothing can handle it.
class Contact {
  Contact._();

  static Future<bool> call(String phone) => _open(Uri(scheme: 'tel', path: phone.replaceAll(RegExp(r'[^0-9+]'), '')));

  static Future<bool> email(String address, {String? subject}) =>
      _open(Uri(scheme: 'mailto', path: address, query: subject == null ? null : 'subject=${Uri.encodeComponent(subject)}'));

  /// WhatsApp chat with an Indian number (adds 91 when the country code is missing).
  static Future<bool> whatsApp(String phone, {String? message}) {
    var digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length == 10) digits = '91$digits';
    return _open(Uri.https('wa.me', '/$digits', message == null ? null : {'text': message}));
  }

  static Future<bool> web(String url) => _open(Uri.parse(url));

  static Future<bool> _open(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }
}
