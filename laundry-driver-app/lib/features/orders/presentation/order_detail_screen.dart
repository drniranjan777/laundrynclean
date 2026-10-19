import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../data/driver_order.dart';
import '../data/orders_repository.dart';
import 'contact_actions.dart';
import 'order_actions_panel.dart';

/// Everything about one task, with the buttons for what to do next (picked up, delivered, couldn't do it).
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(orderByIdProvider(orderId));
    return Scaffold(
      appBar: AppBar(title: Text(order.value?.orderNumber ?? 'Order')),
      bottomNavigationBar: order.value == null ? null : OrderActionsPanel(order: order.value!),
      body: order.when(
        data: (o) => o == null
            ? const Center(child: Text('This order is no longer assigned to you.'))
            : RefreshIndicator(onRefresh: () => ref.refresh(orderByIdProvider(orderId).future), child: _Detail(order: o)),
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
        error: (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('$e', textAlign: TextAlign.center),
            TextButton(onPressed: () => ref.invalidate(orderByIdProvider(orderId)), child: const Text('Try again')),
          ]),
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.order});

  final DriverOrder order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final address = order.address;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            const Icon(Icons.flag_outlined, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(order.stage == OrderStage.done || order.stage == OrderStage.cancelled ? order.stage.label : 'Next: ${order.stage.label}', style: text.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                Text('Status: ${order.statusLabel}', style: text.bodySmall?.copyWith(color: Colors.white70)),
              ]),
            ),
            if (order.amountToCollect > 0)
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Collect', style: text.bodySmall?.copyWith(color: Colors.white70)),
                Text(rupees(order.amountToCollect), style: text.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
              ]),
          ]),
        ),
        if (order.failedAttempts > 0)
          Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFFFF1F1), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(Icons.history, color: AppColors.error),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${order.failedAttempts} failed attempt${order.failedAttempts == 1 ? '' : 's'}${order.lastFailureReason == null ? '' : ' · last: ${order.lastFailureReason}'}',
                  style: text.bodyMedium,
                ),
              ),
            ]),
          ),
        const SizedBox(height: 16),
        _Section(
          title: 'Customer',
          children: [
            _Line(icon: Icons.person_outline, text: order.customerName ?? '—'),
            if (order.customerPhone != null) _Line(icon: Icons.phone_outlined, text: '+91 ${order.customerPhone}'),
            if (address != null) ...[
              _Line(icon: Icons.location_on_outlined, text: [if ((address.label ?? '').isNotEmpty) address.label, address.oneLine].join(' · ')),
            ],
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: order.customerPhone == null ? null : () => callNumber(context, order.customerPhone!),
                  icon: const Icon(Icons.call_outlined),
                  label: const Text('Call customer'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.secondary),
                  onPressed: address == null ? null : () => navigateTo(context, address: address),
                  icon: const Icon(Icons.navigation_outlined),
                  label: const Text('Navigate'),
                ),
              ),
            ]),
          ],
        ),
        _Section(
          title: 'Pickup',
          children: [
            _Line(icon: Icons.event_outlined, text: order.pickupDate ?? '—'),
            _Line(icon: Icons.schedule, text: order.slot ?? '—'),
            if (order.isBulkPickup) const _Line(icon: Icons.local_laundry_service_outlined, text: 'Bulk pickup (Schedule Pickup)'),
            _Line(icon: Icons.payments_outlined, text: order.awaitingBill ? '${order.paymentLabel} · billed after pickup' : '${order.paymentLabel} · ${rupees(order.total)}'),
            if ((order.customerNote ?? '').isNotEmpty) _Line(icon: Icons.sticky_note_2_outlined, text: order.customerNote!),
          ],
        ),
        _Section(
          title: order.isBulkPickup && order.items.isEmpty ? 'Items' : 'Items (${order.itemCount})',
          children: [
            if (order.isBulkPickup && order.items.isEmpty)
              Text('Bulk pickup: count every piece when you collect it. The store counts again and bills the order.',
                  style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            for (final i in order.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 36, child: Text('${i.quantity}×', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(i.name, style: text.bodyLarge),
                      if (i.options.isNotEmpty) Text(i.options, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                      if ((i.note ?? '').isNotEmpty) Text(i.note!, style: text.bodySmall?.copyWith(color: AppColors.textMuted, fontStyle: FontStyle.italic)),
                    ]),
                  ),
                ]),
              ),
          ],
        ),
        if (order.store != null)
          _Section(
            title: 'Store',
            children: [
              _Line(icon: Icons.store_outlined, text: order.store!.name),
              if ((order.store!.address ?? '').isNotEmpty) _Line(icon: Icons.location_on_outlined, text: order.store!.address!),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: order.store!.phone == null ? null : () => callNumber(context, order.store!.phone!),
                    icon: const Icon(Icons.call_outlined),
                    label: const Text('Call store'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: (order.store!.address ?? '').isEmpty ? null : () => navigateTo(context, fallbackText: order.store!.address),
                    icon: const Icon(Icons.navigation_outlined),
                    label: const Text('To store'),
                  ),
                ),
              ]),
            ],
          ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        ...children,
      ]),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 18, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
      ]),
    );
  }
}
