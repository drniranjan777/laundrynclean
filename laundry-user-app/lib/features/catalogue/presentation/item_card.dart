import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../cart/application/cart_controller.dart';
import '../data/catalogue_models.dart';
import 'item_visual.dart';

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ApiException.from(error).message)));
}

/// Grid tile: picture, name, store price (with the old price struck through) and Add / − n +.
class ItemCard extends ConsumerWidget {
  const ItemCard({super.key, required this.item, this.categoryIcon});

  final CatalogueItem item;
  final String? categoryIcon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final quantity = ref.watch(cartProvider.select((c) => c.value?.quantityOf(item.id) ?? 0));
    final favorite = ref.watch(favoritesProvider.select((f) => f.value?.any((x) => x.item.id == item.id) ?? false));

    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: quantity > 0 ? AppColors.primary : AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/item/${item.id}'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item.discountPercent > 0)
                    _Badge(text: '-${item.discountPercent}%')
                  else if (item.isLimitedOffer)
                    const _Badge(text: 'Offer'),
                  const Spacer(),
                  InkResponse(
                    radius: 18,
                    onTap: () => ref.read(favoritesProvider.notifier).toggle(item.id).catchError((Object e) {
                      if (context.mounted) showError(context, e);
                    }),
                    child: Icon(favorite ? Icons.favorite : Icons.favorite_border,
                        size: 20, color: favorite ? AppColors.error : AppColors.textMuted),
                  ),
                ],
              ),
              Center(child: ItemVisual(imageUrl: item.imageUrl, icon: item.icon, name: item.name, categoryIcon: categoryIcon, size: 64)),
              const SizedBox(height: 8),
              Text(item.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
              Text(item.subCategoryName ?? item.categoryName ?? '', maxLines: 1, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(rupees(item.price), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary)),
                        if (item.wasPrice != null)
                          Text(rupees(item.wasPrice!),
                              style: text.bodySmall?.copyWith(color: AppColors.textMuted, decoration: TextDecoration.lineThrough)),
                      ],
                    ),
                  ),
                  QuantityStepper(itemId: item.id, quantity: quantity),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
    );
  }
}

/// "+" when the item isn't in the cart, else − n +. Changes the line without colour / size.
/// [alwaysShowCount] keeps "− 0 +" visible (the Home service list in the designs).
class QuantityStepper extends ConsumerStatefulWidget {
  const QuantityStepper({super.key, required this.itemId, required this.quantity, this.alwaysShowCount = false, this.color = AppColors.primary});

  final String itemId;
  final int quantity;
  final bool alwaysShowCount;
  final Color color;

  @override
  ConsumerState<QuantityStepper> createState() => _QuantityStepperState();
}

class _QuantityStepperState extends ConsumerState<QuantityStepper> {
  bool _busy = false;

  Future<void> _step(int delta) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(cartProvider.notifier).stepPlain(widget.itemId, delta);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color;
    Widget circle(IconData icon, VoidCallback? onTap, {bool filled = true}) => InkResponse(
          onTap: _busy ? null : onTap,
          radius: 20,
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: filled ? color : Colors.white,
              shape: BoxShape.circle,
              border: filled ? null : Border.all(color: AppColors.border),
            ),
            child: Icon(icon, size: 18, color: filled ? Colors.white : (onTap == null ? AppColors.border : AppColors.textMuted)),
          ),
        );

    if (widget.quantity == 0 && !widget.alwaysShowCount) return circle(Icons.add, () => _step(1));
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        circle(Icons.remove, widget.quantity == 0 ? null : () => _step(-1), filled: false),
        SizedBox(
          width: 28,
          child: _busy
              ? const Center(child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)))
              : Text('${widget.quantity}', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        circle(Icons.add, () => _step(1)),
      ],
    );
  }
}
