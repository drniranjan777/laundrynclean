import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/storage/prefs.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/ironing_splash.dart';
import '../../auth/application/session_controller.dart';
import '../../location/data/location_repository.dart';
import '../data/onboarding_repository.dart';

/// Ironing animation and logo while the app checks the backend (maintenance, force update) and restores the session.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  String? _error;
  bool _showSpinner = false;
  final _animationFinished = Completer<void>();

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    setState(() => _error = null);
    try {
      final config = await ref.read(appConfigProvider.notifier).load();
      if (config.maintenanceMode) return await _go('${Routes.blocked}?reason=maintenance');
      if (config.forceUpdate || Validators.isOlderVersion(Env.appVersion, config.minimumAppVersion)) {
        return await _go('${Routes.blocked}?reason=update');
      }
      await ref.read(sessionProvider.notifier).restore();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
      return;
    }

    _go(launchRoute(
      onboardingSeen: ref.read(sharedPrefsProvider).getBool(PrefKeys.onboardingSeen) ?? false,
      session: ref.read(sessionProvider),
      area: ref.read(serviceAreaProvider),
    ));
  }

  /// Leaves the splash once the animation has played to the end.
  Future<void> _go(String route) async {
    await _animationFinished.future;
    if (mounted) context.go(route);
  }

  void _onAnimationFinished() {
    _animationFinished.complete();
    // Still here a moment later? Then loading is slow: show that something is happening
    Future<void>.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _showSpinner = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: IroningSplash(
              onFinished: _onAnimationFinished,
              below: _error != null
                  ? Column(mainAxisSize: MainAxisSize.min, children: [
                      Text(_error!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
                      const SizedBox(height: 16),
                      SizedBox(width: 180, child: FilledButton(onPressed: _start, child: const Text('Try again'))),
                    ])
                  : _showSpinner
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: AppColors.primary))
                      : null,
            ),
          ),
        ),
      ),
    );
  }
}
