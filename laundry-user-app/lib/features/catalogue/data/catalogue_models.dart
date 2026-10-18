import '../../../core/utils/format.dart';

class SubCategory {
  const SubCategory({required this.id, required this.name, this.color});

  final String id;
  final String name;
  final String? color;

  factory SubCategory.fromJson(Map<String, dynamic> json) =>
      SubCategory(id: json['id'] as String, name: json['name'] as String? ?? '', color: json['color'] as String?);
}

class Category {
  const Category({required this.id, required this.name, this.icon, this.imageUrl, this.subCategories = const []});

  final String id;
  final String name;
  final String? icon;
  final String? imageUrl;
  final List<SubCategory> subCategories;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        icon: json['icon'] as String?,
        imageUrl: json['imageUrl'] as String?,
        subCategories: ((json['subCategories'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(SubCategory.fromJson)
            .toList(),
      );
}

/// An item as priced for the customer's store (the backend applies the store's own price).
class CatalogueItem {
  const CatalogueItem({
    required this.id,
    required this.name,
    required this.price,
    this.categoryId,
    this.subCategoryId,
    this.subCategoryName,
    this.categoryName,
    this.brand,
    this.description,
    this.imageUrl,
    this.icon,
    this.originalPrice,
    this.discountPercent = 0,
    this.colors = const [],
    this.sizes = const [],
    this.rating = 0,
    this.reviewCount = 0,
    this.isLimitedOffer = false,
  });

  final String id;
  final String name;
  final double price;
  final String? categoryId;
  final String? subCategoryId;
  final String? subCategoryName;
  final String? categoryName;
  final String? brand;
  final String? description;
  final String? imageUrl;
  final String? icon;
  final double? originalPrice;
  final int discountPercent;
  final List<String> colors;
  final List<String> sizes;
  final double rating;
  final int reviewCount;
  final bool isLimitedOffer;

  /// The struck-through price, only when it's really higher.
  double? get wasPrice => originalPrice != null && originalPrice! > price ? originalPrice : null;

  factory CatalogueItem.fromJson(Map<String, dynamic> json) {
    List<String> strings(Object? v) => (v is List) ? v.map((e) => '$e').toList() : const [];
    final original = json['originalPrice'];
    return CatalogueItem(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      price: toDouble(json['price']),
      categoryId: (json['categoryId'] ?? json['category']?['id']) as String?,
      subCategoryId: json['subCategoryId'] as String?,
      subCategoryName: json['subCategory']?['name'] as String?,
      categoryName: json['category']?['name'] as String?,
      brand: json['brand'] as String?,
      description: json['description'] as String?,
      imageUrl: json['imageUrl'] as String?,
      icon: json['icon'] as String?,
      originalPrice: original == null ? null : toDouble(original),
      discountPercent: (json['discountPercent'] as num?)?.toInt() ?? 0,
      colors: strings(json['colors']),
      sizes: strings(json['sizes']),
      rating: toDouble(json['avgRating']),
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      isLimitedOffer: json['isLimitedOffer'] == true,
    );
  }
}

/// GET /promocodes, shown as offers on Home (applied at checkout in Phase 3).
class Promo {
  const Promo({required this.code, required this.title, this.description, this.discountType, this.discountValue = 0, this.minOrderAmount, this.daysRemaining});

  final String code;
  final String title;
  final String? description;
  final String? discountType;
  final double discountValue;
  final double? minOrderAmount;
  final int? daysRemaining;

  String get headline => discountType == 'percentage' ? '${discountValue.toStringAsFixed(0)}% OFF' : '${rupees(discountValue)} OFF';

  factory Promo.fromJson(Map<String, dynamic> json) => Promo(
        code: json['code'] as String? ?? '',
        title: json['title'] as String? ?? json['code'] as String? ?? '',
        description: json['description'] as String?,
        discountType: json['discountType'] as String?,
        discountValue: toDouble(json['discountValue']),
        minOrderAmount: json['minOrderAmount'] == null ? null : toDouble(json['minOrderAmount']),
        daysRemaining: (json['daysRemaining'] as num?)?.toInt(),
      );
}
