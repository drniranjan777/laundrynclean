import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/theme/app_theme.dart';
import 'package:istreecare_user/features/auth/application/session_controller.dart';
import 'package:istreecare_user/features/auth/data/auth_models.dart';
import 'package:istreecare_user/features/cart/application/cart_controller.dart';
import 'package:istreecare_user/features/cart/data/cart_models.dart';
import 'package:istreecare_user/features/catalogue/data/catalogue_models.dart';
import 'package:istreecare_user/features/catalogue/data/catalogue_repository.dart';
import 'package:istreecare_user/features/home/presentation/home_screen.dart';
import 'package:istreecare_user/features/location/data/location_models.dart';
import 'package:istreecare_user/features/location/data/location_repository.dart';
import 'package:istreecare_user/features/pickup/data/pickup_repository.dart';
import 'package:istreecare_user/features/wallet/data/wallet_repository.dart';

class _Session extends SessionController {
  @override
  SessionState build() => const SessionState.signedIn(AppUser(id: 'u1', phone: '9876543210', role: 'customer', name: 'Asha Rao'));
}

class _Area extends ServiceAreaController {
  @override
  ServiceArea? build() => const ServiceArea(pincode: '500039', area: 'Uppal', city: 'Hyderabad', storeId: 's1', storeName: 'Main Store');
}

class _Cart extends CartController {
  @override
  Future<Cart> build() async => Cart.fromJson({'items': [], 'totalQuantity': 0, 'subtotal': 0, 'deliveryFee': 0, 'total': 0});
}

final _garment = Category.fromJson({
  'id': 'c1',
  'name': 'Garment',
  'subCategories': [
    {'id': 'w', 'name': 'Woman'},
    {'id': 'm', 'name': 'Man'},
    {'id': 'k', 'name': 'Kids'},
    {'id': 's', 'name': 'Saree'},
  ],
});

List<CatalogueItem> _items(String? sub) => [
      CatalogueItem.fromJson({'id': 'i1', 'name': 'Blazers', 'price': '120', 'originalPrice': '150', 'discountPercent': 20, 'isLimitedOffer': true, 'subCategory': {'name': sub}}),
      CatalogueItem.fromJson({'id': 'i2', 'name': 'Pants', 'price': '50', 'description': 'Clean & Fresh'}),
      CatalogueItem.fromJson({'id': 'i3', 'name': 'T-shirt', 'price': '50', 'description': 'Everyday Freshness'}),
      CatalogueItem.fromJson({'id': 'i4', 'name': 'Shirt', 'price': '50', 'description': 'Crisp & Clean'}),
      CatalogueItem.fromJson({'id': 'i5', 'name': 'Kurta', 'price': '60'}),
    ];

List _overrides({bool pickupOn = true, List<String?>? asked}) => [
      sessionProvider.overrideWith(_Session.new),
      serviceAreaProvider.overrideWith(_Area.new),
      cartProvider.overrideWith(_Cart.new),
      walletBalanceProvider.overrideWith((ref) async => 500),
      categoriesProvider.overrideWith((ref) async => [
            _garment,
            Category.fromJson({'id': 'c2', 'name': 'Bedsheets'}),
            Category.fromJson({'id': 'c3', 'name': 'Curtains'}),
          ]),
      categoryItemsProvider.overrideWith((ref, key) async {
        asked?.add(key.$2);
        return _items(key.$2);
      }),
      promosProvider.overrideWith((ref) async => [Promo.fromJson({'code': 'FRESH20', 'title': 'Festive', 'discountType': 'percentage', 'discountValue': '20'})]),
      pickupConfigProvider.overrideWith((ref, id) async => PickupConfig.fromJson({
            'enabled': pickupOn,
            'bulkEnabled': true,
            'charges': {'freeAbove': 250, 'charge': 50, 'deliveryCharge': 50, 'pickupCharge': 0},
          })),
    ];

final _page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;

void main() {
  for (final size in const [Size(320, 640), Size(390, 844), Size(430, 932)]) {
    testWidgets('home at ${size.width.toInt()}×${size.height.toInt()}: header, banner, tabs, chips, services, pickup', (tester) async {
      tester.view.physicalSize = size * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(overrides: [..._overrides()], child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const HomeScreen())));
      await tester.pumpAndSettle();

      expect(find.text('₹ 500.00'), findsOneWidget); // wallet chip
      expect(find.text('AR'), findsOneWidget); // avatar initials
      expect(find.text('Delivering to'), findsOneWidget);
      expect(find.text('Hyderabad 500039'), findsOneWidget);
      expect(find.text('Fresh Clothes,\nBetter Care'), findsOneWidget);
      expect(find.text('UP TO 20% OFF'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Woman'), 200, scrollable: _page);
      expect(find.text('Garment'), findsOneWidget);
      expect(find.text('Bedsheets'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Blazers'), 200, scrollable: _page);
      expect(find.text('Popular Services'), findsOneWidget);
      expect(find.text('Limited Time Offer'), findsOneWidget);
      expect(find.text('-20%'), findsOneWidget);
      expect(find.text('₹150'), findsOneWidget); // old price
      await tester.scrollUntilVisible(find.text('See More'), 200, scrollable: _page);
      expect(find.text('Kurta'), findsNothing); // four services, then See More
      await tester.scrollUntilVisible(find.text('Book Pickup'), 200, scrollable: _page);
      expect(find.text('Direct Schedule Pickup'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('choosing another sub-category reloads its services; pickup card hidden when switched off', (tester) async {
    final asked = <String?>[];
    await tester.pumpWidget(ProviderScope(
      overrides: [..._overrides(pickupOn: false, asked: asked)],
      child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const HomeScreen()),
    ));
    await tester.pumpAndSettle();
    expect(asked, ['w']); // the first sub-category is chosen
    await tester.scrollUntilVisible(find.text('Man'), 200, scrollable: _page);
    await tester.tap(find.text('Man'));
    await tester.pumpAndSettle();
    expect(asked.last, 'm');
    await tester.scrollUntilVisible(find.text('See More'), 300, scrollable: _page);
    expect(find.text('Book Pickup'), findsNothing);
  });
}
