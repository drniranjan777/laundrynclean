import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/ui_kit.dart';
import '../data/orders_repository.dart';

/// My orders: Ongoing / Completed / Cancelled tabs over the customer's orders, newest first.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);
    final all = orders.value?.orders ?? const <Order>[];
    final ongoing = all.where((o) => o.status.isActive).toList();
    final completed = all.where((o) => o.status.isCompleted).toList();
    final cancelled = all.where((o) => o.status == OrderStatus.cancelled).toList();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: AppColors.surfaceMuted,
        appBar: AppBar(
          title: const Text('My orders'),
          backgroundColor: AppColors.surfaceMuted,
          bottom: TabBar(
            labelColor: AppColors.secondary,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.primary,
            indicatorWeight: 3,
            labelStyle: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            tabs: [
              Tab(text: ongoing.isEmpty ? 'Ongoing' : 'Ongoing (${ongoing.length})'),
              const Tab(text: 'Completed'),
              const Tab(text: 'Cancelled'),
            ],
          ),
        ),
        body: AsyncView(
          value: orders,
          onRetry: () => ref.invalidate(ordersProvider),
          data: (page) => TabBarView(children: [
            _OrderList(
              orders: ongoing,
              hasMore: page.hasMore,
              empty: EmptyState(
                icon: Icons.local_laundry_service_outlined,
                title: 'No ongoing orders',
                message: 'Book a pickup and track it here, from pickup to delivery.',
                actionLabel: 'Schedule a pickup',
                onAction: () => context.go(Routes.home),
              ),
            ),
            _OrderList(
              orders: completed,
              hasMore: page.hasMore,
              empty: const EmptyState(icon: Icons.inventory_2_outlined, title: 'No completed orders yet', message: 'Delivered and collected orders show up here.'),
            ),
            _OrderList(
              orders: cancelled,
              hasMore: page.hasMore,
              empty: const EmptyState(icon: Icons.block_outlined, title: 'No cancelled orders'),
            ),
          ]),
        ),
      ),
    );
  }
}

class _OrderList extends ConsumerWidget {
  const _OrderList({required this.orders, required this.hasMore, required this.empty});

  final List<Order> orders;
  final bool hasMore;
  final Widget empty;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Older orders may be on later pages: keep loading while this tab is short
    if (orders.length < 6 && hasMore) {
      WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(ordersProvider.notifier).loadMore());
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async {
        ref.invalidate(ordersProvider);
        await ref.read(ordersProvider.future);
      },
      child: orders.isEmpty && !hasMore
          ? ListView(children: [SizedBox(height: MediaQuery.of(context).size.height * 0.6, child: empty)])
          : NotificationListener<ScrollNotification>(
              onNotification: (n) {
                if (n.metrics.extentAfter < 400) ref.read(ordersProvider.notifier).loadMore();
                return false;
              },
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                itemCount: orders.length + (hasMore ? 1 : 0),
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (_, i) => i == orders.length
                    ? const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
                    : OrderCard(order: orders[i]),
              ),
            ),
    );
  }
}

/// Order summary card: number, date, items, total and status; opens the order.
class OrderCard extends ConsumerWidget {
  const OrderCard({super.key, required this.order});

  final Order order;

  /// "Pickup 21 Oct 2026, 08:00 AM - 10:00 AM" until it's picked up, then "Expected by 23 Oct 2026"
  /// (or "Ready to collect at the store").
  static String? _nextStep(Order order) {
    if (order.status == OrderStatus.readyForPickup) return 'Ready to collect at ${order.storeName ?? 'the store'}';
    if (order.status.index <= OrderStatus.pickupScheduled.index) {
      return order.pickupDate == null ? null : 'Pickup ${shortDate(DateTime.tryParse(order.pickupDate!))}${order.slot == null ? '' : ', ${order.slot}'}';
    }
    return order.estimatedDelivery == null ? null : 'Expected by ${shortDate(DateTime.tryParse(order.estimatedDelivery!))}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final preview = order.lines.take(2).map((l) => '${l.name} × ${l.quantity}').join(', ');
    final more = order.lines.length - 2;
    return AppCard(
      onTap: () async {
        await context.push('/orders/${order.id}');
        ref.invalidate(ordersProvider);
      },
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('Order #${order.orderNumber}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
          Text(shortDate(order.createdAt), style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
        ]),
        const SizedBox(height: 4),
        Row(children: [
          Icon(order.isStoreOrder ? Icons.storefront_outlined : Icons.local_shipping_outlined, size: 16, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              order.isStoreOrder ? 'Store order${order.storeName == null ? '' : ' · ${order.storeName}'}' : (order.storeName ?? 'Pickup & delivery'),
              style: text.bodySmall?.copyWith(color: AppColors.textMuted),
            ),
          ),
        ]),
        if (preview.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('$preview${more > 0 ? ' +$more more' : ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: text.bodyMedium),
        ],
        if (order.status.isActive && (!order.isStoreOrder || order.status == OrderStatus.readyForPickup) && _nextStep(order) != null) ...[
          const SizedBox(height: 8),
          Row(children: [
            Icon(order.status.index <= OrderStatus.pickupScheduled.index ? Icons.event_outlined : Icons.local_shipping_outlined,
                size: 16, color: AppColors.primary),
            const SizedBox(width: 6),
            Expanded(child: Text(_nextStep(order)!, style: text.bodySmall?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600))),
          ]),
        ],
        const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1)),
        Row(children: [
          Text('${order.itemCount} item${order.itemCount == 1 ? '' : 's'}', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          const SizedBox(width: 8),
          Text(rupees(order.total), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const Spacer(),
          StatusChip(order.status.label, color: order.status.color),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, color: AppColors.textMuted),
        ]),
      ]),
    );
  }
}
