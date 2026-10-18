import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/location_models.dart';
import '../data/location_repository.dart';

/// "Choose Your location" from the designs: pin code, or the phone's current location.
class ChooseLocationScreen extends ConsumerStatefulWidget {
  const ChooseLocationScreen({super.key});

  @override
  ConsumerState<ChooseLocationScreen> createState() => _ChooseLocationScreenState();
}

class _ChooseLocationScreenState extends ConsumerState<ChooseLocationScreen> {
  final _pincode = TextEditingController();
  String? _error;
  PincodeCheck? _notServed;
  bool _checking = false;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    _pincode.text = ref.read(serviceAreaProvider)?.pincode ?? '';
  }

  @override
  void dispose() {
    _pincode.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    final invalid = Validators.pincode(_pincode.text);
    setState(() {
      _error = invalid;
      _notServed = null;
    });
    if (invalid != null) return;

    setState(() => _checking = true);
    try {
      final result = await ref.read(locationRepositoryProvider).checkPincode(_pincode.text.trim());
      if (!result.isServiceable || result.area == null) {
        setState(() => _notServed = result);
        return;
      }
      await ref.read(serviceAreaProvider.notifier).choose(result.area!);
      if (mounted) context.go(Routes.home);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
      _notServed = null;
    });
    try {
      final found = await ref.read(locationRepositoryProvider).detectPincode();
      _pincode.text = found.pincode;
      await _apply();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = "We couldn't get your location. Please enter your pin code.");
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final canGoBack = context.canPop() || ref.watch(serviceAreaProvider) != null;
    return Scaffold(
      appBar: canGoBack ? AppBar(leading: BackButton(onPressed: () => context.canPop() ? context.pop() : context.go(Routes.home))) : null,
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.fromLTRB(20, canGoBack ? 8 : 64, 20, 20),
          children: [
            Text('Choose Your location', textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            Text('Select a Pickup location to See Order Availability and Pickup option',
                textAlign: TextAlign.center, style: text.bodyLarge?.copyWith(color: AppColors.textMuted, height: 1.4)),
            const SizedBox(height: 48),
            Text('Indian Pin Code', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w500)),
            const SizedBox(height: 10),
            TextField(
              controller: _pincode,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              decoration: InputDecoration(hintText: 'Enter Indian Pin Code', errorText: _error, errorMaxLines: 3),
              onChanged: (_) {
                if (_error != null || _notServed != null) {
                  setState(() {
                    _error = null;
                    _notServed = null;
                  });
                }
              },
              onSubmitted: (_) => _apply(),
            ),
            if (_notServed != null) ...[
              const SizedBox(height: 16),
              _NotServedCard(check: _notServed!),
            ],
            const SizedBox(height: 28),
            PrimaryButton(label: 'Apply', loading: _checking && !_locating, onPressed: _locating ? null : _apply),
            const SizedBox(height: 14),
            Text('Or', textAlign: TextAlign.center, style: text.bodyLarge?.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 14),
            OutlinedButton(
              onPressed: _locating || _checking ? null : _useCurrentLocation,
              child: _locating
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4))
                  : const Text('Use my Current location'),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotServedCard extends StatelessWidget {
  const _NotServedCard({required this.check});

  final PincodeCheck check;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.location_off_outlined, color: AppColors.secondary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("We're not in ${check.pincode} yet", style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(check.message ?? 'We are expanding soon. Try another pin code.',
                    style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
