import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/application/session_controller.dart';
import '../../orders/data/orders_repository.dart';
import '../../orders/presentation/order_card.dart';
import '../data/driver_repository.dart';

/// The driver's day: today's numbers, then tabs of tasks (pickups, to store, deliveries, completed).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final stats = ref.watch(driverStatsProvider).value;
    final text = Theme.of(context).textTheme;

    // The store deactivated this driver: end the session
    ref.listen(driverStatsProvider, (_, next) {
      final error = next.error;
      if (error is ApiException && error.statusCode == 403) ref.read(sessionProvider.notifier).handleForbidden();
    });

    return DefaultTabController(
      length: TaskTab.values.length,
      child: Scaffold(
        appBar: AppBar(
          centerTitle: false,
          title: Row(children: [
            Image.asset('assets/images/logo_wordmark.png', height: 30, semanticLabel: 'NClean'),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(12)),
              child: Text('PARTNER', style: text.labelSmall?.copyWith(color: Colors.white, letterSpacing: 2)),
            ),
          ]),
          actions: [
            IconButton(tooltip: 'Profile', icon: const Icon(Icons.account_circle_outlined), onPressed: () => context.push('/profile')),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(124),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Row(children: [
                  Expanded(
                    child: Text('Hello ${user?.firstName.isNotEmpty == true ? user!.firstName : 'Partner'}',
                        style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                  ),
                  _Stat(label: 'Today', value: stats?.todayOrders, highlight: true),
                  _Stat(label: 'Active', value: stats?.activeOrders),
                  _Stat(label: 'Delivered', value: stats?.totalDelivered),
                ]),
              ),
              TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                labelColor: AppColors.secondary,
                indicatorColor: AppColors.primary,
                unselectedLabelColor: AppColors.textMuted,
                tabs: [for (final tab in TaskTab.values) _TabLabel(tab: tab)],
              ),
            ]),
          ),
        ),
        body: TabBarView(children: [for (final tab in TaskTab.values) _TaskList(tab: tab)]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.highlight = false});

  final String label;
  final int? value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      margin: const EdgeInsets.only(left: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: highlight ? AppColors.secondary : AppColors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Text(value?.toString() ?? '–', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: highlight ? Colors.white : AppColors.text)),
        Text(label, style: text.labelSmall?.copyWith(color: highlight ? Colors.white70 : AppColors.textMuted)),
      ]),
    );
  }
}

class _TabLabel extends ConsumerWidget {
  const _TabLabel({required this.tab});

  final TaskTab tab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(taskOrdersProvider(tab)).value?.length;
    return Tab(text: count == null || tab == TaskTab.completed ? tab.label : '${tab.label} ($count)');
  }
}

class _TaskList extends ConsumerWidget {
  const _TaskList({required this.tab});

  final TaskTab tab;

  static const _empty = {
    TaskTab.pickups: 'No pickups assigned right now.',
    TaskTab.toStore: 'Nothing to take to the store.',
    TaskTab.deliveries: 'No deliveries assigned right now.',
    TaskTab.completed: 'Delivered orders show up here.',
  };

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(driverStatsProvider);
    ref.invalidate(taskOrdersProvider(tab));
    await ref.read(taskOrdersProvider(tab).future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(taskOrdersProvider(tab));
    return RefreshIndicator(
      onRefresh: () => _refresh(ref),
      child: orders.when(
        data: (list) => list.isEmpty
            ? ListView(children: [
                const SizedBox(height: 120),
                const Icon(Icons.inbox_outlined, size: 56, color: AppColors.border),
                const SizedBox(height: 8),
                Text(_empty[tab]!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
              ])
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (_, i) => OrderCard(order: list[i]),
              ),
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
        error: (e, _) => ListView(children: [
          const SizedBox(height: 120),
          Text('$e', textAlign: TextAlign.center),
          Center(child: TextButton(onPressed: () => _refresh(ref), child: const Text('Try again'))),
        ]),
      ),
    );
  }
}

