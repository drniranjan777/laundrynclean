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
import '../../../core/widgets/brand_widgets.dart';
import '../../auth/application/session_controller.dart';
import '../../location/data/location_repository.dart';
import '../data/onboarding_repository.dart';

/// Splash from the design: logo, fresh-laundry picture and a progress bar ("Getting Things Fresh...") while the
/// app checks the backend (maintenance, force update) and restores the session.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key, this.duration = const Duration(milliseconds: 1800)});

  /// How long the progress bar takes to fill; the splash stays at least this long.
  final Duration duration;

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  static const _logo = AssetImage('assets/images/logo_wordmark.png');
  static const _art = AssetImage('assets/images/art_splash.webp');

  String? _error;
  late final AnimationController _progress = AnimationController(vsync: this, duration: widget.duration);

  /// Completes once the logo and picture have been on screen for [SplashScreen.duration]
  final _filled = Completer<void>();
  bool _ready = false;
  bool _slow = false;

  @override
  void initState() {
    super.initState();
    _start();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reveal());
  }

  /// Shows the splash only once its pictures are decoded, then keeps it up for the full duration (wall clock, so
  /// slow first frames don't cut it short).
  Future<void> _reveal() async {
    try {
      await Future.wait([precacheImage(_logo, context), precacheImage(_art, context)]);
    } catch (_) {
      // A missing picture must not block the app
    }
    if (!mounted) return;
    setState(() => _ready = true);
    _progress.forward();
    await Future<void>.delayed(widget.duration);
    if (!_filled.isCompleted) _filled.complete();
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
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

    _go(
      launchRoute(
        onboardingSeen: ref.read(sharedPrefsProvider).getBool(PrefKeys.onboardingSeen) ?? false,
        session: ref.read(sessionProvider),
        area: ref.read(serviceAreaProvider),
      ),
    );
  }

  /// Leaves the splash once the progress bar has filled.
  Future<void> _go(String route) async {
    // Still loading when the bar is full: say so (the bar keeps moving)
    unawaited(
      _filled.future.then((_) => Future<void>.delayed(const Duration(milliseconds: 400))).then((_) {
        if (mounted) setState(() => _slow = true);
      }),
    );
    await _filled.future;
    if (mounted) context.go(route);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final size = MediaQuery.sizeOf(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF9FCFE), Colors.white, Color(0xFFE3F5F8)],
            stops: [0, 0.45, 1],
          ),
        ),
        child: Stack(
          children: [
            const Positioned(left: 0, right: 0, bottom: 0, child: WaveFooter(height: 140)),
            SafeArea(
              child: Column(
                children: [
                  SizedBox(height: size.height * 0.08),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: size.width * 0.16),
                    child: AnimatedOpacity(
                      opacity: _ready ? 1 : 0,
                      duration: const Duration(milliseconds: 300),
                      child: const Image(image: _logo, semanticLabel: 'NClean'),
                    ),
                  ),
                  Expanded(
                    child: AnimatedOpacity(
                      opacity: _ready ? 1 : 0,
                      duration: const Duration(milliseconds: 500),
                      child: ShaderMask(
                        shaderCallback: (r) => const LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.white, Colors.white, Colors.transparent],
                          stops: [0, 0.12, 0.8, 1],
                        ).createShader(r),
                        blendMode: BlendMode.dstIn,
                        child: const Image(image: _art, fit: BoxFit.cover, width: double.infinity, excludeFromSemantics: true),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(32, 8, 32, 40),
                    child: _error != null
                        ? Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!, textAlign: TextAlign.center, style: text.bodyLarge),
                              const SizedBox(height: 16),
                              SizedBox(
                                width: 180,
                                child: FilledButton(onPressed: _start, child: const Text('Try again')),
                              ),
                            ],
                          )
                        : Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: 200,
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: _slow
                                      ? const LinearProgressIndicator(minHeight: 7, color: AppColors.primary, backgroundColor: Color(0xFFD6DEE4))
                                      : AnimatedBuilder(
                                          animation: _progress,
                                          builder: (_, _) => LinearProgressIndicator(
                                            value: Curves.easeInOut.transform(_progress.value),
                                            minHeight: 7,
                                            color: AppColors.primary,
                                            backgroundColor: const Color(0xFFD6DEE4),
                                          ),
                                        ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text('Getting Things Fresh...', style: text.bodyLarge?.copyWith(color: AppColors.textMuted)),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
