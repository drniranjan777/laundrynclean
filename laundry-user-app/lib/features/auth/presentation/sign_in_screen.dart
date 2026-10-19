import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../data/auth_repository.dart';

/// "Login or Sign Up" from the design: the NClean hero (logo, tagline, what we offer), then the mobile number
/// and Send OTP. The OTP screen follows.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _phone = TextEditingController();
  final _terms = TapGestureRecognizer();
  final _privacy = TapGestureRecognizer();
  String? _error;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _terms.onTap = () => context.push('/content/terms');
    _privacy.onTap = () => context.push('/content/privacy');
  }

  @override
  void dispose() {
    _phone.dispose();
    _terms.dispose();
    _privacy.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final invalid = Validators.mobile(_phone.text);
    setState(() => _error = invalid);
    if (invalid != null) return;

    final phone = Validators.normaliseMobile(_phone.text);
    setState(() => _sending = true);
    try {
      await ref.read(authRepositoryProvider).sendOtp(phone);
      if (mounted) context.push('${Routes.otp}?phone=$phone');
    } on ApiException catch (e) {
      // 403 staff number, 429 cooldown / lock: the backend's message says what to do
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final size = MediaQuery.sizeOf(context);
    final heroHeight = (size.height * 0.46).clamp(330.0, 430.0);

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: Column(
              children: [
                _Hero(height: heroHeight),
                Transform.translate(
                  offset: const Offset(0, -28),
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                    ),
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Login or Sign Up',
                          style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.secondary),
                        ),
                        const SizedBox(height: 6),
                        Text('Enter your mobile number to continue', style: text.bodyLarge?.copyWith(color: AppColors.textMuted)),
                        const SizedBox(height: 20),
                        TextField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.telephoneNumberNational],
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')), LengthLimitingTextInputFormatter(14)],
                          style: text.bodyLarge,
                          decoration: InputDecoration(
                            hintText: 'Enter mobile number',
                            errorText: _error,
                            errorMaxLines: 3,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
                            ),
                            prefixIcon: Padding(
                              padding: const EdgeInsets.only(left: 14, right: 10),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Text('🇮🇳', style: TextStyle(fontSize: 22)),
                                  const SizedBox(width: 8),
                                  Text('+91', style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                                  const SizedBox(width: 12),
                                  Container(width: 1, height: 28, color: AppColors.border),
                                ],
                              ),
                            ),
                          ),
                          onChanged: (_) {
                            if (_error != null) setState(() => _error = null);
                          },
                          onSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _sending ? null : _submit,
                          child: _sending
                              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.6, color: Colors.white))
                              : const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [Text('Send OTP'), SizedBox(width: 10), Icon(Icons.arrow_forward, size: 22)],
                                ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          "We'll send a 4-digit code to verify your number.",
                          textAlign: TextAlign.center,
                          style: text.bodySmall?.copyWith(color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 24),
                        Text.rich(
                          TextSpan(
                            style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
                            children: [
                              const TextSpan(text: 'By continuing, you agree to our\n'),
                              TextSpan(
                                text: 'Terms & Conditions',
                                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                                recognizer: _terms,
                              ),
                              const TextSpan(text: '  and  '),
                              TextSpan(
                                text: 'Privacy Policy',
                                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                                recognizer: _privacy,
                              ),
                            ],
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                const WaveFooter(height: 70),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Logo, "Fresh Clothes, Happier You", the three promises (the active one cycles with the dots), laundry picture
/// and the brand wave.
class _Hero extends StatefulWidget {
  const _Hero({required this.height});

  final double height;

  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> {
  static const _features = [
    (Icons.local_shipping_outlined, 'Easy\nPickup'),
    (Icons.auto_awesome, 'Professional\nCleaning'),
    (Icons.dry_cleaning_outlined, 'Fresh &\nHygienic'),
  ];
  int _active = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 2600), (_) {
      if (mounted) setState(() => _active = (_active + 1) % _features.length);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final width = MediaQuery.sizeOf(context).width;
    final canPop = Navigator.of(context).canPop();
    return SizedBox(
      height: widget.height,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFFF7FBFE), Color(0xFFEAF5FC)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
            ),
          ),
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            width: width * 0.5,
            child: ShaderMask(
              shaderCallback: (r) => const LinearGradient(colors: [Colors.transparent, Colors.white], stops: [0, 0.35]).createShader(r),
              blendMode: BlendMode.dstIn,
              child: Image.asset('assets/images/art_login.webp', fit: BoxFit.cover, alignment: Alignment.centerRight, excludeFromSemantics: true),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 20,
            child: CustomPaint(size: Size(width, 90), painter: _HeroWave()),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 44,
                    child: canPop
                        ? IconButton(
                            onPressed: () => context.pop(),
                            icon: const Icon(Icons.arrow_back),
                            padding: EdgeInsets.zero,
                            alignment: Alignment.centerLeft,
                          )
                        : null,
                  ),
                  const SizedBox(height: 8),
                  Image.asset('assets/images/logo_wordmark.png', height: 46, semanticLabel: 'NClean'),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: width * 0.58,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Fresh Clothes,\nHappier You',
                        style: text.headlineMedium?.copyWith(color: AppColors.secondary, fontWeight: FontWeight.w800, height: 1.2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: width * 0.6,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < _features.length; i++)
                          Expanded(
                            child: Column(
                              children: [
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 300),
                                  width: 46,
                                  height: 46,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: i == _active ? AppColors.primary.withValues(alpha: 0.16) : AppColors.sky.withValues(alpha: 0.12),
                                  ),
                                  child: Icon(_features[i].$1, color: AppColors.secondary, size: 24),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  _features[i].$2,
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  style: text.labelSmall?.copyWith(color: AppColors.text, height: 1.25),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      for (var i = 0; i < _features.length; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          margin: const EdgeInsets.only(right: 6),
                          width: i == _active ? 26 : 16,
                          height: 4,
                          decoration: BoxDecoration(
                            color: i == _active ? AppColors.primary : AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Navy-to-teal wave rising on the right, as in the design.
class _HeroWave extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final light = Path()
      ..moveTo(0, h * 0.75)
      ..cubicTo(w * 0.35, h * 0.2, w * 0.6, h * 1.0, w, h * 0.05)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(light, Paint()..color = AppColors.sky.withValues(alpha: 0.35));
    final dark = Path()
      ..moveTo(w * 0.2, h)
      ..cubicTo(w * 0.5, h * 0.9, w * 0.7, h * 0.25, w, h * 0.0)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(dark, Paint()..shader = const LinearGradient(colors: [AppColors.teal, AppColors.secondary]).createShader(Offset.zero & size));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
