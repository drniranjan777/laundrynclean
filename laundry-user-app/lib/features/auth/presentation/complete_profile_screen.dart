import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/primary_button.dart';
import '../../location/data/location_repository.dart';
import '../application/session_controller.dart';
import '../data/auth_repository.dart';

/// Asked once, after a new customer's first OTP: name (required) and email (optional).
class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref.read(authRepositoryProvider).updateProfile(name: _name.text, email: _email.text);
      final session = ref.read(sessionProvider);
      final email = _email.text.trim();
      ref.read(sessionProvider.notifier).updateUser(
            session.user!.copyWith(name: _name.text.trim(), email: email.isEmpty ? null : email, isProfileComplete: true),
          );
      if (mounted) context.go(routeAfterSignIn(ref.read(sessionProvider), ref.read(serviceAreaProvider)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 48, 20, 20),
            children: [
              Text('Welcome to NClean', textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Text('Tell us your name so our delivery partner knows who to ask for.',
                  textAlign: TextAlign.center, style: text.bodyLarge?.copyWith(color: AppColors.textMuted)),
              const SizedBox(height: 36),
              Text('Full Name', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w500)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(hintText: 'Enter your name'),
                validator: (v) => (v ?? '').trim().length < 2 ? 'Please enter your name' : null,
              ),
              const SizedBox(height: 20),
              Text('Email (optional)', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w500)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(hintText: 'For invoices and offers'),
                validator: (v) => Validators.optionalEmail(v ?? ''),
                onFieldSubmitted: (_) => _save(),
              ),
              const SizedBox(height: 32),
              PrimaryButton(label: 'Continue', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
