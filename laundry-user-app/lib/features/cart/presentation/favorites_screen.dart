import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../catalogue/presentation/category_screen.dart';
import '../application/cart_controller.dart';

/// Hearted items, priced for the customer's store.
class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favorites = ref.watch(favoritesProvider);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Favourites')),
      body: favorites.when(
        data: (list) {
          final offered = list.where((f) => f.isAvailable).map((f) => f.item).toList();
          if (offered.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.favorite_border, size: 64, color: AppColors.primary),
                  const SizedBox(height: 12),
                  Text('No favourites yet', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Text('Tap the heart on items you book often.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                ]),
              ),
            );
          }
          return RefreshIndicator(onRefresh: () => ref.refresh(favoritesProvider.future), child: ItemGrid(items: offered, padding: const EdgeInsets.all(16)));
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
        error: (e, _) => Center(child: TextButton(onPressed: () => ref.invalidate(favoritesProvider), child: Text('$e — try again'))),
      ),
    );
  }
}
