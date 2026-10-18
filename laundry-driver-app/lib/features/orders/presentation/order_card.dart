import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../data/driver_order.dart';
import 'contact_actions.dart';

/// One task: order number, slot, who and where, items, cash to collect, Call and Navigate.
class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order});

  final DriverOrder order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final dest = destinationOf(order);
    final where = order.headsToStore ? (order.store?.address ?? order.store?.name ?? '') : (order.address?.oneLine ?? '');

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/order/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(order.orderNumber, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary, fontFamily: 'monospace')),
                const SizedBox(width: 8),
                _Pill(text: order.statusLabel),
                const Spacer(),
                if (order.amountToCollect > 0)
                  _Pill(text: 'Collect ${rupees(order.amountToCollect)}', strong: true),
              ]),
              const SizedBox(height: 8),
              if (order.slot != null || order.pickupDate != null)
                Row(children: [
                  const Icon(Icons.schedule, size: 16, color: AppColors.textMuted),
                  const SizedBox(width: 6),
                  Text([order.pickupDate, order.slot].whereType<String>().join(' · '), style: text.bodyMedium),
                ]),
              const SizedBox(height: 4),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(order.headsToStore ? Icons.store_outlined : Icons.person_outline, size: 16, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    order.headsToStore ? (order.store?.name ?? 'Store') : (order.customerName ?? 'Customer'),
                    style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                Text('${order.itemCount} item${order.itemCount == 1 ? '' : 's'}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ]),
              if (order.failedAttempts > 0)
                Padding(
                  padding: const EdgeInsets.only(left: 22, top: 2),
                  child: Text('${order.failedAttempts} failed attempt${order.failedAttempts == 1 ? '' : 's'}${order.lastFailureReason == null ? '' : ': ${order.lastFailureReason}'}',
                      style: text.bodySmall?.copyWith(color: AppColors.error)),
                ),
              if (where.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 22, top: 2),
                  child: Text(where, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                ),
              if (order.stage != OrderStage.done && order.stage != OrderStage.cancelled) ...[
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(40)),
                      onPressed: dest.phone == null ? null : () => callNumber(context, dest.phone!),
                      icon: const Icon(Icons.call_outlined, size: 18),
                      label: Text(order.headsToStore ? 'Call store' : 'Call'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(40), backgroundColor: AppColors.secondary),
                      onPressed: (dest.address == null && (dest.text ?? '').isEmpty)
                          ? null
                          : () => navigateTo(context, address: dest.address, fallbackText: dest.text),
                      icon: const Icon(Icons.navigation_outlined, size: 18),
                      label: const Text('Navigate'),
                    ),
                  ),
                ]),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text, this.strong = false});

  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: strong ? const Color(0xFFFFF4E5) : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: strong ? const Color(0xFFB45309) : AppColors.textMuted,
                fontWeight: FontWeight.w600,
              )),
    );
  }
}
