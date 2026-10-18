import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../auth/application/session_controller.dart';
import '../../location/data/location_repository.dart';
import '../../orders/data/orders_repository.dart';
import '../../subscriptions/data/subscriptions_repository.dart';
import '../../wallet/data/wallet_repository.dart';

/// Account tab: profile, quick tiles (wallet, orders, membership) and the menus.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You can sign in again any time with your mobile number.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(style: TextButton.styleFrom(foregroundColor: AppColors.error), onPressed: () => Navigator.pop(c, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(serviceAreaProvider.notifier).clear();
    await ref.read(sessionProvider.notifier).signOut();
  }

  /// Opens a page and refreshes the tiles when coming back.
  Future<void> _go(BuildContext context, WidgetRef ref, String route) async {
    await context.push(route);
    refreshWallet(ref);
    ref.invalidate(ordersProvider);
    ref.invalidate(mySubscriptionProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final area = ref.watch(serviceAreaProvider);
    final balance = ref.watch(walletBalanceProvider).value;
    final orders = ref.watch(ordersProvider).value?.orders;
    final ongoing = orders?.where((o) => o.status.isActive).length;
    final membership = ref.watch(mySubscriptionProvider).value;
    final text = Theme.of(context).textTheme;
    final initial = (user?.firstName.isNotEmpty ?? false) ? user!.firstName[0].toUpperCase() : '?';

    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: AppBar(title: const Text('Account'), backgroundColor: AppColors.surfaceMuted),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          refreshWallet(ref);
          ref.invalidate(ordersProvider);
          ref.invalidate(mySubscriptionProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            // Profile
            AppCard(
              child: Row(children: [
                Container(
                  width: 60,
                  height: 60,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(gradient: AppColors.brandGradient, shape: BoxShape.circle),
                  child: Text(initial, style: text.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Flexible(child: Text(user?.name ?? '', overflow: TextOverflow.ellipsis, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
                      if (membership != null) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.workspace_premium, size: 20, color: AppColors.primary),
                      ],
                    ]),
                    Text('+91 ${user?.phone ?? ''}', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                    if ((user?.email ?? '').isNotEmpty) Text(user!.email!, overflow: TextOverflow.ellipsis, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 12),
            // Quick tiles
            Row(children: [
              Expanded(
                child: _QuickTile(
                  icon: Icons.account_balance_wallet_outlined,
                  value: balance == null ? '—' : rupees(balance),
                  label: 'Wallet',
                  onTap: () => _go(context, ref, '/wallet'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.local_laundry_service_outlined,
                  value: ongoing == null ? '—' : '$ongoing',
                  label: 'In progress',
                  onTap: () => _go(context, ref, '/orders'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _QuickTile(
                  icon: Icons.workspace_premium_outlined,
                  value: membership?.planName ?? 'Join',
                  label: 'Membership',
                  onTap: () => _go(context, ref, '/subscriptions'),
                ),
              ),
            ]),
            const _GroupTitle('Orders & payments'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                _MenuRow(icon: Icons.receipt_long_outlined, title: 'My orders', subtitle: 'Track, cancel or reorder', onTap: () => _go(context, ref, '/orders')),
                const _RowDivider(),
                _MenuRow(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Wallet',
                  subtitle: balance == null ? 'Add money, see history' : 'Balance ${rupees(balance)}',
                  onTap: () => _go(context, ref, '/wallet'),
                ),
                const _RowDivider(),
                _MenuRow(
                  icon: Icons.workspace_premium_outlined,
                  title: 'Membership',
                  subtitle: membership == null
                      ? 'Free delivery and up to 20% off'
                      : '${membership.planName} · ${membership.isCancelled ? 'ends' : 'valid till'} ${shortDate(membership.endDate)}',
                  onTap: () => _go(context, ref, '/subscriptions'),
                ),
              ]),
            ),
            const _GroupTitle('Pickup'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                _MenuRow(
                  icon: Icons.location_on_outlined,
                  title: 'Service area',
                  subtitle: area == null ? 'Not set' : '${area.pincode} · ${area.label}',
                  onTap: () => context.push(Routes.location),
                ),
                const _RowDivider(),
                _MenuRow(icon: Icons.home_outlined, title: 'Saved addresses', subtitle: 'Where we pick up and deliver', onTap: () => context.push('/addresses')),
              ]),
            ),
            const _GroupTitle('Support'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                _MenuRow(icon: Icons.help_outline, title: 'Help & FAQs', subtitle: 'Call, chat or browse answers', onTap: () => context.push('/help')),
                const _RowDivider(),
                _MenuRow(icon: Icons.description_outlined, title: 'Terms & privacy', subtitle: 'How we work with your data', onTap: () => context.push('/content/terms')),
              ]),
            ),
            const SizedBox(height: 16),
            AppCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                leading: const Icon(Icons.logout, color: AppColors.error),
                title: Text('Sign out', style: text.bodyLarge?.copyWith(color: AppColors.error, fontWeight: FontWeight.w600)),
                onTap: () => _signOut(context, ref),
              ),
            ),
            const SizedBox(height: 16),
            Center(child: Text('NClean ${Env.appVersion}', style: text.bodySmall?.copyWith(color: AppColors.textMuted))),
          ],
        ),
      ),
    );
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({required this.icon, required this.value, required this.label, required this.onTap});

  final IconData icon;
  final String value;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: AppColors.primary),
        const SizedBox(height: 10),
        Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
      ]),
    );
  }
}

class _GroupTitle extends StatelessWidget {
  const _GroupTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
        child: Text(title.toUpperCase(),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.textMuted, letterSpacing: 1, fontWeight: FontWeight.w700)),
      );
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.icon, required this.title, required this.subtitle, required this.onTap});

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: AppColors.secondary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: AppColors.secondary, size: 22),
      ),
      title: Text(title, style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
      onTap: onTap,
    );
  }
}

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) => const Divider(height: 1, indent: 68, endIndent: 16);
}
