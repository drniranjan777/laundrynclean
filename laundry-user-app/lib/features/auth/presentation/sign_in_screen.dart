import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/auth_repository.dart';

/// "Sign In" from the designs: mobile number only; an OTP follows.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _phone = TextEditingController();
  String? _error;
  bool _sending = false;

  @override
  void dispose() {
    _phone.dispose();
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
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 48),
                  Text('Sign In', textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
                  SizedBox(height: constraints.maxHeight * 0.18),
                  Text('Mobile Number', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w500)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.telephoneNumberNational],
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')), LengthLimitingTextInputFormatter(14)],
                    style: text.bodyLarge,
                    decoration: InputDecoration(
                      hintText: 'Enter mobile number',
                      prefixText: '+91  ',
                      prefixStyle: text.bodyLarge,
                      errorText: _error,
                      errorMaxLines: 3,
                    ),
                    onChanged: (_) {
                      if (_error != null) setState(() => _error = null);
                    },
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 28),
                  PrimaryButton(label: 'Sign In', loading: _sending, onPressed: _submit),
                  const SizedBox(height: 16),
                  Text("We'll send a 4-digit code to verify your number.",
                      textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
