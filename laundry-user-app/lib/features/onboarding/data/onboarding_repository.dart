import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

/// GET /onboarding/app-config: force update, maintenance mode and support contacts.
class AppConfig {
  const AppConfig({
    this.minimumAppVersion = '1.0.0',
    this.forceUpdate = false,
    this.maintenanceMode = false,
    this.supportPhone,
    this.supportEmail,
    this.termsUrl,
    this.privacyUrl,
  });

  final String minimumAppVersion;
  final bool forceUpdate;
  final bool maintenanceMode;
  final String? supportPhone;
  final String? supportEmail;
  final String? termsUrl;
  final String? privacyUrl;

  factory AppConfig.fromJson(Map<String, dynamic> json) => AppConfig(
        minimumAppVersion: json['minimumAppVersion'] as String? ?? '1.0.0',
        forceUpdate: json['forceUpdate'] as bool? ?? false,
        maintenanceMode: json['maintenanceMode'] as bool? ?? false,
        supportPhone: json['supportPhone'] as String?,
        supportEmail: json['supportEmail'] as String?,
        termsUrl: json['termsUrl'] as String?,
        privacyUrl: json['privacyUrl'] as String?,
      );
}

class OnboardingSlide {
  const OnboardingSlide({required this.title, required this.description, this.mediaUrl, this.isVideo = false});

  final String title;
  final String description;
  final String? mediaUrl;
  final bool isVideo;

  factory OnboardingSlide.fromJson(Map<String, dynamic> json) => OnboardingSlide(
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        mediaUrl: json['mediaUrl'] as String?,
        isVideo: json['mediaType'] == 'video',
      );

  /// Shown when the slides can't be loaded, so first launch never gets stuck.
  static const fallback = [
    OnboardingSlide(
      title: 'Well-Trained Professionals',
      description: 'A wide range of experienced service providers for your laundry. We check their backgrounds in detail.',
    ),
    OnboardingSlide(
      title: 'Doorstep Pickup & Delivery',
      description: 'Schedule a pickup when it suits you. We collect and return your clothes right at your door.',
    ),
    OnboardingSlide(
      title: 'Premium Ironing',
      description: 'Crisp, carefully pressed clothes, handled with care and delivered on time.',
    ),
  ];
}

class OnboardingRepository {
  OnboardingRepository(this._dio);

  final Dio _dio;

  Future<AppConfig> appConfig() async {
    try {
      final res = await _dio.get<dynamic>('/onboarding/app-config', options: publicRequest);
      return AppConfig.fromJson(unwrap<Map<String, dynamic>>(res));
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<List<OnboardingSlide>> slides() async {
    try {
      final res = await _dio.get<dynamic>('/onboarding/slides', options: publicRequest);
      final list = unwrap<List<dynamic>>(res).cast<Map<String, dynamic>>().map(OnboardingSlide.fromJson).toList();
      return list.isEmpty ? OnboardingSlide.fallback : list;
    } catch (_) {
      return OnboardingSlide.fallback;
    }
  }
}

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) => OnboardingRepository(ref.watch(dioProvider)));

final onboardingSlidesProvider = FutureProvider<List<OnboardingSlide>>((ref) => ref.watch(onboardingRepositoryProvider).slides());

/// Loaded on the splash screen; null until then.
class AppConfigController extends Notifier<AppConfig?> {
  @override
  AppConfig? build() => null;

  Future<AppConfig> load() async => state = await ref.read(onboardingRepositoryProvider).appConfig();
}

final appConfigProvider = NotifierProvider<AppConfigController, AppConfig?>(AppConfigController.new);
