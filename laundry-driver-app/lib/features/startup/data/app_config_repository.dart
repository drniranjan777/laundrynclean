import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

/// GET /onboarding/app-config (shared with the customer app): maintenance, force update, support phone.
class AppConfig {
  const AppConfig({this.minimumAppVersion = '1.0.0', this.forceUpdate = false, this.maintenanceMode = false, this.supportPhone});

  final String minimumAppVersion;
  final bool forceUpdate;
  final bool maintenanceMode;
  final String? supportPhone;

  factory AppConfig.fromJson(Map<String, dynamic> json) => AppConfig(
        minimumAppVersion: json['minimumAppVersion'] as String? ?? '1.0.0',
        forceUpdate: json['forceUpdate'] as bool? ?? false,
        maintenanceMode: json['maintenanceMode'] as bool? ?? false,
        supportPhone: json['supportPhone'] as String?,
      );
}

class AppConfigController extends Notifier<AppConfig?> {
  @override
  AppConfig? build() => null;

  Future<AppConfig> load() async {
    try {
      final res = await ref.read(dioProvider).get<dynamic>('/onboarding/app-config', options: publicRequest);
      return state = AppConfig.fromJson(unwrap<Map<String, dynamic>>(res));
    } catch (e) {
      throw ApiException.from(e);
    }
  }
}

final appConfigProvider = NotifierProvider<AppConfigController, AppConfig?>(AppConfigController.new);
