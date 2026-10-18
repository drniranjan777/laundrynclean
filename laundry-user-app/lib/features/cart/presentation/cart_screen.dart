import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/primary_button.dart';
import '../../catalogue/presentation/item_card.dart';
import '../../catalogue/presentation/item_visual.dart';
import '../application/cart_controller.dart';
import '../data/cart_models.dart';

/// The cart, priced by the backend for the customer's store, with the delivery-fee rule spelled out.
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Cart'),
        actions: [
          if (cart.value?.isEmpty == false)
            TextButton(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (c) => AlertDialog(
                    title: const Text('Empty your cart?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                      TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Empty cart')),
                    ],
                  ),
                );
                if (ok == true) await ref.read(cartProvider.notifier).clear().catchError((Object e) => context.mounted ? showError(context, e) : null);
              },
              child: const Text('Clear'),
            ),
        ],
      ),
      body: cart.when(
        data: (c) => c.isEmpty ? const _EmptyCart() : _CartBody(cart: c),
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
        error: (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('$e', textAlign: TextAlign.center),
            TextButton(onPressed: () => ref.invalidate(cartProvider), child: const Text('Try again')),
          ]),
        ),
      ),
    );
  }
}

class _CartBody extends ConsumerWidget {
  const _CartBody({required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final unavailable = cart.lines.where((l) => !l.isAvailable).length;
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(cartProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (cart.storeName != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text('Prices from ${cart.storeName}', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                  ),
                for (final line in cart.lines) _CartLineTile(line: line),
                if (unavailable > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('$unavailable item${unavailable == 1 ? ' isn\'t' : 's aren\'t'} offered by your store and won\'t be booked.',
                        style: text.bodySmall?.copyWith(color: AppColors.error)),
                  ),
                if (cart.freeDeliveryHint != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      const Icon(Icons.local_shipping_outlined, color: AppColors.secondary),
                      const SizedBox(width: 10),
                      Expanded(child: Text(cart.freeDeliveryHint!, style: text.bodyMedium)),
                    ]),
                  ),
                ],
              ],
            ),
          ),
        ),
        _Totals(cart: cart),
      ],
    );
  }
}

class _CartLineTile extends ConsumerStatefulWidget {
  const _CartLineTile({required this.line});

  final CartLine line;

  @override
  ConsumerState<_CartLineTile> createState() => _CartLineTileState();
}

class _CartLineTileState extends ConsumerState<_CartLineTile> {
  bool _busy = false;

  Future<void> _set(int quantity) async {
    setState(() => _busy = true);
    try {
      await ref.read(cartProvider.notifier).setQuantity(widget.line.id, quantity);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final line = widget.line;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Opacity(
        opacity: line.isAvailable ? 1 : 0.5,
        child: Row(
          children: [
            ItemVisual(imageUrl: line.item.imageUrl, icon: line.item.icon, name: line.item.name, size: 56),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(line.item.name, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                  if (line.options.isNotEmpty) Text(line.options, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                  Text(line.isAvailable ? '${rupees(line.item.price)} each' : 'Not offered by your store',
                      style: text.bodySmall?.copyWith(color: line.isAvailable ? AppColors.textMuted : AppColors.error)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(rupees(line.lineTotal), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  _RoundIcon(icon: line.quantity == 1 ? Icons.delete_outline : Icons.remove, onTap: _busy ? null : () => _set(line.quantity - 1)),
                  SizedBox(width: 30, child: Text('${line.quantity}', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700))),
                  _RoundIcon(icon: Icons.add, onTap: _busy || !line.isAvailable ? null : () => _set(line.quantity + 1), filled: true),
                ]),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.onTap, this.filled = false});

  final IconData icon;
  final VoidCallback? onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 18,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled ? AppColors.primary : Colors.white,
          border: filled ? null : Border.all(color: AppColors.primary),
        ),
        child: Icon(icon, size: 16, color: filled ? Colors.white : AppColors.primary),
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget row(String label, String value, {bool bold = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [
            Text(label, style: bold ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700) : text.bodyLarge),
            const Spacer(),
            Text(value, style: bold ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700) : text.bodyLarge),
          ]),
        );
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            row('Subtotal (${cart.totalQuantity} item${cart.totalQuantity == 1 ? '' : 's'})', rupees(cart.subtotal)),
            row('Pickup & delivery', cart.deliveryFee == 0 ? 'Free' : rupees(cart.deliveryFee)),
            const Divider(height: 18),
            row('Total', rupees(cart.total), bold: true),
            Text('GST and offers are added when you book.', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 12),
            PrimaryButton(label: 'Schedule pickup', onPressed: () => context.push('/checkout')),
          ],
        ),
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.shopping_bag_outlined, size: 72, color: AppColors.primary),
          const SizedBox(height: 12),
          Text('Your cart is empty', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text('Add the clothes you want ironed or cleaned.', textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 20),
          SizedBox(width: 220, child: FilledButton(onPressed: () => context.go(Routes.home), child: const Text('Browse items'))),
        ]),
      ),
    );
  }
}
