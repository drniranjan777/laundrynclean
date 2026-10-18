import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/contact.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../cart/application/cart_controller.dart';
import '../../onboarding/data/onboarding_repository.dart';
import '../../wallet/data/wallet_repository.dart';
import '../data/orders_repository.dart';

/// One order: status and tracker, items, pickup details, bill and payment, with Cancel / Reorder / Help.
class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  bool _busy = false;

  void _toast(String message) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  Future<void> _cancel(Order order) async {
    final refund = order.paymentStatus == 'paid' && ['wallet', 'upi', 'card'].contains(order.paymentMethod);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Cancel order #${order.orderNumber}?'),
        content: Text(refund
            ? 'The ${rupees(order.total)} you paid goes back to your NClean wallet right away.'
            : 'Your pickup on ${shortDate(DateTime.tryParse(order.pickupDate ?? ''))} will be cancelled.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep order')),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      final message = await ref.read(ordersRepositoryProvider).cancel(order.id);
      ref.invalidate(orderDetailProvider(order.id));
      ref.invalidate(ordersProvider);
      refreshWallet(ref);
      _toast(message);
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reorder(Order order) async {
    setState(() => _busy = true);
    final cart = ref.read(cartProvider.notifier);
    var added = 0;
    String? problem;
    for (final line in order.reorderable) {
      try {
        await cart.add(line.itemId!, quantity: line.quantity, color: line.color, size: line.size);
        added++;
      } on ApiException catch (e) {
        problem ??= e.message;
      } catch (_) {
        problem ??= 'Some items couldn\'t be added';
      }
    }
    if (!mounted) return;
    setState(() => _busy = false);
    if (added == 0) return _toast(problem ?? 'These items aren\'t available any more');
    _toast(problem == null ? 'Added to your cart' : 'Added $added of ${order.reorderable.length} items. $problem');
    context.go(Routes.cart);
  }

  void _help(Order order) {
    final config = ref.read(appConfigProvider);
    final storePhone = order.storePhone;
    final supportPhone = config?.supportPhone;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Help with order #${order.orderNumber}', style: Theme.of(c).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),
          if (storePhone != null && storePhone.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.storefront_outlined, color: AppColors.primary),
              title: Text('Call ${order.storeName ?? 'the store'}'),
              subtitle: Text(storePhone),
              onTap: () => _open(c, Contact.call(storePhone)),
            ),
          if (supportPhone != null && supportPhone.isNotEmpty) ...[
            ListTile(
              leading: const Icon(Icons.support_agent_outlined, color: AppColors.primary),
              title: const Text('Call NClean support'),
              subtitle: Text(supportPhone),
              onTap: () => _open(c, Contact.call(supportPhone)),
            ),
            ListTile(
              leading: const Icon(Icons.chat_outlined, color: AppColors.primary),
              title: const Text('Chat on WhatsApp'),
              onTap: () => _open(c, Contact.whatsApp(supportPhone, message: 'Hi, I need help with my NClean order #${order.orderNumber}')),
            ),
          ],
          ListTile(
            leading: const Icon(Icons.help_outline, color: AppColors.primary),
            title: const Text('FAQs'),
            onTap: () {
              Navigator.pop(c);
              context.push('/help');
            },
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  Future<void> _open(BuildContext sheet, Future<bool> launch) async {
    Navigator.pop(sheet);
    if (!await launch && mounted) _toast('Couldn\'t open that on this phone');
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(orderDetailProvider(widget.orderId));
    final order = detail.value;
    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: AppBar(
        title: Text(order == null ? 'Order' : 'Order #${order.orderNumber}'),
        backgroundColor: AppColors.surfaceMuted,
        actions: [if (order != null) IconButton(tooltip: 'Help', icon: const Icon(Icons.headset_mic_outlined), onPressed: () => _help(order))],
      ),
      body: AsyncView(
        value: detail,
        onRetry: () => ref.invalidate(orderDetailProvider(widget.orderId)),
        data: (o) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(orderDetailProvider(widget.orderId));
            await ref.read(orderDetailProvider(widget.orderId).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _StatusHeader(order: o),
              if (!o.isStoreOrder && o.status != OrderStatus.cancelled) ...[
                const SizedBox(height: 12),
                AppCard(child: _Tracker(order: o)),
              ],
              const SizedBox(height: 12),
              _ItemsCard(order: o),
              if (!o.isStoreOrder) ...[
                const SizedBox(height: 12),
                _PickupCard(order: o),
              ],
              const SizedBox(height: 12),
              _BillCard(order: o),
            ],
          ),
        ),
      ),
      bottomNavigationBar: order == null || (!order.canCancel && order.reorderable.isEmpty)
          ? null
          : Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
              child: SafeArea(
                top: false,
                child: Row(children: [
                  if (order.canCancel)
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)),
                        onPressed: _busy ? null : () => _cancel(order),
                        child: const Text('Cancel order'),
                      ),
                    ),
                  if (order.canCancel && order.reorderable.isNotEmpty) const SizedBox(width: 12),
                  if (order.reorderable.isNotEmpty)
                    Expanded(
                      child: FilledButton(
                        onPressed: _busy ? null : () => _reorder(order),
                        child: _busy
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                            : const Text('Reorder'),
                      ),
                    ),
                ]),
              ),
            ),
    );
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final s = order.status;
    final pickup = DateTime.tryParse(order.pickupDate ?? '');
    final subtitle = switch (s) {
      OrderStatus.pending => order.paymentMethod == 'cod' ? 'We\'re confirming your order' : 'Waiting for your payment to go through',
      OrderStatus.confirmed => pickup == null ? 'We\'ll pick up your clothes soon' : 'Pickup on ${shortDate(pickup)}${order.slot == null ? '' : ', ${order.slot}'}',
      OrderStatus.pickupScheduled => 'A pickup partner is on the way${order.slot == null ? '' : ' (${order.slot})'}',
      OrderStatus.pickedUp || OrderStatus.inProcess =>
        order.estimatedDelivery == null ? 'Your clothes are being cared for' : 'Expected back by ${shortDate(DateTime.tryParse(order.estimatedDelivery!))}',
      OrderStatus.ready => 'Your clothes are ready and will be delivered soon',
      OrderStatus.outForDelivery => 'Your clothes are on the way to you',
      OrderStatus.delivered => 'Thank you for choosing NClean',
      OrderStatus.cancelled => order.paymentStatus == 'refunded' ? 'The amount paid was refunded to your wallet' : 'This order was cancelled',
    };
    final icon = switch (s) {
      OrderStatus.delivered => Icons.check_circle,
      OrderStatus.cancelled => Icons.cancel,
      OrderStatus.outForDelivery => Icons.delivery_dining,
      OrderStatus.pickedUp || OrderStatus.inProcess => Icons.local_laundry_service,
      _ => Icons.schedule,
    };
    return AppCard(
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(color: s.color.withValues(alpha: 0.12), shape: BoxShape.circle),
          child: Icon(icon, color: s.color, size: 28),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.label, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: s.color)),
            const SizedBox(height: 2),
            Text(subtitle, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 6),
            Text('Placed ${shortDate(order.createdAt, withTime: true)}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
          ]),
        ),
      ]),
    );
  }
}

/// Vertical tracker: done steps (with when they happened), the current step, and what's next.
class _Tracker extends StatelessWidget {
  const _Tracker({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final steps = OrderStatus.trackerSteps;
    final current = order.status == OrderStatus.pending ? 0 : steps.indexOf(order.status).clamp(0, steps.length - 1);
    DateTime? when(OrderStatus s) {
      if (s == OrderStatus.confirmed) return order.createdAt;
      final hits = order.timeline.where((e) => e.status == s || (s == OrderStatus.pickupScheduled && e.type == 'driver_assigned'));
      return hits.isEmpty ? null : hits.last.at;
    }

    final failures = order.timeline.where((e) => e.isFailure).toList();
    final rows = <Widget>[];
    for (var i = 0; i < steps.length; i++) {
      final done = i < current || (i == current && order.status == OrderStatus.delivered);
      final isCurrent = i == current && order.status != OrderStatus.delivered;
      final at = (done || isCurrent) ? when(steps[i]) : null;
      rows.add(_TrackerRow(
        title: steps[i].step,
        subtitle: at == null ? null : friendlyDateTime(at),
        state: done ? _Dot.done : (isCurrent ? _Dot.current : _Dot.todo),
        last: i == steps.length - 1,
      ));
      // Missed attempts appear under the step they belong to
      final stepFailures = failures.where((f) =>
          (f.type == 'pickup_failed' && steps[i] == OrderStatus.pickupScheduled) || (f.type == 'delivery_failed' && steps[i] == OrderStatus.outForDelivery));
      for (final f in stepFailures) {
        rows.add(_TrackerRow(
          title: f.type == 'pickup_failed' ? 'Pickup attempt missed' : 'Delivery attempt missed',
          subtitle: [f.reason, friendlyDateTime(f.at)].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
          state: _Dot.warning,
          last: false,
        ));
      }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Order tracking', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 12),
      ...rows,
    ]);
  }
}

enum _Dot { done, current, todo, warning }

class _TrackerRow extends StatelessWidget {
  const _TrackerRow({required this.title, required this.state, required this.last, this.subtitle});

  final String title;
  final String? subtitle;
  final _Dot state;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final color = switch (state) {
      _Dot.done => AppColors.primary,
      _Dot.current => AppColors.blue,
      _Dot.todo => AppColors.border,
      _Dot.warning => const Color(0xFFB45309),
    };
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 28,
          child: Column(children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: state == _Dot.todo ? Colors.white : color,
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2),
                boxShadow: state == _Dot.current ? [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 8, spreadRadius: 2)] : null,
              ),
              child: switch (state) {
                _Dot.done => const Icon(Icons.check, size: 14, color: Colors.white),
                _Dot.warning => const Icon(Icons.priority_high, size: 14, color: Colors.white),
                _Dot.current => const Icon(Icons.circle, size: 8, color: Colors.white),
                _Dot.todo => null,
              },
            ),
            if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 2), color: state == _Dot.done ? AppColors.primary : AppColors.border)),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: text.bodyLarge?.copyWith(
                    fontWeight: state == _Dot.current ? FontWeight.w700 : FontWeight.w500,
                    color: state == _Dot.todo ? AppColors.textMuted : (state == _Dot.warning ? color : AppColors.text),
                  )),
              if (subtitle != null && subtitle!.isNotEmpty) Text(subtitle!, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _ItemsCard extends StatelessWidget {
  const _ItemsCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${order.itemCount} item${order.itemCount == 1 ? '' : 's'}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        for (final l in order.lines)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.checkroom_outlined, color: AppColors.secondary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l.name, style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                  Text('${l.quantity} × ${rupees(l.price)}${l.options.isEmpty ? '' : ' · ${l.options}'}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                  if (l.note != null && l.note!.isNotEmpty) Text(l.note!, style: text.bodySmall?.copyWith(color: const Color(0xFFB45309))),
                ]),
              ),
              Text(rupees(l.lineTotal), style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
            ]),
          ),
      ]),
    );
  }
}

class _PickupCard extends StatelessWidget {
  const _PickupCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget line(IconData icon, String title, String? value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 20, color: AppColors.secondary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                if (value != null) Text(value, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
              ]),
            ),
          ]),
        );
    final address = order.address;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Pickup details', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        if (order.pickupDate != null)
          line(Icons.event_outlined, 'Pickup slot', '${shortDate(DateTime.tryParse(order.pickupDate!))}${order.slot == null ? '' : ' · ${order.slot}'}'),
        if (order.estimatedDelivery != null && order.status.isActive)
          line(Icons.local_shipping_outlined, 'Expected delivery', shortDate(DateTime.tryParse(order.estimatedDelivery!))),
        if (address != null)
          line(Icons.location_on_outlined, '${address.label ?? 'Address'} · ${address.fullName}', '${address.lines}${address.phone == null ? '' : '\n${address.phone}'}'),
        if (order.storeName != null) line(Icons.storefront_outlined, 'Store', order.storeName),
        if (order.notes != null && order.notes!.trim().isNotEmpty) line(Icons.sticky_note_2_outlined, 'Your instructions', order.notes),
      ]),
    );
  }
}

class _BillCard extends StatelessWidget {
  const _BillCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    const green = Color(0xFF16A34A);
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Bill details', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        KeyValueRow('Item total', rupees(order.subtotal)),
        if (!order.isStoreOrder) KeyValueRow('Pickup & delivery', order.deliveryFee == 0 ? 'Free' : rupees(order.deliveryFee)),
        if (order.discount > 0) KeyValueRow('Discount', '- ${rupees(order.discount)}', valueColor: green),
        if (order.gstAmount > 0) KeyValueRow('GST', rupees(order.gstAmount)),
        const Divider(height: 18),
        KeyValueRow('Total', rupees(order.total), bold: true),
        const SizedBox(height: 8),
        Row(children: [
          Icon(order.paymentMethod == 'wallet' ? Icons.account_balance_wallet_outlined : Icons.payments_outlined, size: 18, color: AppColors.textMuted),
          const SizedBox(width: 8),
          Expanded(child: Text(order.paymentLabel, style: text.bodyMedium?.copyWith(color: AppColors.textMuted))),
        ]),
        if (order.invoiceNumber != null) ...[
          const SizedBox(height: 4),
          Text('Invoice ${order.invoiceNumber}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
        ],
      ]),
    );
  }
}
