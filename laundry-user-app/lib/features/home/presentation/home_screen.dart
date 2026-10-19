import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/application/session_controller.dart';
import '../../catalogue/data/catalogue_models.dart';
import '../../catalogue/data/catalogue_repository.dart';
import '../../catalogue/presentation/item_card.dart';
import '../../catalogue/presentation/item_visual.dart';
import '../../location/data/location_repository.dart';
import '../../pickup/data/pickup_repository.dart';
import '../../pickup/presentation/pickup_widgets.dart';
import '../../wallet/presentation/wallet_screen.dart';

/// Home: service area, search, offers, categories and popular items at the customer's store.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(promosProvider);
    ref.invalidate(categoryItemsProvider);
    ref.invalidate(categoriesProvider);
    ref.invalidate(pickupConfigProvider(null));
    await ref.read(categoriesProvider.future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final area = ref.watch(serviceAreaProvider);
    final categories = ref.watch(categoriesProvider);
    final promos = ref.watch(promosProvider).value ?? const <Promo>[];
    final text = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        centerTitle: false,
        toolbarHeight: 64,
        title: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => context.push(Routes.location),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.location_on, color: AppColors.primary),
            const SizedBox(width: 6),
            Flexible(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(area?.label.isNotEmpty == true ? area!.label : 'Choose location',
                    overflow: TextOverflow.ellipsis, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                if (area != null) Text(area.pincode, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ]),
            ),
            const Icon(Icons.keyboard_arrow_down),
          ]),
        ),
        actions: [
          const WalletChip(),
          Padding(padding: const EdgeInsets.fromLTRB(8, 0, 12, 0), child: Image.asset('assets/images/logo_wordmark.png', height: 26, semanticLabel: 'NClean')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: Text('Hi ${user?.firstName ?? ''}, what needs care today?', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => context.push(Routes.search),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    const Icon(Icons.search, color: AppColors.textMuted),
                    const SizedBox(width: 10),
                    Text('Search shirts, sarees, curtains…', style: text.bodyLarge?.copyWith(color: AppColors.textMuted)),
                  ]),
                ),
              ),
            ),
            if (promos.isNotEmpty) ...[
              const SizedBox(height: 16),
              SizedBox(
                height: 108,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: promos.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (_, i) => _PromoCard(promo: promos[i], index: i),
                ),
              ),
            ],
            const SizedBox(height: 20),
            _SectionTitle(title: 'Categories'),
            categories.when(
              data: (list) => _CategoryRow(categories: list),
              loading: () => const SizedBox(height: 110, child: Center(child: CircularProgressIndicator(color: AppColors.secondary))),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(20),
                child: Column(children: [Text('$e', textAlign: TextAlign.center), TextButton(onPressed: () => _refresh(ref), child: const Text('Try again'))]),
              ),
            ),
            if (categories.value?.isNotEmpty == true) _Popular(category: categories.value!.first),
            const _SchedulePickupCard(),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 8, 8),
      child: Row(children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        const Spacer(),
        ?action,
      ]),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.categories});

  final List<Category> categories;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: 118,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (_, i) {
          final c = categories[i];
          return InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => context.push('/category/${c.id}'),
            child: SizedBox(
              width: 92,
              child: Column(children: [
                ItemVisual(imageUrl: c.imageUrl, icon: c.icon, name: c.name, size: 76),
                const SizedBox(height: 8),
                Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              ]),
            ),
          );
        },
      ),
    );
  }
}

/// A few items from the first category, as a quick start.
class _Popular extends ConsumerWidget {
  const _Popular({required this.category});

  final Category category;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(categoryItemsProvider((category.id, null))).value ?? const <CatalogueItem>[];
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        _SectionTitle(
          title: 'Popular in ${category.name}',
          action: TextButton(onPressed: () => context.push('/category/${category.id}'), child: const Text('See all')),
        ),
        SizedBox(
          height: 236,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: items.length.clamp(0, 8),
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (_, i) => SizedBox(width: 168, child: ItemCard(item: items[i], categoryIcon: category.icon)),
          ),
        ),
      ],
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
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 14, 14, 14),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [AppColors.sky.withValues(alpha: 0.10), AppColors.primary.withValues(alpha: 0.08)]),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(children: [
          const BasketArt(size: 92),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Direct Schedule Pickup', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: AppColors.secondary)),
              const SizedBox(height: 4),
              Text("Bulk laundry? Choose a day and time and we'll pick it all up.", style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              const SizedBox(height: 10),
              SizedBox(
                height: 44,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: AppColors.secondary, minimumSize: const Size.fromHeight(44)),
                  onPressed: () => context.push('/pickup'),
                  icon: const Icon(Icons.local_shipping_outlined, size: 20),
                  label: const Text('Book Pickup'),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _PromoCard extends StatelessWidget {
  const _PromoCard({required this.promo, required this.index});

  final Promo promo;
  final int index;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final colors = index.isEven ? const [AppColors.secondary, AppColors.blue] : const [AppColors.primaryDark, AppColors.primary];
    return Container(
      width: 260,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(gradient: LinearGradient(colors: colors), borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(promo.headline, style: text.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
        Text(promo.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodyMedium?.copyWith(color: Colors.white)),
        const Spacer(),
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(border: Border.all(color: Colors.white70), borderRadius: BorderRadius.circular(6)),
            child: Text(promo.code, style: text.labelMedium?.copyWith(color: Colors.white, letterSpacing: 1.5, fontWeight: FontWeight.w700)),
          ),
          const Spacer(),
          if (promo.daysRemaining != null)
            Text('${promo.daysRemaining} day${promo.daysRemaining == 1 ? '' : 's'} left', style: text.bodySmall?.copyWith(color: Colors.white70)),
        ]),
      ]),
    );
  }
}
