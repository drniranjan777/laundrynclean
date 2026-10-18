import '../../../core/utils/format.dart';
import '../../catalogue/data/catalogue_models.dart';

class CartLine {
  const CartLine({
    required this.id,
    required this.itemId,
    required this.quantity,
    required this.item,
    this.color,
    this.size,
    this.isAvailable = true,
    this.lineTotal = 0,
  });

  final String id;
  final String itemId;
  final int quantity;
  final CatalogueItem item;
  final String? color;
  final String? size;
  final bool isAvailable;
  final double lineTotal;

  /// No colour or size picked: the line the + / − buttons on item cards change.
  bool get isPlain => (color ?? '').isEmpty && (size ?? '').isEmpty;

  String get options => [color, size].where((s) => s != null && s.isNotEmpty).join(' · ');

  factory CartLine.fromJson(Map<String, dynamic> json) => CartLine(
        id: json['id'] as String,
        itemId: json['itemId'] as String,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        item: CatalogueItem.fromJson(json['item'] as Map<String, dynamic>),
        color: json['color'] as String?,
        size: json['size'] as String?,
        isAvailable: json['isAvailable'] != false,
        lineTotal: toDouble(json['lineTotal']),
      );
}

/// GET /cart: lines priced for the customer's store, plus delivery fee rules.
class Cart {
  const Cart({
    this.lines = const [],
    this.totalQuantity = 0,
    this.subtotal = 0,
    this.deliveryFee = 0,
    this.total = 0,
    this.freeDeliveryThreshold = 0,
    this.minItemsFreeDelivery = 0,
    this.storeName,
    this.memberDiscount = 0,
    this.membership,
  });

  static const empty = Cart();

  final List<CartLine> lines;
  final int totalQuantity;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final double freeDeliveryThreshold;
  final int minItemsFreeDelivery;
  final String? storeName;

  /// The customer's plan discount on this cart (promo codes come on top at checkout)
  final double memberDiscount;
  final Membership? membership;

  bool get isEmpty => lines.isEmpty;

  int quantityOf(String itemId) => lines.where((l) => l.itemId == itemId).fold(0, (sum, l) => sum + l.quantity);

  CartLine? plainLineOf(String itemId) {
    for (final l in lines) {
      if (l.itemId == itemId && l.isPlain) return l;
    }
    return null;
  }

  /// "Add ₹80 more and 4 more items for free delivery", or null when delivery is already free.
  String? get freeDeliveryHint {
    if (deliveryFee <= 0 || (membership?.freeDelivery ?? false)) return null;
    final parts = <String>[
      if (subtotal < freeDeliveryThreshold) '${rupees(freeDeliveryThreshold - subtotal)} more',
      if (totalQuantity < minItemsFreeDelivery)
        '${minItemsFreeDelivery - totalQuantity} more item${minItemsFreeDelivery - totalQuantity == 1 ? '' : 's'}',
    ];
    return parts.isEmpty ? null : 'Add ${parts.join(' and ')} for free pickup & delivery';
  }

  factory Cart.fromJson(Map<String, dynamic> json) => Cart(
        lines: ((json['items'] as List?) ?? const []).cast<Map<String, dynamic>>().map(CartLine.fromJson).toList(),
        totalQuantity: (json['totalQuantity'] as num?)?.toInt() ?? 0,
        subtotal: toDouble(json['subtotal']),
        deliveryFee: toDouble(json['deliveryFee']),
        total: toDouble(json['total']),
        freeDeliveryThreshold: toDouble(json['freeDeliveryThreshold']),
        minItemsFreeDelivery: (json['minItemsFreeDelivery'] as num?)?.toInt() ?? 0,
        storeName: json['location']?['name'] as String?,
        memberDiscount: toDouble(json['memberDiscount']),
        membership: json['membership'] is Map<String, dynamic> ? Membership.fromJson(json['membership'] as Map<String, dynamic>) : null,
      );
}

/// What the customer's plan gives on orders (from the cart summary).
class Membership {
  const Membership({required this.planName, required this.discountPercent, required this.freeDelivery});

  final String planName;
  final double discountPercent;
  final bool freeDelivery;

  factory Membership.fromJson(Map<String, dynamic> json) => Membership(
        planName: json['planName'] as String? ?? 'Member',
        discountPercent: toDouble(json['discountPercent']),
        freeDelivery: json['freeDelivery'] == true,
      );
}

class FavoriteItem {
  const FavoriteItem({required this.item, required this.isAvailable});

  final CatalogueItem item;
  final bool isAvailable;

  factory FavoriteItem.fromJson(Map<String, dynamic> json) =>
      FavoriteItem(item: CatalogueItem.fromJson(json['item'] as Map<String, dynamic>), isAvailable: json['isAvailable'] != false);
}
