import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../cart/application/cart_controller.dart';
import '../../catalogue/data/catalogue_models.dart';
import '../../catalogue/data/catalogue_repository.dart';
import '../../catalogue/presentation/item_card.dart';
import '../../catalogue/presentation/item_visual.dart';
import '../../location/data/location_repository.dart';
import '../../pickup/data/pickup_repository.dart';
import '../../wallet/presentation/wallet_screen.dart';

/// Home, as in the design: logo, wallet and avatar; where we deliver; the offer banner; category tabs with
/// sub-category chips and the popular services of the chosen one; and Direct Schedule Pickup.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String? _categoryId;
  String? _subCategoryId;

  Future<void> _refresh() async {
    ref.invalidate(promosProvider);
    ref.invalidate(categoryItemsProvider);
    ref.invalidate(categoriesProvider);
    ref.invalidate(pickupConfigProvider(null));
    await ref.read(categoriesProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              const _Header(),
              const _DeliveringTo(),
              const _OfferBanner(),
              const SizedBox(height: 14),
              categories.when(
                data: (list) {
                  if (list.isEmpty) return const SizedBox.shrink();
                  final category = list.firstWhere((c) => c.id == _categoryId, orElse: () => list.first);
                  final subs = category.subCategories;
                  final sub = subs.where((s) => s.id == _subCategoryId).firstOrNull ?? subs.firstOrNull;
                  return _Catalogue(
                    categories: list,
                    category: category,
                    subCategory: sub,
                    onCategory: (c) => setState(() {
                      _categoryId = c.id;
                      _subCategoryId = null;
                    }),
                    onSubCategory: (s) => setState(() => _subCategoryId = s.id),
                  );
                },
                loading: () => const SizedBox(
                  height: 160,
                  child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Text('$e', textAlign: TextAlign.center),
                      TextButton(onPressed: _refresh, child: const Text('Try again')),
                    ],
                  ),
                ),
              ),
              const _SchedulePickupCard(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Logo (no tagline) · wallet balance with "+" · avatar
class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 16, 12),
      child: Row(
        children: [
          Flexible(
            child: Align(
              alignment: Alignment.centerLeft,
              child: Image.asset('assets/images/logo_wordmark.png', height: 34, semanticLabel: 'NClean'),
            ),
          ),
          const SizedBox(width: 8),
          const WalletChip(),
          const SizedBox(width: 10),
          const BrandAvatar(size: 42),
        ],
      ),
    );
  }
}

/// "Delivering to Bangalore 560034 ⌄ | Update"
class _DeliveringTo extends ConsumerWidget {
  const _DeliveringTo();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final area = ref.watch(serviceAreaProvider);
    final place = area == null ? 'Choose location' : [area.city ?? area.area, area.pincode].whereType<String>().where((s) => s.isNotEmpty).join(' ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: AppColors.border.withValues(alpha: 0.6)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push(Routes.location),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
            child: Row(
              children: [
                const Icon(Icons.location_on, color: AppColors.deepTeal, size: 26),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Delivering to', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              place,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          const Icon(Icons.keyboard_arrow_down, size: 20),
                        ],
                      ),
                    ],
                  ),
                ),
                Container(width: 1, height: 30, color: AppColors.border),
                TextButton(
                  onPressed: () => context.push(Routes.location),
                  child: const Text('Update', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Fresh Clothes, Better Care" banner. The pill shows the best current offer; tap to see the codes.
class _OfferBanner extends ConsumerWidget {
  const _OfferBanner();

  static String? pillText(List<Promo> promos) {
    if (promos.isEmpty) return null;
    final percents = promos.where((p) => p.discountType == 'percentage').map((p) => p.discountValue).toList();
    if (percents.isNotEmpty) return 'UP TO ${percents.reduce((a, b) => a > b ? a : b).toStringAsFixed(0)}% OFF';
    return 'SAVE UP TO ${rupees(promos.map((p) => p.discountValue).reduce((a, b) => a > b ? a : b))}';
  }

  void _showOffers(BuildContext context, List<Promo> promos) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text('Offers', style: Theme.of(c).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            Text('Apply a code at checkout.', style: Theme.of(c).textTheme.bodySmall?.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 8),
            for (final p in promos)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                  child: Text(
                    p.headline,
                    style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                ),
                title: Text(p.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  [
                    if (p.minOrderAmount != null && p.minOrderAmount! > 0) 'On orders above ${rupees(p.minOrderAmount!)}',
                    if (p.daysRemaining != null) '${p.daysRemaining} day${p.daysRemaining == 1 ? '' : 's'} left',
                  ].join(' · '),
                ),
                trailing: TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: p.code));
                    Navigator.pop(c);
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Code ${p.code} copied')));
                  },
                  icon: const Icon(Icons.copy, size: 16),
                  label: Text(p.code),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final promos = ref.watch(promosProvider).value ?? const <Promo>[];
    final pill = pillText(promos);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Material(
        color: AppColors.bannerBg,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: promos.isEmpty ? null : () => _showOffers(context, promos),
          child: LayoutBuilder(
            builder: (context, box) => SizedBox(
              height: 150,
              child: Stack(
                children: [
                  Positioned(
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: box.maxWidth * 0.5,
                    child: ShaderMask(
                      shaderCallback: (r) => const LinearGradient(colors: [Colors.transparent, Colors.white], stops: [0, 0.18]).createShader(r),
                      blendMode: BlendMode.dstIn,
                      child: Image.asset(
                        'assets/images/art_home_banner.webp',
                        fit: BoxFit.cover,
                        alignment: Alignment.centerRight,
                        excludeFromSemantics: true,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 0, 14),
                    child: FractionallySizedBox(
                      widthFactor: 0.52,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Fresh Clothes,\nBetter Care',
                              style: text.titleLarge?.copyWith(color: AppColors.secondary, fontWeight: FontWeight.w800, height: 1.15),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Professional Cleaning for a Fresher, Healthier You!',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodySmall?.copyWith(color: AppColors.text),
                          ),
                          const Spacer(),
                          if (pill != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(20)),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  pill,
                                  style: text.labelMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 0.4),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Category tabs, sub-category chips and the chosen sub-category's popular services.
class _Catalogue extends ConsumerWidget {
  const _Catalogue({
    required this.categories,
    required this.category,
    required this.subCategory,
    required this.onCategory,
    required this.onSubCategory,
  });

  final List<Category> categories;
  final Category category;
  final SubCategory? subCategory;
  final ValueChanged<Category> onCategory;
  final ValueChanged<SubCategory> onSubCategory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final items = ref.watch(categoryItemsProvider((category.id, subCategory?.id)));
    final tabWidth = (MediaQuery.sizeOf(context).width - 32) / categories.length.clamp(1, 3);
    void openCategory() => context.push('/category/${category.id}${subCategory == null ? '' : '?sub=${subCategory!.id}'}');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 46,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              for (final c in categories) _Tab(label: c.name, selected: c.id == category.id, minWidth: tabWidth, onTap: () => onCategory(c)),
            ],
          ),
        ),
        Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border.withValues(alpha: 0.6)),
        if (category.subCategories.isNotEmpty) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: category.subCategories.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final s = category.subCategories[i];
                final on = s.id == subCategory?.id;
                return Semantics(
                  selected: on,
                  button: true,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(22),
                    onTap: () => onSubCategory(s),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 160),
                      constraints: const BoxConstraints(minWidth: 84),
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: on ? AppColors.deepTeal : AppColors.peach, borderRadius: BorderRadius.circular(22)),
                      child: Text(
                        s.name,
                        style: text.titleSmall?.copyWith(color: on ? Colors.white : AppColors.text, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 4, 2),
          child: Row(
            children: [
              Expanded(
                child: Text('Popular Services', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              ),
              IconButton(
                tooltip: 'Search',
                onPressed: () => context.push(Routes.search),
                icon: const Icon(Icons.search, color: AppColors.secondary),
              ),
              TextButton(
                onPressed: openCategory,
                child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('See all'), Icon(Icons.chevron_right, size: 20)]),
              ),
            ],
          ),
        ),
        items.when(
          skipLoadingOnRefresh: true,
          loading: () => const SizedBox(
            height: 120,
            child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(20),
            child: Text('$e', textAlign: TextAlign.center),
          ),
          data: (list) {
            if (list.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Text('Nothing here at your store yet.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
              );
            }
            return Column(
              children: [
                for (final item in list.take(4)) _ServiceRow(item: item, categoryIcon: category.icon),
                const SizedBox(height: 10),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.deepTeal, minimumSize: const Size(200, 46)),
                  onPressed: openCategory,
                  child: const Text('See More'),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.label, required this.selected, required this.minWidth, required this.onTap});

  final String label;
  final bool selected;
  final double minWidth;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minWidth: minWidth),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: selected ? AppColors.blue : Colors.transparent, width: 3)),
          ),
          child: Text(
            label,
            style: text.titleMedium?.copyWith(
              color: selected ? AppColors.primary : AppColors.textMuted,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

/// One service: picture, name, a short line, store price (old price struck through), discount and − n +.
class _ServiceRow extends ConsumerWidget {
  const _ServiceRow({required this.item, this.categoryIcon});

  final CatalogueItem item;
  final String? categoryIcon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final quantity = ref.watch(cartProvider.select((c) => c.value?.quantityOf(item.id) ?? 0));
    final description = (item.description ?? '').trim();
    final line = item.isLimitedOffer
        ? 'Limited Time Offer'
        : (description.isNotEmpty ? description.split('\n').first : (item.subCategoryName ?? item.categoryName ?? ''));
    final price = item.price % 1 == 0 ? '${item.price.toInt()}' : item.price.toStringAsFixed(2);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: quantity > 0 ? AppColors.primary : AppColors.border.withValues(alpha: 0.5)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/item/${item.id}'),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                ItemVisual(imageUrl: item.imageUrl, icon: item.icon, name: item.name, categoryIcon: categoryIcon, size: 88),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          if (item.discountPercent > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(8)),
                              child: Text(
                                '-${item.discountPercent}%',
                                style: text.labelSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                              ),
                            ),
                        ],
                      ),
                      if (line.isNotEmpty)
                        Text(
                          line,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(color: AppColors.textMuted),
                        ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    '₹ $price',
                                    style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: AppColors.text),
                                  ),
                                  if (item.wasPrice != null) ...[
                                    const SizedBox(width: 6),
                                    Text(
                                      rupees(item.wasPrice!),
                                      style: text.bodySmall?.copyWith(color: AppColors.textMuted, decoration: TextDecoration.lineThrough),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          QuantityStepper(itemId: item.id, quantity: quantity, alwaysShowCount: true, color: AppColors.deepTeal),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Direct Schedule Pickup" for bulk orders; shown only while the admin has Schedule Pickup switched on.
class _SchedulePickupCard extends ConsumerWidget {
  const _SchedulePickupCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(pickupConfigProvider(null)).value;
    if (config == null || !config.available) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.fromLTRB(8, 12, 14, 14),
        decoration: BoxDecoration(color: AppColors.tealTint, borderRadius: BorderRadius.circular(18)),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.asset('assets/images/art_basket_home.webp', width: 104, fit: BoxFit.contain, excludeFromSemantics: true),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Direct Schedule Pickup',
                      style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: AppColors.secondary),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('Schedule your pickup instantly. Choose a time that works for you!', style: text.bodySmall?.copyWith(color: AppColors.text)),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: AppColors.deepTeal, minimumSize: const Size.fromHeight(44)),
                    onPressed: () => context.push('/pickup'),
                    icon: const Icon(Icons.local_shipping_outlined, size: 20),
                    label: const Text('Book Pickup'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
