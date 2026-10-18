import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../auth/application/session_controller.dart';
import '../../checkout/data/razorpay_checkout.dart';
import '../data/wallet_repository.dart';

/// Add money: a custom amount (with quick picks) or a bonus package, paid with Razorpay
/// (/wallet/create-order → Checkout → /wallet/add-money). [initialPackageId] preselects an offer.
class AddMoneyScreen extends ConsumerStatefulWidget {
  const AddMoneyScreen({super.key, this.initialPackageId, this.initialAmount});

  final String? initialPackageId;
  final double? initialAmount;

  @override
  ConsumerState<AddMoneyScreen> createState() => _AddMoneyScreenState();
}

class _AddMoneyScreenState extends ConsumerState<AddMoneyScreen> {
  static const _quickAmounts = [200.0, 500.0, 1000.0, 2000.0];
  static const _maxAmount = 50000.0;

  late final _amount = TextEditingController(text: widget.initialAmount == null ? '' : widget.initialAmount!.ceil().toString());
  String? _packageId;
  bool _paying = false;

  @override
  void initState() {
    super.initState();
    _packageId = widget.initialPackageId;
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  double? get _customAmount => double.tryParse(_amount.text.trim());

  void _toast(String message) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  /// (pay, credit) for the current choice, or null when nothing valid is chosen.
  (double, double)? _choice(List<WalletPackage> packages) {
    if (_packageId != null) {
      final pkg = packages.where((p) => p.id == _packageId).firstOrNull;
      return pkg == null ? null : (pkg.payAmount, pkg.creditAmount);
    }
    final a = _customAmount;
    if (a == null || a < 1 || a > _maxAmount) return null;
    return (a, a);
  }

  Future<void> _pay(List<WalletPackage> packages) async {
    final choice = _choice(packages);
    if (choice == null) {
      final a = _customAmount;
      return _toast(a != null && a > _maxAmount ? 'You can add up to ${rupees(_maxAmount)} at a time' : 'Enter an amount of at least ₹1');
    }
    FocusScope.of(context).unfocus();
    setState(() => _paying = true);
    final repo = ref.read(walletRepositoryProvider);
    try {
      final order = await repo.createRecharge(amount: _packageId == null ? choice.$1 : null, packageId: _packageId);
      final user = ref.read(sessionProvider).user;
      final paid = await RazorpayCheckout().pay(order.payment,
          description: 'Add ${rupees(order.amountToCredit)} to wallet', name: user?.name, phone: user?.phone, email: user?.email);
      final result = await repo.addMoney(orderId: paid.orderId, paymentId: paid.paymentId, signature: paid.signature);
      refreshWallet(ref);
      if (!mounted) return;
      await showModalBottomSheet<void>(context: context, isDismissible: false, builder: (_) => _AddedSheet(result: result));
      if (mounted) context.pop(true);
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final packages = ref.watch(walletPackagesProvider).value ?? const <WalletPackage>[];
    final balance = ref.watch(walletBalanceProvider).value;
    final choice = _choice(packages);
    final supported = RazorpayCheckout.isSupported;

    return Scaffold(
      appBar: AppBar(title: const Text('Add money')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (balance != null)
            AppCard(
              color: AppColors.surfaceMuted,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                const Icon(Icons.account_balance_wallet_outlined, color: AppColors.secondary),
                const SizedBox(width: 10),
                Expanded(child: Text('Current balance', style: text.bodyMedium?.copyWith(color: AppColors.textMuted))),
                Text(rupees(balance), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              ]),
            ),
          const SizedBox(height: 20),
          Text('Enter amount', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: false),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
            style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              prefixText: '₹ ',
              prefixStyle: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.text),
              hintText: '0',
            ),
            onChanged: (_) => setState(() => _packageId = null),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final a in _quickAmounts)
              ChoiceChip(
                label: Text('+ ${rupees(a)}'),
                selected: _packageId == null && _customAmount == a,
                showCheckmark: false,
                selectedColor: AppColors.secondary,
                backgroundColor: Colors.white,
                labelStyle: TextStyle(color: _packageId == null && _customAmount == a ? Colors.white : AppColors.text),
                shape: StadiumBorder(side: BorderSide(color: _packageId == null && _customAmount == a ? AppColors.secondary : AppColors.border)),
                onSelected: (_) => setState(() {
                  _packageId = null;
                  _amount.text = a.toInt().toString();
                }),
              ),
          ]),
          if (packages.isNotEmpty) ...[
            const SizedBox(height: 26),
            Row(children: [
              Text('Recharge offers', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              const StatusChip('Extra money', color: AppColors.primary),
            ]),
            const SizedBox(height: 10),
            for (final p in packages)
              _PackageTile(
                package: p,
                selected: _packageId == p.id,
                onTap: () => setState(() {
                  _packageId = p.id;
                  _amount.clear();
                  FocusScope.of(context).unfocus();
                }),
              ),
          ],
          const SizedBox(height: 12),
          Row(children: [
            const Icon(Icons.lock_outline, size: 16, color: AppColors.textMuted),
            const SizedBox(width: 6),
            Expanded(
              child: Text('Secure payment by Razorpay: UPI, cards, net banking. Wallet money never expires and is used for orders and memberships.',
                  style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
            ),
          ]),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
        decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
        child: SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (choice != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Text('You pay ${rupees(choice.$1)}', style: text.bodyMedium),
                  const Spacer(),
                  Text('Wallet gets ${rupees(choice.$2)}', style: text.bodyMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
                ]),
              ),
            if (!supported)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text('Adding money works in the NClean app on your phone.', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ),
            PrimaryButton(
              label: choice == null ? 'Add money' : 'Pay ${rupees(choice.$1)}',
              loading: _paying,
              onPressed: supported && choice != null ? () => _pay(packages) : null,
            ),
          ]),
        ),
      ),
    );
  }
}

class _PackageTile extends StatelessWidget {
  const _PackageTile({required this.package, required this.selected, required this.onTap});

  final WalletPackage package;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected ? AppColors.primary.withValues(alpha: 0.06) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.6 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: selected ? AppColors.primary : AppColors.textMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(package.name.isEmpty ? 'Recharge offer' : package.name, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text('Pay ${rupees(package.payAmount)} · Get ${rupees(package.creditAmount)}', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                ]),
              ),
              if (package.bonus > 0) StatusChip('+${rupees(package.bonus)}', color: const Color(0xFF16A34A)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _AddedSheet extends StatelessWidget {
  const _AddedSheet({required this.result});

  final AddMoneyResult result;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(color: Color(0xFFE8F7EE), shape: BoxShape.circle),
            child: const Icon(Icons.check_rounded, size: 52, color: Color(0xFF16A34A)),
          ),
          const SizedBox(height: 16),
          Text('Money added', style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Your wallet has been topped up.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 16),
          Text(rupees(result.amountCredited), style: text.displaySmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary)),
          if (result.bonus > 0) ...[
            const SizedBox(height: 6),
            StatusChip('Includes ${rupees(result.bonus)} bonus', color: AppColors.primary),
          ],
          const SizedBox(height: 12),
          Text('New balance ${rupees(result.newBalance)}', style: text.bodyMedium),
          const SizedBox(height: 22),
          PrimaryButton(label: 'Done', onPressed: () => Navigator.pop(context)),
        ]),
      ),
    );
  }
}
