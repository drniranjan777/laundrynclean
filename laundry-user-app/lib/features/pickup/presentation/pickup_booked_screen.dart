import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../data/pickup_repository.dart';

/// "Pickup Booked!" confirmation after POST /pickups succeeded (only ever shown for a real order).
class PickupBookedScreen extends StatelessWidget {
  const PickupBookedScreen({super.key, required this.booked, this.dayName});

  final BookedPickup booked;
  final String? dayName;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final date = DateTime.tryParse(booked.pickupDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final dateText = date == null ? booked.pickupDate : '${date.day} ${months[date.month - 1]} ${date.year}';
    final charges = booked.charges;
    final amountNote = booked.total > 0
        ? null
        : charges == null || charges.isFree
        ? 'Counted & billed at the store'
        : 'Billed at the store · ${rupees(charges.charge)} pickup & delivery below ${rupees(charges.freeAbove)}';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(Routes.home);
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            children: [
              const _Celebration(),
              const SizedBox(height: 12),
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: 'Pickup ',
                      style: TextStyle(color: AppColors.secondary),
                    ),
                    TextSpan(
                      text: 'Booked!',
                      style: TextStyle(color: AppColors.primary),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
                style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                'Your laundry pickup has been scheduled successfully.',
                textAlign: TextAlign.center,
                style: text.bodyLarge?.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 12),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(24)),
                  child: Text(
                    'Order #${booked.orderNumber}',
                    style: text.titleSmall?.copyWith(color: AppColors.secondary, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
                  boxShadow: [BoxShadow(color: AppColors.secondary.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 6))],
                ),
                child: Column(
                  children: [
                    _Row(icon: Icons.event_outlined, label: 'Pickup Date', value: dateText, sub: dayName),
                    const _Line(),
                    _Row(icon: Icons.schedule, label: 'Time Slot', value: booked.timeSlot ?? '—'),
                    const _Line(),
                    _Row(icon: Icons.storefront_outlined, label: 'Store', value: booked.store?.name ?? '—', sub: booked.store?.city),
                    const _Line(),
                    _Row(
                      icon: Icons.receipt_long_outlined,
                      label: 'Total Amount',
                      value: booked.total > 0 ? rupees(booked.total) : 'After pickup',
                      sub: amountNote,
                    ),
                    const _Line(),
                    _Row(
                      icon: Icons.account_balance_wallet_outlined,
                      label: 'Payment Method',
                      value: booked.isCod ? 'Pay on delivery' : 'Pay online after billing',
                      chip: booked.isCod ? 'COD' : 'ONLINE',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(18)),
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(Icons.local_shipping_outlined, color: AppColors.primary, size: 30),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: 'Our pickup partner will come in your selected time slot. ',
                              style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
                            ),
                            TextSpan(
                              text: 'Keep your clothes ready.',
                              style: text.bodyMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: () => context.go(Routes.home),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [Text('Back to Home'), SizedBox(width: 8), Icon(Icons.arrow_forward, size: 20)],
                ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () {
                  context.go(Routes.home);
                  context.push('/orders/${booked.id}');
                },
                child: const Text('Track this order'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The "booked" illustration from the design (check mark, calendar, folded clothes and basket).
class _Celebration extends StatelessWidget {
  const _Celebration();

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0.85, end: 1),
    duration: const Duration(milliseconds: 600),
    curve: Curves.easeOutBack,
    builder: (_, scale, child) => Transform.scale(scale: scale, child: child),
    child: AspectRatio(
      aspectRatio: 745 / 400,
      child: Image.asset('assets/images/art_pickup_success.webp', fit: BoxFit.contain, semanticLabel: 'Pickup booked'),
    ),
  );
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.value, this.sub, this.chip});

  final IconData icon;
  final String label;
  final String value;
  final String? sub;
  final String? chip;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: AppColors.secondary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 3,
            child: Text(label, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          ),
          Expanded(
            flex: 6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text),
                ),
                if (sub != null && sub!.isNotEmpty) Text(sub!, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                if (chip != null) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                    child: Text(
                      chip!,
                      style: text.labelSmall?.copyWith(color: AppColors.blue, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line();

  @override
  Widget build(BuildContext context) => Divider(height: 1, indent: 14, endIndent: 14, color: AppColors.border.withValues(alpha: 0.6));
}
