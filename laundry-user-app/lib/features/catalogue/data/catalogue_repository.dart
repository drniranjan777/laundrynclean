import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../location/data/location_repository.dart';
import 'catalogue_models.dart';

/// Categories and items, priced for the store that serves the customer's pin code (`?locationId=`).
/// Items that store doesn't offer are left out by the backend.
class CatalogueRepository {
  CatalogueRepository(this._dio, this._storeId);

  final Dio _dio;
  final String? _storeId;

  Map<String, dynamic> get _store => {'locationId': ?_storeId};

  Future<T> _get<T>(String path, T Function(dynamic data) parse, [Map<String, dynamic>? query]) async {
    try {
      final res = await _dio.get<dynamic>(path, queryParameters: {..._store, ...?query});
      return parse(unwrap<dynamic>(res));
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<List<Category>> categories() =>
      _get('/categories', (d) => (d as List).cast<Map<String, dynamic>>().map(Category.fromJson).toList());

  /// A laundry price list is short, so one page of up to 100 items is enough per category.
  Future<List<CatalogueItem>> items(String categoryId, {String? subCategoryId}) => _get(
        '/categories/$categoryId/items',
        (d) => ((d as Map)['items'] as List).cast<Map<String, dynamic>>().map(CatalogueItem.fromJson).toList(),
        {'limit': 100, 'subCategoryId': ?subCategoryId},
      );

  Future<CatalogueItem> item(String itemId) =>
      _get('/categories/items/$itemId', (d) => CatalogueItem.fromJson(d as Map<String, dynamic>));

  Future<List<CatalogueItem>> search(String query) => _get(
        '/categories/items/search',
        (d) => ((d as Map)['items'] as List).cast<Map<String, dynamic>>().map(CatalogueItem.fromJson).toList(),
        {'q': query, 'limit': 50},
      );

  Future<List<Promo>> promos() async {
    try {
      final res = await _dio.get<dynamic>('/promocodes');
      final data = unwrap<dynamic>(res);
      final list = data is List ? data : (data is Map ? (data['promoCodes'] ?? data['promos'] ?? const []) as List : const []);
      return list.cast<Map<String, dynamic>>().map(Promo.fromJson).toList();
    } catch (e) {
      throw ApiException.from(e);
    }
  }
}

final catalogueRepositoryProvider = Provider<CatalogueRepository>(
  (ref) => CatalogueRepository(ref.watch(dioProvider), ref.watch(serviceAreaProvider)?.storeId),
);

final categoriesProvider = FutureProvider<List<Category>>((ref) => ref.watch(catalogueRepositoryProvider).categories());

/// Items of a category, optionally narrowed to a sub-category: (categoryId, subCategoryId).
final categoryItemsProvider = FutureProvider.family<List<CatalogueItem>, (String, String?)>(
  (ref, key) => ref.watch(catalogueRepositoryProvider).items(key.$1, subCategoryId: key.$2),
);

final itemProvider = FutureProvider.autoDispose.family<CatalogueItem, String>(
  (ref, id) => ref.watch(catalogueRepositoryProvider).item(id),
);

final searchResultsProvider = FutureProvider.autoDispose.family<List<CatalogueItem>, String>(
  (ref, query) => query.trim().length < 2 ? Future.value(const []) : ref.watch(catalogueRepositoryProvider).search(query.trim()),
);

/// Offers are a nice-to-have on Home: a failure just hides the strip.
final promosProvider = FutureProvider<List<Promo>>((ref) async {
  try {
    return await ref.watch(catalogueRepositoryProvider).promos();
  } catch (_) {
    return const [];
  }
});
