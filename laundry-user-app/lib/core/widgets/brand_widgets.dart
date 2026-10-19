import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/session_controller.dart';
import '../router/app_router.dart';
import '../theme/app_theme.dart';

/// Pieces shared by the designed screens: the customer's avatar and the soft waves at the bottom of the page.

/// Round avatar with the customer's initials; opens the Account tab.
class BrandAvatar extends ConsumerWidget {
  const BrandAvatar({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = (ref.watch(sessionProvider).user?.name ?? '').trim();
    final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials = parts.isEmpty ? '' : (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
    return Semantics(
      button: true,
      label: 'Account',
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => context.go(Routes.account),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(colors: [AppColors.secondary, AppColors.blue], begin: Alignment.topLeft, end: Alignment.bottomRight),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: [BoxShadow(color: AppColors.secondary.withValues(alpha: 0.18), blurRadius: 8, offset: const Offset(0, 3))],
          ),
          child: initials.isEmpty
              ? Icon(Icons.person, color: Colors.white, size: size * 0.55)
              : Text(initials, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.36)),
        ),
      ),
    );
  }
}

/// Light layered waves along the bottom of a page, as in the designs.
class WaveFooter extends StatelessWidget {
  const WaveFooter({super.key, this.height = 90});

  final double height;

  @override
  Widget build(BuildContext context) => IgnorePointer(child: CustomPaint(size: Size(double.infinity, height), painter: _WavePainter()));
}

class _WavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    void wave(double top, double amp, Color color, {bool flip = false}) {
      final p = Path()..moveTo(0, size.height * top);
      p.cubicTo(size.width * 0.3, size.height * (top - (flip ? -amp : amp)), size.width * 0.6, size.height * (top + (flip ? -amp : amp)),
          size.width, size.height * (top - amp * 0.4));
      p
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(p, Paint()..color = color);
    }

    wave(0.35, 0.22, AppColors.sky.withValues(alpha: 0.08));
    wave(0.55, 0.18, AppColors.teal.withValues(alpha: 0.08), flip: true);
    wave(0.75, 0.12, AppColors.sky.withValues(alpha: 0.10));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
