import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/ui_kit.dart';
import '../data/wallet_repository.dart';

/// Wallet: balance with what was added and spent, recharge offers, and the full history.
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  Future<void> _addMoney(BuildContext context, WidgetRef ref, {String? packageId}) async {
    await context.push(packageId == null ? '/wallet/add' : '/wallet/add?package=$packageId');
    refreshWallet(ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(walletSummaryProvider);
    final history = ref.watch(walletHistoryProvider);
    final packages = ref.watch(walletPackagesProvider).value ?? const <WalletPackage>[];

    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: AppBar(title: const Text('Wallet'), backgroundColor: AppColors.surfaceMuted),
      body: AsyncView(
        value: summary,
        onRetry: () => refreshWallet(ref),
        data: (s) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            refreshWallet(ref);
            await ref.read(walletSummaryProvider.future);
          },
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.extentAfter < 300) ref.read(walletHistoryProvider.notifier).loadMore();
              return false;
            },
            child: ListView(
              padding: const EdgeInsets.only(bottom: 32),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: _BalanceCard(summary: s, onAdd: () => _addMoney(context, ref)),
                ),
                if (packages.isNotEmpty) ...[
                  const SectionHeader('Recharge offers', padding: EdgeInsets.fromLTRB(20, 22, 12, 10)),
                  SizedBox(
                    height: 124,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: packages.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (_, i) => _OfferCard(package: packages[i], onTap: () => _addMoney(context, ref, packageId: packages[i].id)),
                    ),
                  ),
                ],
                const SectionHeader('Transactions', padding: EdgeInsets.fromLTRB(20, 22, 12, 6)),
                ...history.when(
                  skipLoadingOnRefresh: true,
                  loading: () => [const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))],
                  error: (e, _) => [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Center(child: TextButton(onPressed: () => ref.invalidate(walletHistoryProvider), child: const Text('Couldn\'t load history — try again'))),
                    ),
                  ],
                  data: (page) => page.items.isEmpty
                      ? [const _NoTransactions()]
                      : [
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: AppCard(
                              padding: EdgeInsets.zero,
                              child: Column(children: [
                                for (var i = 0; i < page.items.length; i++) ...[
                                  if (i > 0) const Divider(height: 1, indent: 68),
                                  TransactionTile(txn: page.items[i]),
                                ],
                              ]),
                            ),
                          ),
                          if (page.hasMore)
                            const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))),
                        ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.summary, required this.onAdd});

  final WalletSummary summary;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final muted = Colors.white.withValues(alpha: 0.75);
    return BrandHeroCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Text('NClean wallet', style: text.titleSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 18),
        Text('Available balance', style: text.bodyMedium?.copyWith(color: muted)),
        const SizedBox(height: 2),
        Text(rupees(summary.balance), style: text.displaySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
        const SizedBox(height: 18),
        Row(children: [
          Expanded(child: _Stat(label: 'Total added', value: rupees(summary.totalCredited), icon: Icons.south_west)),
          Container(width: 1, height: 34, color: Colors.white.withValues(alpha: 0.25)),
          const SizedBox(width: 14),
          Expanded(child: _Stat(label: 'Total spent', value: rupees(summary.totalDebited), icon: Icons.north_east)),
        ]),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.secondary, minimumSize: const Size.fromHeight(50)),
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: const Text('Add money'),
          ),
        ),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.icon});

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(children: [
      Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), shape: BoxShape.circle),
        child: Icon(icon, size: 14, color: Colors.white),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: text.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.75))),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
        ]),
      ),
    ]);
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.package, required this.onTap});

  final WalletPackage package;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      width: 150,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('Pay ${rupees(package.payAmount)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text('Get ${rupees(package.creditAmount)}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary)),
          ),
          const SizedBox(height: 8),
          if (package.bonus > 0)
            FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: StatusChip('+${rupees(package.bonus)} bonus', color: AppColors.primary)),
        ]),
      ),
    );
  }
}

class _NoTransactions extends StatelessWidget {
  const _NoTransactions();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
        child: Column(children: [
          const Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.border),
          const SizedBox(height: 10),
          Text('No transactions yet', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('Add money to pay for orders and memberships in one tap.',
              textAlign: TextAlign.center, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
        ]),
      ),
    );
  }
}

/// One wallet history line: what it was, when, and the amount in or out.
class TransactionTile extends StatelessWidget {
  const TransactionTile({super.key, required this.txn});

  final WalletTxn txn;

  static const _green = Color(0xFF16A34A);

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final icon = switch (txn.kind) {
      'recharge' => Icons.add_card_outlined,
      'package_bonus' => Icons.card_giftcard_outlined,
      'order_payment' => Icons.local_laundry_service_outlined,
      'refund' => Icons.replay_outlined,
      'subscription' => Icons.workspace_premium_outlined,
      _ => txn.isCredit ? Icons.south_west : Icons.north_east,
    };
    final tint = txn.isCredit ? _green : AppColors.error;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: tint.withValues(alpha: 0.1), shape: BoxShape.circle),
          child: Icon(icon, size: 20, color: tint),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(txn.title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            if (txn.description.isNotEmpty && txn.description != txn.title)
              Text(txn.description, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
            Text(friendlyDateTime(txn.createdAt), style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
          ]),
        ),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${txn.isCredit ? '+' : '−'} ${rupees(txn.amount)}',
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: txn.isCredit ? _green : AppColors.text)),
          Text('Bal ${rupees(txn.balanceAfter)}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
        ]),
      ]),
    );
  }
}

/// Balance pill for app bars; opens the wallet.
class WalletChip extends ConsumerWidget {
  const WalletChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(walletBalanceProvider).value;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Material(
        color: AppColors.primary.withValues(alpha: 0.1),
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: () async {
            await context.push('/wallet');
            refreshWallet(ref);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.account_balance_wallet_outlined, size: 18, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(balance == null ? '₹—' : rupees(balance),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
            ]),
          ),
        ),
      ),
    );
  }
}
