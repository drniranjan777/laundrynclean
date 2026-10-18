import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../location/data/location_repository.dart';
import 'cart_models.dart';

/// /cart and /cart/favorites, priced for the customer's store (`?locationId=`) until they pick an address (Phase 3).
class CartRepository {
  CartRepository(this._dio, this._storeId);

  final Dio _dio;
  final String? _storeId;

  Map<String, dynamic> get _store => {'locationId': ?_storeId};

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  /// [addressId] prices the cart for the store serving that pickup address (checkout); otherwise the chosen store.
  Future<Cart> cart({String? addressId}) => _call(() async => Cart.fromJson(unwrap<Map<String, dynamic>>(
      await _dio.get<dynamic>('/cart', queryParameters: addressId != null ? {'addressId': addressId} : _store))));

  Future<void> add(String itemId, {int quantity = 1, String? color, String? size}) => _call(() => _dio.post<dynamic>('/cart', data: {
        'itemId': itemId,
        'quantity': quantity,
        if (color != null && color.isNotEmpty) 'color': color,
        if (size != null && size.isNotEmpty) 'size': size,
      }));

  /// 0 removes the line.
  Future<void> setQuantity(String lineId, int quantity) =>
      _call(() => _dio.patch<dynamic>('/cart/$lineId/quantity', data: {'quantity': quantity}));

  Future<void> remove(String lineId) => _call(() => _dio.delete<dynamic>('/cart/$lineId'));

  Future<void> clear() => _call(() => _dio.delete<dynamic>('/cart'));

  Future<List<FavoriteItem>> favorites() => _call(() async {
        final res = await _dio.get<dynamic>('/cart/favorites', queryParameters: _store);
        return unwrap<List<dynamic>>(res)
            .cast<Map<String, dynamic>>()
            .where((f) => f['item'] != null)
            .map(FavoriteItem.fromJson)
            .toList();
      });

  Future<void> addFavorite(String itemId) => _call(() => _dio.post<dynamic>('/cart/favorites', data: {'itemId': itemId}));

  Future<void> removeFavorite(String itemId) => _call(() => _dio.delete<dynamic>('/cart/favorites/$itemId'));
}

/// The cart priced for a pickup address, for checkout.
final checkoutCartProvider = FutureProvider.autoDispose.family<Cart, String>(
  (ref, addressId) => ref.watch(cartRepositoryProvider).cart(addressId: addressId),
);

final cartRepositoryProvider = Provider<CartRepository>(
  (ref) => CartRepository(ref.watch(dioProvider), ref.watch(serviceAreaProvider)?.storeId),
);
