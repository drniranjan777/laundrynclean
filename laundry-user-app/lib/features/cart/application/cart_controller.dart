import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/session_controller.dart';
import '../data/cart_models.dart';
import '../data/cart_repository.dart';

/// The server-side cart. Every change goes to the API and the cart is re-read, so totals and
/// delivery fee always come from the backend. Errors are thrown for the screen to show.
class CartController extends AsyncNotifier<Cart> {
  @override
  Future<Cart> build() async {
    // Signed out (or store changed): start again
    if (!ref.watch(sessionProvider.select((s) => s.isSignedIn))) return Cart.empty;
    return ref.watch(cartRepositoryProvider).cart();
  }

  CartRepository get _repo => ref.read(cartRepositoryProvider);

  Future<void> _then(Future<void> Function() change) async {
    await change();
    state = AsyncData(await _repo.cart());
  }

  Future<void> add(String itemId, {int quantity = 1, String? color, String? size}) =>
      _then(() => _repo.add(itemId, quantity: quantity, color: color, size: size));

  Future<void> setQuantity(String lineId, int quantity) => _then(() => _repo.setQuantity(lineId, quantity));

  /// + / − on an item card: changes the line without colour or size, creating it when needed.
  Future<void> stepPlain(String itemId, int delta) {
    final line = state.value?.plainLineOf(itemId);
    if (line == null) return delta > 0 ? add(itemId) : Future.value();
    return setQuantity(line.id, line.quantity + delta);
  }

  Future<void> remove(String lineId) => _then(() => _repo.remove(lineId));

  Future<void> clear() => _then(_repo.clear);
}

final cartProvider = AsyncNotifierProvider<CartController, Cart>(CartController.new);

/// Ids of favourite items, for the heart buttons.
class FavoritesController extends AsyncNotifier<List<FavoriteItem>> {
  @override
  Future<List<FavoriteItem>> build() async {
    if (!ref.watch(sessionProvider.select((s) => s.isSignedIn))) return const [];
    return ref.watch(cartRepositoryProvider).favorites();
  }

  bool contains(String itemId) => state.value?.any((f) => f.item.id == itemId) ?? false;

  Future<void> toggle(String itemId) async {
    final repo = ref.read(cartRepositoryProvider);
    contains(itemId) ? await repo.removeFavorite(itemId) : await repo.addFavorite(itemId);
    state = AsyncData(await repo.favorites());
  }
}

final favoritesProvider = AsyncNotifierProvider<FavoritesController, List<FavoriteItem>>(FavoritesController.new);
