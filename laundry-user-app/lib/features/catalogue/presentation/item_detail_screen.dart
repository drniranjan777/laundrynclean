import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/primary_button.dart';
import '../../cart/application/cart_controller.dart';
import '../../cart/presentation/cart_bar.dart';
import '../data/catalogue_models.dart';
import '../data/catalogue_repository.dart';
import 'item_card.dart';
import 'item_visual.dart';

/// One item: store price, colour / size (optional, helps match clothes on return), quantity, add to cart.
class ItemDetailScreen extends ConsumerWidget {
  const ItemDetailScreen({super.key, required this.itemId});

  final String itemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final item = ref.watch(itemProvider(itemId));
    return item.when(
      data: (i) => _ItemDetail(item: i),
      loading: () => Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator(color: AppColors.secondary))),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('$e', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
          ),
        ),
      ),
    );
  }
}

class _ItemDetail extends ConsumerStatefulWidget {
  const _ItemDetail({required this.item});

  final CatalogueItem item;

  @override
  ConsumerState<_ItemDetail> createState() => _ItemDetailState();
}

class _ItemDetailState extends ConsumerState<_ItemDetail> {
  String? _color;
  String? _size;
  int _quantity = 1;
  bool _adding = false;

  Future<void> _add() async {
    setState(() => _adding = true);
    try {
      await ref.read(cartProvider.notifier).add(widget.item.id, quantity: _quantity, color: _color, size: _size);
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text('Added $_quantity × ${widget.item.name}')));
      }
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final text = Theme.of(context).textTheme;
    final favorite = ref.watch(favoritesProvider.select((f) => f.value?.any((x) => x.item.id == item.id) ?? false));
    final inCart = ref.watch(cartProvider.select((c) => c.value?.quantityOf(item.id) ?? 0));

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            tooltip: favorite ? 'Remove from favourites' : 'Add to favourites',
            onPressed: () => ref.read(favoritesProvider.notifier).toggle(item.id).catchError((Object e) {
              if (context.mounted) showError(context, e);
            }),
            icon: Icon(favorite ? Icons.favorite : Icons.favorite_border, color: favorite ? AppColors.error : null),
          ),
        ],
      ),
      bottomNavigationBar: const CartBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Center(child: ItemVisual(imageUrl: item.imageUrl, icon: item.icon, name: item.name, size: 140)),
          const SizedBox(height: 20),
          Text(item.name, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Row(children: [
            if (item.subCategoryName != null || item.categoryName != null)
              Text([item.categoryName, item.subCategoryName].whereType<String>().join(' · '),
                  style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            if (item.reviewCount > 0) ...[
              const SizedBox(width: 12),
              const Icon(Icons.star_rounded, size: 18, color: Color(0xFFF5B301)),
              Text(' ${item.rating.toStringAsFixed(1)} (${item.reviewCount})', style: text.bodyMedium),
            ],
          ]),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(rupees(item.price), style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary)),
              const SizedBox(width: 10),
              if (item.wasPrice != null)
                Text(rupees(item.wasPrice!),
                    style: text.titleMedium?.copyWith(color: AppColors.textMuted, decoration: TextDecoration.lineThrough)),
              if (item.discountPercent > 0) ...[
                const SizedBox(width: 8),
                Text('${item.discountPercent}% off', style: text.titleSmall?.copyWith(color: const Color(0xFF16A34A))),
              ],
            ],
          ),
          Text('per piece, at your store', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
          if ((item.description ?? '').isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(item.description!, style: text.bodyLarge?.copyWith(height: 1.4)),
          ],
          if (item.colors.isNotEmpty) ...[
            const SizedBox(height: 20),
            _Options(title: 'Colour (optional)', options: item.colors, selected: _color, onSelect: (v) => setState(() => _color = v)),
          ],
          if (item.sizes.isNotEmpty) ...[
            const SizedBox(height: 16),
            _Options(title: 'Size (optional)', options: item.sizes, selected: _size, onSelect: (v) => setState(() => _size = v)),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              Text('Quantity', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
              const Spacer(),
              IconButton.outlined(onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null, icon: const Icon(Icons.remove)),
              SizedBox(width: 44, child: Text('$_quantity', textAlign: TextAlign.center, style: text.titleMedium)),
              IconButton.outlined(onPressed: () => setState(() => _quantity++), icon: const Icon(Icons.add)),
            ],
          ),
          const SizedBox(height: 24),
          PrimaryButton(label: 'Add to cart  ·  ${rupees(item.price * _quantity)}', loading: _adding, onPressed: _add),
          if (inCart > 0) ...[
            const SizedBox(height: 10),
            Text('$inCart in your cart', textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          ],
        ],
      ),
    );
  }
}

class _Options extends StatelessWidget {
  const _Options({required this.title, required this.options, required this.selected, required this.onSelect});

  final String title;
  final List<String> options;
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final o in options)
              ChoiceChip(
                label: Text(o),
                selected: selected == o,
                showCheckmark: false,
                selectedColor: AppColors.secondary,
                backgroundColor: Colors.white,
                labelStyle: TextStyle(color: selected == o ? Colors.white : AppColors.text),
                shape: StadiumBorder(side: BorderSide(color: selected == o ? AppColors.secondary : AppColors.border)),
                onSelected: (on) => onSelect(on ? o : null),
              ),
          ],
        ),
      ],
    );
  }
}
