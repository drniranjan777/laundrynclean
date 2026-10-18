import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/utils/format.dart';
import 'package:istreecare_user/features/cart/data/cart_models.dart';
import 'package:istreecare_user/features/catalogue/data/catalogue_models.dart';
import 'package:istreecare_user/features/catalogue/presentation/item_visual.dart';

Map<String, dynamic> line(String id, String itemId, int qty, {String? color, double price = 50}) => {
      'id': id,
      'itemId': itemId,
      'quantity': qty,
      'color': color,
      'lineTotal': price * qty,
      'isAvailable': true,
      'item': {'id': itemId, 'name': 'Shirt', 'price': price.toStringAsFixed(2), 'icon': null},
    };

void main() {
  test('rupees formatting', () {
    expect(rupees(120), '₹120');
    expect(rupees(99.5), '₹99.50');
  });

  test('item parses store price and only shows a higher old price', () {
    final item = CatalogueItem.fromJson({
      'id': 'i1', 'name': 'Blazers', 'price': '120.00', 'originalPrice': '150.00', 'discountPercent': 20,
      'colors': ['Black', 'Navy'], 'sizes': ['S'], 'avgRating': '4.5', 'reviewCount': 2,
      'subCategory': {'id': 's1', 'name': 'Woman'}, 'icon': 'jacket',
    });
    expect(item.price, 120);
    expect(item.wasPrice, 150);
    expect(item.subCategoryName, 'Woman');
    expect(item.colors, ['Black', 'Navy']);
    expect(CatalogueItem.fromJson({'id': 'i2', 'name': 'X', 'price': '90', 'originalPrice': '90'}).wasPrice, isNull);
  });

  test('cart totals, quantities and the free delivery hint', () {
    final cart = Cart.fromJson({
      'items': [line('l1', 'shirt', 2), line('l2', 'shirt', 1, color: 'Blue'), line('l3', 'pants', 1)],
      'totalQuantity': 4,
      'subtotal': 200,
      'deliveryFee': 50,
      'total': 250,
      'freeDeliveryThreshold': 250,
      'minItemsFreeDelivery': 10,
      'location': {'name': 'Main Store'},
    });
    expect(cart.quantityOf('shirt'), 3);
    expect(cart.plainLineOf('shirt')!.id, 'l1');
    expect(cart.lines[1].options, 'Blue');
    expect(cart.storeName, 'Main Store');
    expect(cart.freeDeliveryHint, 'Add ₹50 more and 6 more items for free pickup & delivery');

    final free = Cart.fromJson({'items': [line('l1', 'a', 12)], 'totalQuantity': 12, 'subtotal': 600, 'deliveryFee': 0});
    expect(free.freeDeliveryHint, isNull);
  });

  test('promo headline', () {
    expect(Promo.fromJson({'code': 'FIRST20', 'title': 'First order', 'discountType': 'percentage', 'discountValue': '20'}).headline, '20% OFF');
    expect(Promo.fromJson({'code': 'FLAT50', 'title': 'Flat', 'discountType': 'flat', 'discountValue': 50}).headline, '₹50 OFF');
  });

  test('icon name rules match the admin panel', () {
    expect(iconKeyForName('T-Shirt'), 'tshirt');
    expect(iconKeyForName('Sweatshirt'), 'hoodie');
    expect(iconKeyForName('Knitwear'), 'sweater');
    expect(iconKeyForName('Door Curtain'), 'door-curtain');
    expect(iconKeyForName('Double Bedsheet'), 'double-bed');
    expect(iconKeyForName('Silk Saree'), 'saree');
    expect(iconKeyForName('Laptop bag'), 'bag');
    expect(iconKeyForName('Something else'), isNull);
  });

  test('media urls', () {
    expect(mediaUrl(null), isNull);
    expect(mediaUrl('https://cdn.x/a.png'), 'https://cdn.x/a.png');
    expect(mediaUrl('/uploads/a.png'), endsWith('/uploads/a.png'));
    // Uploads sit next to the API, keeping any path prefix the server is hosted under
    expect(mediaUrl('/uploads/a.png', apiBaseUrl: 'https://tallygen.com/nclean/api/v1'), 'https://tallygen.com/nclean/uploads/a.png');
    expect(mediaUrl('uploads/a.png', apiBaseUrl: 'http://10.0.2.2:5002/api/v1'), 'http://10.0.2.2:5002/uploads/a.png');
    expect(mediaUrl('/uploads/a.png', apiBaseUrl: '/api/v1'), '/uploads/a.png');
  });
}
