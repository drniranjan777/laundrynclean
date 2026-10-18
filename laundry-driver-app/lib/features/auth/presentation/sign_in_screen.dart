import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/primary_button.dart';
import '../../startup/presentation/partner_logo.dart';
import '../data/auth_repository.dart';

/// Mobile number registered by the store; an OTP follows. No sign-up.
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
      // 404: not a registered delivery partner; 403: deactivated; 429: wait / locked
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
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 40, 20, 20),
          children: [
            const Center(child: PartnerLogo(width: 190)),
            const SizedBox(height: 36),
            Text('Sign In', textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text('Use the mobile number your store registered for you.',
                textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 32),
            Text('Mobile Number', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w500)),
            const SizedBox(height: 10),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
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
          ],
        ),
      ),
    );
  }
}
