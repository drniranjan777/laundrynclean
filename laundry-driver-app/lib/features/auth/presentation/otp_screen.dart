import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/primary_button.dart';
import '../application/session_controller.dart';
import '../data/auth_repository.dart';

/// 4-digit OTP with a 30-second resend timer (the backend's cooldown). Signing in moves on to the dashboard
/// (the router redirects once the session is signed in).
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _resendAfter = 30;

  final _code = TextEditingController();
  Timer? _timer;
  int _secondsLeft = _resendAfter;
  String? _error;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendAfter);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft <= 1) t.cancel();
      if (mounted) setState(() => _secondsLeft--);
    });
  }

  Future<void> _verify() async {
    if (_code.text.length != 4) {
      setState(() => _error = 'Enter the 4-digit code');
      return;
    }
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      final user = await ref.read(authRepositoryProvider).verifyOtp(widget.phone, _code.text);
      ref.read(sessionProvider.notifier).signedIn(user);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message);
        _code.clear();
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      await ref.read(authRepositoryProvider).sendOtp(widget.phone, resend: true);
      _startTimer();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('A new code is on its way')));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final pinTheme = PinTheme(
      width: 64,
      height: 64,
      textStyle: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
      decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Verify Number')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Enter the 4-digit code sent to', textAlign: TextAlign.center, style: text.bodyLarge?.copyWith(color: AppColors.textMuted)),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('+91 ${widget.phone}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                  TextButton(onPressed: () => context.pop(), child: const Text('Change')),
                ],
              ),
              const SizedBox(height: 28),
              Center(
                child: Pinput(
                  length: 4,
                  controller: _code,
                  autofocus: true,
                  defaultPinTheme: pinTheme,
                  focusedPinTheme: pinTheme.copyBorderWith(border: Border.all(color: AppColors.secondary, width: 1.4)),
                  errorPinTheme: pinTheme.copyBorderWith(border: Border.all(color: AppColors.error)),
                  forceErrorState: _error != null,
                  separatorBuilder: (_) => const SizedBox(width: 14),
                  onCompleted: (_) => _verify(),
                  // Only once the user types again: clearing the boxes after a wrong code must keep the message
                  onChanged: (value) {
                    if (_error != null && value.isNotEmpty) setState(() => _error = null);
                  },
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Text(_error!, textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.error)),
              ],
              const SizedBox(height: 28),
              PrimaryButton(label: 'Verify', loading: _verifying, onPressed: _verify),
              const SizedBox(height: 16),
              Center(
                child: _secondsLeft > 0
                    ? Text('Resend code in 0:${_secondsLeft.toString().padLeft(2, '0')}',
                        style: text.bodyMedium?.copyWith(color: AppColors.textMuted))
                    : TextButton(onPressed: _resend, child: const Text('Resend code')),
              ),
              if (kDebugMode) ...[
                const SizedBox(height: 24),
                Text('Dev build: the backend prints the OTP in its console.',
                    textAlign: TextAlign.center, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
