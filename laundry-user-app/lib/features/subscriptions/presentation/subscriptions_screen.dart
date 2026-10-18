import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../cart/application/cart_controller.dart';
import '../../wallet/data/wallet_repository.dart';
import '../data/subscriptions_repository.dart';

/// Membership: the current plan (with cancel), the plans to choose from, paid from the wallet
/// (a plan's free trial the first time), and how it works.
class SubscriptionsScreen extends ConsumerWidget {
  const SubscriptionsScreen({super.key});

  void _refresh(WidgetRef ref) {
    ref.invalidate(plansProvider);
    ref.invalidate(mySubscriptionProvider);
    ref.invalidate(cartProvider); // member prices in the cart
    refreshWallet(ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plans = ref.watch(plansProvider);
    final mine = ref.watch(mySubscriptionProvider).value;

    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: AppBar(title: const Text('Membership'), backgroundColor: AppColors.surfaceMuted),
      body: AsyncView(
        value: plans,
        onRetry: () => _refresh(ref),
        data: (data) => RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            _refresh(ref);
            await ref.read(plansProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              if (mine != null) _CurrentPlanCard(sub: mine, onChanged: () => _refresh(ref)) else const _Intro(),
              SectionHeader(mine == null ? 'Choose a plan' : 'All plans', padding: const EdgeInsets.fromLTRB(4, 22, 4, 10)),
              if (data.plans.isEmpty)
                const AppCard(child: Text('No plans are available right now.'))
              else
                for (final p in data.plans)
                  _PlanCard(
                    plan: p,
                    isCurrent: p.id == (mine?.planId ?? data.activePlanId),
                    locked: mine != null,
                    onChoose: () => _choose(context, ref, p),
                  ),
              const SizedBox(height: 8),
              const _HowItWorks(),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _choose(BuildContext context, WidgetRef ref, Plan plan) async {
    final done = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ConfirmSheet(plan: plan),
    );
    _refresh(ref);
    if (done != null && context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(done)));
    }
  }
}

class _Intro extends StatelessWidget {
  const _Intro();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return BrandHeroCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.workspace_premium, color: Colors.white, size: 34),
        const SizedBox(height: 12),
        Text('Save on every order', style: text.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Members get free pickup & delivery and up to 20% off, applied automatically at checkout.',
            style: text.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.85))),
      ]),
    );
  }
}

class _CurrentPlanCard extends ConsumerStatefulWidget {
  const _CurrentPlanCard({required this.sub, required this.onChanged});

  final MySubscription sub;
  final VoidCallback onChanged;

  @override
  ConsumerState<_CurrentPlanCard> createState() => _CurrentPlanCardState();
}

class _CurrentPlanCardState extends ConsumerState<_CurrentPlanCard> {
  bool _cancelling = false;

  Future<void> _cancel() async {
    final sub = widget.sub;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Cancel ${sub.planName}?'),
        content: Text('You keep your member benefits until ${shortDate(sub.endDate)}. Nothing is refunded.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep plan')),
          TextButton(style: TextButton.styleFrom(foregroundColor: AppColors.error), onPressed: () => Navigator.pop(c, true), child: const Text('Cancel plan')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _cancelling = true);
    try {
      final message = await ref.read(subscriptionsRepositoryProvider).cancel();
      widget.onChanged();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final sub = widget.sub;
    final white70 = Colors.white.withValues(alpha: 0.8);
    final statusLabel = sub.isTrial ? 'Free trial' : (sub.isCancelled ? 'Cancelled' : 'Active');
    return BrandHeroCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('Your membership', style: text.bodyMedium?.copyWith(color: white70)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(20)),
            child: Text(statusLabel, style: text.labelMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          const Icon(Icons.workspace_premium, color: Colors.white, size: 28),
          const SizedBox(width: 8),
          Text(sub.planName, style: text.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 8),
        Text(
          sub.isCancelled
              ? 'Benefits stay until ${shortDate(sub.endDate)}'
              : '${sub.isTrial ? 'Trial ends' : 'Valid till'} ${shortDate(sub.endDate)} · ${sub.daysLeft} day${sub.daysLeft == 1 ? '' : 's'} left',
          style: text.bodyMedium?.copyWith(color: white70),
        ),
        if (sub.plan != null && sub.plan!.benefits.isNotEmpty) ...[
          const SizedBox(height: 14),
          for (final b in sub.plan!.benefits.take(4))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                const Icon(Icons.check_circle, size: 18, color: AppColors.sky),
                const SizedBox(width: 8),
                Expanded(child: Text(b, style: text.bodyMedium?.copyWith(color: Colors.white))),
              ]),
            ),
        ],
        if (!sub.isCancelled) ...[
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              style: TextButton.styleFrom(foregroundColor: Colors.white),
              onPressed: _cancelling ? null : _cancel,
              child: Text(_cancelling ? 'Cancelling…' : 'Cancel membership'),
            ),
          ),
        ],
      ]),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.isCurrent, required this.locked, required this.onChoose});

  final Plan plan;
  final bool isCurrent;
  final bool locked; // the customer already has a plan
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: isCurrent ? AppColors.primary.withValues(alpha: 0.05) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: isCurrent ? AppColors.primary : AppColors.border, width: isCurrent ? 1.6 : 1),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(plan.name, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              if (isCurrent)
                const StatusChip('Activated plan', color: AppColors.secondary)
              else if (plan.trialAvailable)
                StatusChip('${plan.trialDays}-day free trial', color: AppColors.primary),
              const Spacer(),
              Icon(isCurrent ? Icons.check_circle : Icons.check_circle_outline, color: isCurrent ? AppColors.primary : AppColors.border),
            ]),
            const SizedBox(height: 4),
            Text.rich(TextSpan(children: [
              TextSpan(text: rupees(plan.price), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary)),
              TextSpan(text: ' ${plan.per}${plan.trialAvailable && !isCurrent ? ' after the trial' : ''}', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            ])),
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: AppColors.border)),
            for (final b in plan.benefits)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.check, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(b, style: text.bodyMedium)),
                ]),
              ),
            if (!isCurrent) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: locked
                    ? OutlinedButton(onPressed: null, child: Text('Get ${plan.name}'))
                    : FilledButton(onPressed: onChoose, child: Text(plan.trialAvailable ? 'Start free trial' : 'Get ${plan.name}')),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}

/// Confirm a plan: free trial, or pay from the wallet (with Add money when the balance is short).
class _ConfirmSheet extends ConsumerStatefulWidget {
  const _ConfirmSheet({required this.plan});

  final Plan plan;

  @override
  ConsumerState<_ConfirmSheet> createState() => _ConfirmSheetState();
}

class _ConfirmSheetState extends ConsumerState<_ConfirmSheet> {
  bool _working = false;
  String? _error;

  Future<void> _subscribe() async {
    setState(() {
      _working = true;
      _error = null;
    });
    try {
      final message = await ref.read(subscriptionsRepositoryProvider).subscribe(widget.plan.id);
      if (mounted) Navigator.pop(context, message);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _topUp(double shortfall) async {
    await context.push('/wallet/add?amount=${shortfall.ceil()}');
    refreshWallet(ref);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final plan = widget.plan;
    final balance = ref.watch(walletBalanceProvider).value;
    final trial = plan.trialAvailable;
    final shortfall = balance == null ? 0.0 : (plan.price - balance);
    final short = !trial && balance != null && shortfall > 0;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(trial ? 'Start your free trial' : 'Get ${plan.name}', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            trial
                ? '${plan.name} free for ${plan.trialDays} days. No payment now; after the trial it\'s ${rupees(plan.price)} ${plan.per} if you choose to continue.'
                : '${rupees(plan.price)} ${plan.per}, paid from your NClean wallet. No automatic renewal.',
            style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
          ),
          const SizedBox(height: 16),
          AppCard(
            color: AppColors.surfaceMuted,
            child: Column(children: [
              KeyValueRow('Plan', plan.name),
              KeyValueRow('Price', trial ? 'Free for ${plan.trialDays} days' : '${rupees(plan.price)} ${plan.per}'),
              if (!trial) KeyValueRow('Wallet balance', balance == null ? '…' : rupees(balance), valueColor: short ? AppColors.error : null),
            ]),
          ),
          if (short) ...[
            const SizedBox(height: 10),
            Text('Add ${rupees(shortfall.ceilToDouble())} to your wallet to get this plan.', style: text.bodyMedium?.copyWith(color: AppColors.error)),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: text.bodyMedium?.copyWith(color: AppColors.error)),
          ],
          const SizedBox(height: 18),
          if (short)
            PrimaryButton(label: 'Add ${rupees(shortfall.ceilToDouble())} to wallet', onPressed: () => _topUp(shortfall))
          else
            PrimaryButton(
              label: trial ? 'Start free trial' : 'Pay ${rupees(plan.price)} from wallet',
              loading: _working,
              onPressed: balance == null && !trial ? null : _subscribe,
            ),
        ]),
      ),
    );
  }
}

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget point(IconData icon, String title, String body) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(icon, size: 18, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                Text(body, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ]),
            ),
          ]),
        );
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('How membership works', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        point(Icons.shopping_bag_outlined, 'Benefits apply on their own', 'Your discount and free delivery show up at checkout on every order.'),
        point(Icons.account_balance_wallet_outlined, 'Pay from your wallet', 'Plans are paid from your NClean wallet. Add money any time.'),
        point(Icons.event_repeat_outlined, 'No surprise charges', 'Plans don\'t renew automatically. Renew here when yours ends.'),
        point(Icons.cancel_outlined, 'Cancel any time', 'Your benefits stay until the end date.'),
      ]),
    );
  }
}
