import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../data/checkout_repository.dart';

/// Shown after POST /bookings/confirm (and Razorpay, for online payment).
class OrderPlacedScreen extends StatelessWidget {
  const OrderPlacedScreen({super.key, required this.order, required this.paid, this.note});

  final PlacedOrder order;
  final bool paid;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget row(IconData icon, String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Icon(icon, size: 20, color: AppColors.textMuted),
            const SizedBox(width: 10),
            Text(label, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            const Spacer(),
            Flexible(child: Text(value, textAlign: TextAlign.end, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600))),
          ]),
        );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(Routes.home);
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: const BoxDecoration(color: Color(0xFFE8F7EE), shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded, size: 60, color: Color(0xFF16A34A)),
              ),
              const SizedBox(height: 20),
              Text('Pickup booked!', textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text('Order ${order.orderNumber}', textAlign: TextAlign.center, style: text.titleMedium?.copyWith(color: AppColors.secondary)),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
                child: Column(children: [
                  if (order.pickupDate != null) row(Icons.event_outlined, 'Pickup', order.pickupDate!),
                  if (order.slot != null) row(Icons.schedule, 'Time', order.slot!),
                  if (order.storeName != null) row(Icons.store_outlined, 'Store', order.storeName!),
                  row(Icons.receipt_long_outlined, 'Total', rupees(order.total)),
                  row(paid ? Icons.verified_outlined : Icons.payments_outlined, 'Payment', paid ? 'Paid' : 'Pay on delivery'),
                ]),
              ),
              if (note != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFFFF4E5), borderRadius: BorderRadius.circular(12)),
                  child: Text(note!, style: text.bodyMedium?.copyWith(color: const Color(0xFF92400E))),
                ),
              ],
              const SizedBox(height: 16),
              Text('Our delivery partner will come in your time slot. Keep your clothes ready.',
                  textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
              const SizedBox(height: 28),
              FilledButton(
                onPressed: () {
                  context.go(Routes.home);
                  context.push('/orders/${order.id}');
                },
                child: const Text('Track order'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(onPressed: () => context.go(Routes.home), child: const Text('Back to home')),
            ],
          ),
        ),
      ),
    );
  }
}
