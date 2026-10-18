import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../core/router/app_router.dart';
import '../../../core/storage/prefs.dart';
import '../../../core/theme/app_theme.dart';
import '../data/onboarding_repository.dart';

/// First-launch slides from GET /onboarding/slides (image or video), as in "Onboarding 1" of the designs.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pages = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await ref.read(sharedPrefsProvider).setBool(PrefKeys.onboardingSeen, true);
    if (mounted) context.go(Routes.signIn);
  }

  @override
  Widget build(BuildContext context) {
    final slides = ref.watch(onboardingSlidesProvider).value ?? const <OnboardingSlide>[];
    if (slides.isEmpty) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.secondary)));
    }
    final last = _index == slides.length - 1;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: Stack(
        children: [
          PageView.builder(
            controller: _pages,
            itemCount: slides.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => _SlideMedia(slide: slides[i], index: i, active: i == _index),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(slides[_index].title,
                        textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 12),
                    Text(slides[_index].description,
                        textAlign: TextAlign.center, style: text.bodyLarge?.copyWith(color: AppColors.textMuted, height: 1.4)),
                    const SizedBox(height: 16),
                    _Dots(count: slides.length, index: _index),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: last ? null : _finish,
                      style: TextButton.styleFrom(foregroundColor: AppColors.text),
                      child: Text(last ? '' : 'Skip'),
                    ),
                    const SizedBox(height: 4),
                    FilledButton(
                      onPressed: last
                          ? _finish
                          : () => _pages.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeOut),
                      child: Text(last ? 'Get Started' : 'Continue'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: i == index ? 20 : 8,
            height: 8,
            decoration: BoxDecoration(
              color: i == index ? AppColors.primary : AppColors.border,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
      ],
    );
  }
}

/// Full-screen image or video behind the text card; a branded panel if the media can't load.
class _SlideMedia extends StatefulWidget {
  const _SlideMedia({required this.slide, required this.index, required this.active});

  final OnboardingSlide slide;
  final int index;
  final bool active;

  @override
  State<_SlideMedia> createState() => _SlideMediaState();
}

class _SlideMediaState extends State<_SlideMedia> {
  VideoPlayerController? _video;
  bool _videoFailed = false;

  @override
  void initState() {
    super.initState();
    final url = widget.slide.mediaUrl;
    if (widget.slide.isVideo && url != null) {
      _video = VideoPlayerController.networkUrl(Uri.parse(url))
        ..setLooping(true)
        ..setVolume(0)
        // A slow or missing video shows the branded panel instead of spinning forever
        ..initialize().timeout(const Duration(seconds: 8)).then((_) {
          if (mounted) setState(() {});
          if (widget.active) _video?.play();
        }).catchError((Object _) {
          if (mounted) setState(() => _videoFailed = true);
        });
    }
  }

  @override
  void didUpdateWidget(covariant _SlideMedia old) {
    super.didUpdateWidget(old);
    final video = _video;
    if (video == null || !video.value.isInitialized) return;
    widget.active ? video.play() : video.pause();
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final video = _video;
    final url = widget.slide.mediaUrl;

    if (video != null && !_videoFailed) {
      if (!video.value.isInitialized) return _Fallback(index: widget.index, loading: true);
      return GestureDetector(
        onTap: () => setState(() => video.value.isPlaying ? video.pause() : video.play()),
        child: Stack(
          fit: StackFit.expand,
          children: [
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(width: video.value.size.width, height: video.value.size.height, child: VideoPlayer(video)),
            ),
            if (!video.value.isPlaying) const _PlayButton(),
          ],
        ),
      );
    }
    if (!widget.slide.isVideo && url != null) {
      return CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        placeholder: (_, _) => _Fallback(index: widget.index, loading: true),
        errorWidget: (_, _, _) => _Fallback(index: widget.index),
      );
    }
    return _Fallback(index: widget.index);
  }
}

class _PlayButton extends StatelessWidget {
  const _PlayButton();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: const Alignment(0, -0.35),
      child: Container(
        width: 150,
        height: 150,
        decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primary.withValues(alpha: 0.35)),
        alignment: Alignment.center,
        child: Container(
          width: 104,
          height: 104,
          decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.primary),
          child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 64),
        ),
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.index, this.loading = false});

  final int index;
  final bool loading;

  static const _icons = [Icons.verified_user_outlined, Icons.local_shipping_outlined, Icons.iron_outlined];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppColors.brandGradient),
      alignment: const Alignment(0, -0.35),
      child: loading
          ? const CircularProgressIndicator(color: Colors.white)
          : Icon(_icons[index % _icons.length], size: 120, color: Colors.white.withValues(alpha: 0.9)),
    );
  }
}
