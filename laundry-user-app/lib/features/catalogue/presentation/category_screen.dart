import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../cart/presentation/cart_bar.dart';
import '../data/catalogue_models.dart';
import '../data/catalogue_repository.dart';
import 'item_card.dart';

/// Items of one category with sub-category chips (All / Woman / Man / Kids …).
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, required this.categoryId, this.initialSubCategoryId});

  final String categoryId;
  final String? initialSubCategoryId;

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  String? _sub;

  @override
  void initState() {
    super.initState();
    _sub = widget.initialSubCategoryId;
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider).value ?? const <Category>[];
    final category = categories.where((c) => c.id == widget.categoryId).firstOrNull;
    final items = ref.watch(categoryItemsProvider((widget.categoryId, _sub)));

    return Scaffold(
      appBar: AppBar(title: Text(category?.name ?? 'Items')),
      bottomNavigationBar: const CartBar(),
      body: Column(
        children: [
          if ((category?.subCategories ?? const []).isNotEmpty)
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                children: [
                  _Chip(label: 'All', selected: _sub == null, onTap: () => setState(() => _sub = null)),
                  for (final s in category!.subCategories)
                    _Chip(label: s.name, selected: _sub == s.id, onTap: () => setState(() => _sub = s.id)),
                ],
              ),
            ),
          Expanded(
            child: items.when(
              data: (list) => list.isEmpty
                  ? const _Empty(text: 'Nothing here yet at your store.')
                  : RefreshIndicator(
                      onRefresh: () => ref.refresh(categoryItemsProvider((widget.categoryId, _sub)).future),
                      child: ItemGrid(items: list, categoryIcon: category?.icon),
                    ),
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
              error: (e, _) => _Empty(text: '$e', onRetry: () => ref.invalidate(categoryItemsProvider((widget.categoryId, _sub)))),
            ),
          ),
        ],
      ),
    );
  }
}

class ItemGrid extends StatelessWidget {
  const ItemGrid({super.key, required this.items, this.categoryIcon, this.padding = const EdgeInsets.fromLTRB(16, 4, 16, 16)});

  final List<CatalogueItem> items;
  final String? categoryIcon;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: padding,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 220,
        mainAxisExtent: 236,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) => ItemCard(item: items[i], categoryIcon: categoryIcon),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        selectedColor: AppColors.secondary,
        labelStyle: TextStyle(color: selected ? Colors.white : AppColors.text, fontWeight: FontWeight.w500),
        shape: StadiumBorder(side: BorderSide(color: selected ? AppColors.secondary : AppColors.border)),
        backgroundColor: Colors.white,
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(text, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textMuted)),
          if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Try again')),
        ]),
      ),
    );
  }
}
