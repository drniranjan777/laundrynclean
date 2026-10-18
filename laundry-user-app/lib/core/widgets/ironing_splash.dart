import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Splash animation: an iron glides over a wrinkled cloth (drawn in the logo's wave colours) and leaves it
/// smooth, with a little steam; then the NClean logo appears with a "freshly pressed" shine.
/// [onFinished] fires when the animation is done (≈ 2.3 s); it plays once and then stays still.
class IroningSplash extends StatefulWidget {
  const IroningSplash({super.key, this.onFinished, this.badge, this.below, this.logoAsset = 'assets/images/logo_full.png'});

  final VoidCallback? onFinished;

  /// Shown right under the logo and animated with it (e.g. the driver app's "PARTNER" badge).
  final Widget? badge;

  /// Shown under the animation (e.g. a "Try again" button).
  final Widget? below;
  final String logoAsset;

  @override
  State<IroningSplash> createState() => _IroningSplashState();
}

class _IroningSplashState extends State<IroningSplash> with TickerProviderStateMixin {
  late final AnimationController _main = AnimationController(vsync: this, duration: const Duration(milliseconds: 2300));
  late final AnimationController _steam = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  // The iron crosses the cloth in the first 65%, the logo fades in from 45% and shines at the end
  late final Animation<double> _iron = CurvedAnimation(parent: _main, curve: const Interval(0, 0.65, curve: Curves.easeInOutCubic));
  late final Animation<double> _logo = CurvedAnimation(parent: _main, curve: const Interval(0.45, 0.8, curve: Curves.easeOutBack));
  late final Animation<double> _shine = CurvedAnimation(parent: _main, curve: const Interval(0.78, 1, curve: Curves.easeInOut));

  bool _scheduled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_scheduled) return;
    _scheduled = true;
    // Start once the logo is decoded, so it doesn't miss its entrance (instant on a phone; on the web it's
    // downloaded first), but never wait more than 800 ms
    Future.any([
      precacheImage(AssetImage(widget.logoAsset), context),
      Future<void>.delayed(const Duration(milliseconds: 800)),
    ]).whenComplete(_play);
  }

  void _play() {
    if (!mounted || _main.isAnimating || _main.isCompleted) return;
    _main.forward().whenComplete(() {
      _steam.stop(); // the iron (and its steam) has faded out by now
      widget.onFinished?.call();
    });
  }

  @override
  void dispose() {
    _main.dispose();
    _steam.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final width = math.min(MediaQuery.of(context).size.width * 0.8, 340.0);
    return AnimatedBuilder(
      animation: Listenable.merge([_main, _steam]),
      builder: (context, _) {
        final logoT = _logo.value.clamp(0.0, 1.0);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Logo with a sweeping highlight once it's in place
            Opacity(
              opacity: logoT,
              child: Transform.scale(
                scale: 0.88 + 0.12 * _logo.value,
                child: ShaderMask(
                  blendMode: BlendMode.srcATop,
                  shaderCallback: (rect) {
                    final x = -0.6 + 2.2 * _shine.value; // band travels left → right
                    return LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: 0.55), Colors.white.withValues(alpha: 0)],
                      stops: [(x - 0.15).clamp(0, 1), x.clamp(0, 1), (x + 0.15).clamp(0, 1)],
                    ).createShader(rect);
                  },
                  child: Image.asset(widget.logoAsset, width: width, semanticLabel: 'NClean'),
                ),
              ),
            ),
            if (widget.badge != null) ...[
              const SizedBox(height: 10),
              Opacity(opacity: logoT, child: widget.badge),
            ],
            const SizedBox(height: 28),
            SizedBox(
              width: width,
              height: 96,
              child: CustomPaint(
                painter: _IroningPainter(progress: _iron.value, steam: _steam.value, fadeOut: _shine.value),
              ),
            ),
            if (widget.below != null) ...[const SizedBox(height: 12), widget.below!],
          ],
        );
      },
    );
  }
}

/// The cloth line (wrinkled ahead of the iron, smooth behind it), the iron and its steam.
class _IroningPainter extends CustomPainter {
  _IroningPainter({required this.progress, required this.steam, required this.fadeOut});

  final double progress; // 0 → 1: iron position along the cloth
  final double steam; // 0 → 1, repeating
  final double fadeOut; // the iron eases away at the very end

  static const _ironIcon = Icons.iron;

  @override
  void paint(Canvas canvas, Size size) {
    final clothY = size.height - 18;
    final left = 6.0, right = size.width - 6;
    final ironOpacity = (1 - fadeOut).clamp(0.0, 1.0);
    final iron = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(_ironIcon.codePoint),
        style: TextStyle(
          fontSize: 58,
          fontFamily: _ironIcon.fontFamily,
          package: _ironIcon.fontPackage,
          color: AppColors.secondary.withValues(alpha: ironOpacity),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    // The iron stays on the cloth from start to end; everything behind its nose is pressed
    final half = iron.width * 0.42; // the glyph has a little padding around it
    final ironX = left + half + (right - left - 2 * half) * progress;
    final nose = ironX + half;

    // Smooth, pressed part: the logo's sky → blue wave colours
    final smooth = Paint()
      ..shader = const LinearGradient(colors: [AppColors.sky, AppColors.blue]).createShader(Rect.fromLTRB(left, clothY - 4, right, clothY + 4))
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(left, clothY), Offset(math.min(nose, right), clothY), smooth);

    // Wrinkled part, ahead of the iron
    if (nose < right) {
      final wrinkled = Path()..moveTo(nose, clothY);
      for (double x = nose; x <= right; x += 2) {
        // Wrinkles calm down right next to the iron (it's already warming the cloth)
        final nearIron = ((x - nose) / 40).clamp(0.0, 1.0);
        final y = clothY + math.sin(x / 7) * 5 * nearIron + math.sin(x / 2.7) * 1.6 * nearIron;
        wrinkled.lineTo(x, y);
      }
      canvas.drawPath(
        wrinkled,
        Paint()
          ..color = const Color(0xFFB8CDE3)
          ..strokeWidth = 5
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke,
      );
    }

    if (ironOpacity <= 0) return;

    // Steam puffs rising from the iron
    for (var i = 0; i < 3; i++) {
      final t = (steam + i / 3) % 1;
      final puff = Paint()..color = AppColors.sky.withValues(alpha: (1 - t) * 0.35 * ironOpacity);
      canvas.drawCircle(Offset(ironX - 6 + i * 9 + math.sin((t + i) * math.pi * 2) * 4, clothY - 50 - t * 34), 4 + t * 7, puff);
    }

    // The iron, resting on the cloth with a slight rocking motion while it moves
    final tilt = math.sin(progress * math.pi * 6) * 0.04 * (progress < 1 ? 1 : 0);
    canvas.save();
    canvas.translate(ironX, clothY - 2);
    canvas.rotate(tilt);
    canvas.scale(-1, 1); // the icon faces left; turn it to face the way it moves
    // Icon glyph: sole at ~84% of its height
    iron.paint(canvas, Offset(-iron.width * 0.5, -iron.height * 0.84));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _IroningPainter old) => old.progress != progress || old.steam != steam || old.fadeOut != fadeOut;
}
