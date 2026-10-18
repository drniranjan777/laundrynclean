import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/theme/app_theme.dart';
import 'package:istreecare_user/core/widgets/ui_kit.dart';
import 'package:istreecare_user/features/cart/data/cart_models.dart';
import 'package:istreecare_user/features/orders/data/orders_repository.dart';
import 'package:istreecare_user/features/orders/presentation/order_detail_screen.dart';
import 'package:istreecare_user/features/subscriptions/data/subscriptions_repository.dart';
import 'package:istreecare_user/features/subscriptions/presentation/subscriptions_screen.dart';
import 'package:istreecare_user/features/wallet/data/wallet_repository.dart';
import 'package:istreecare_user/features/wallet/presentation/wallet_screen.dart';

Map<String, dynamic> _orderJson({String status = 'picked_up', List<Map<String, dynamic>>? timeline}) => {
      'id': 'b1',
      'orderNumber': '0012',
      'status': status,
      'orderType': 'online',
      'paymentMethod': 'wallet',
      'paymentStatus': 'paid',
      'subtotal': '600.00',
      'discount': '60.00',
      'deliveryFee': '0.00',
      'gstAmount': '0.00',
      'total': '540.00',
      'pickupDate': '2026-10-19',
      'timeSlot': {'label': '08:00 AM - 10:00 AM'},
      'location': {'id': 's1', 'name': 'Main Store', 'phone': '9000000000'},
      'created_at': '2026-10-18T10:00:00.000Z',
      'estimatedDeliveryDate': '2026-10-21',
      'items': [
        {'itemId': 'i1', 'name': 'Shirt', 'quantity': 2, 'price': '100.00', 'lineTotal': '200.00', 'color': 'White'},
        {'itemId': null, 'name': 'Custom sherwani', 'quantity': 1, 'price': '400.00', 'lineTotal': '400.00'},
      ],
      'address': {'fullName': 'Asha', 'phone': '9876543210', 'addressLine': '12 MG Road', 'city': 'Hyderabad', 'pincode': '500039', 'label': 'Home'},
      'timeline': timeline ?? const [],
    };

Widget _app(Widget child, List overrides) => ProviderScope(
      overrides: [...overrides],
      child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: child),
    );

class _FakeHistory extends WalletHistoryController {
  @override
  Future<TxnPage> build() async => TxnPage(page: 1, totalPages: 1, items: [
        WalletTxn.fromJson({
          'id': 't1', 'type': 'credit', 'amount': '500.00', 'balanceAfter': '500.00', 'description': 'Wallet recharge of ₹500',
          'referenceType': 'recharge', 'created_at': '2026-10-18T09:20:00.000Z',
        }),
        WalletTxn.fromJson({
          'id': 't2', 'type': 'debit', 'amount': '250.00', 'balanceAfter': '250.00', 'description': 'Starter plan subscription',
          'referenceType': 'subscription', 'created_at': '2026-10-18T09:30:00.000Z',
        }),
      ]);
}

void main() {
  group('models', () {
    test('wallet summary, history lines and packages', () {
      final s = WalletSummary.fromJson({'balance': '250.00', 'totalCredited': '500.00', 'totalDebited': 250});
      expect(s.balance, 250);
      expect(s.totalDebited, 250);

      final t = WalletTxn.fromJson({'id': 'x', 'type': 'debit', 'amount': '410', 'balanceAfter': '90', 'referenceType': 'order_payment', 'description': 'Payment for order #0012'});
      expect(t.isCredit, isFalse);
      expect(t.title, 'Order payment');
      expect(WalletTxn.fromJson({'id': 'y', 'type': 'credit', 'amount': 1, 'balanceAfter': 1, 'referenceType': 'refund'}).title, 'Refund');

      final p = WalletPackage.fromJson({'id': 'p1', 'name': 'Value Pack', 'payAmount': '500.00', 'creditAmount': '600.00'});
      expect(p.bonus, 100);
    });

    test('order detail with timeline, actions and payment label', () {
      final o = Order.fromJson(_orderJson(timeline: [
        {'type': 'driver_assigned', 'status': 'pickup_scheduled', 'reason': null, 'at': '2026-10-18T11:00:00.000Z'},
        {'type': 'pickup_failed', 'status': null, 'reason': 'Customer not available', 'at': '2026-10-19T08:30:00.000Z'},
        {'type': 'status', 'status': 'picked_up', 'reason': null, 'at': '2026-10-19T09:10:00.000Z'},
      ]));
      expect(o.status, OrderStatus.pickedUp);
      expect(o.itemCount, 3);
      expect(o.slot, '08:00 AM - 10:00 AM');
      expect(o.storePhone, '9000000000');
      expect(o.address!.lines, '12 MG Road, Hyderabad, 500039');
      expect(o.timeline, hasLength(3));
      expect(o.timeline[1].isFailure, isTrue);
      expect(o.canCancel, isFalse); // already picked up
      expect(o.reorderable.map((l) => l.name), ['Shirt']); // custom store items can't go back in the cart
      expect(o.paymentLabel, 'NClean wallet · Paid');

      final fresh = Order.fromJson({..._orderJson(status: 'confirmed'), 'paymentMethod': 'cod', 'paymentStatus': 'pending', 'timeSlot': '10:00 AM - 12:00 PM'});
      expect(fresh.canCancel, isTrue);
      expect(fresh.slot, '10:00 AM - 12:00 PM');
      expect(fresh.paymentLabel, 'Cash on delivery · Pay on delivery');
      expect(Order.fromJson({..._orderJson(status: 'confirmed'), 'orderType': 'offline'}).canCancel, isFalse); // store orders
    });

    test('plans, trial and my subscription', () {
      final plan = Plan.fromJson({
        'id': 'p1', 'name': 'Basic', 'price': '150.00', 'durationType': 'month', 'duration': 30, 'features': [],
        'freeDelivery': true, 'discountPercent': '5.00', 'trialDays': 7, 'trialAvailable': true,
      });
      expect(plan.per, '/ month');
      expect(plan.benefits, ['5% off every order', 'Free pickup & delivery on every order']);

      final mine = MySubscription.fromJson({
        'id': 's1', 'status': 'cancelled', 'planId': 'p1', 'startDate': '2026-10-01T00:00:00.000Z', 'endDate': '2026-11-01T00:00:00.000Z',
        'amountPaid': '150.00', 'plan': {'name': 'Basic', 'price': '150.00', 'features': ['Priority pickup']},
      });
      expect(mine.planName, 'Basic');
      expect(mine.isCancelled, isTrue);
      expect(mine.plan!.benefits, ['Priority pickup']);
    });

    test('cart membership: member discount, and no free-delivery nudge for members', () {
      final cart = Cart.fromJson({
        'items': [], 'totalQuantity': 2, 'subtotal': '200.00', 'deliveryFee': 0, 'total': '180.00', 'memberDiscount': 20,
        'membership': {'planName': 'Starter', 'discountPercent': 10, 'freeDelivery': true},
        'freeDeliveryThreshold': 250, 'minItemsFreeDelivery': 10,
      });
      expect(cart.memberDiscount, 20);
      expect(cart.membership!.planName, 'Starter');
      expect(cart.freeDeliveryHint, isNull);
      expect(Cart.fromJson({'subtotal': 100, 'deliveryFee': 50, 'totalQuantity': 1, 'freeDeliveryThreshold': 250, 'minItemsFreeDelivery': 10}).membership, isNull);
    });

    test('friendly dates', () {
      final now = DateTime(2026, 10, 18, 15);
      expect(friendlyDateTime(DateTime(2026, 10, 18, 9, 5), now: now), 'Today, 9:05 AM');
      expect(friendlyDateTime(DateTime(2026, 10, 17, 18, 30), now: now), 'Yesterday, 6:30 PM');
      expect(shortDate(DateTime(2026, 10, 2)), '2 Oct 2026');
    });
  });

  group('screens', () {
    testWidgets('wallet shows the balance, offers and history', (tester) async {
      await tester.pumpWidget(_app(const WalletScreen(), [
        walletSummaryProvider.overrideWith((ref) async => const WalletSummary(balance: 250, totalCredited: 500, totalDebited: 250)),
        walletPackagesProvider.overrideWith((ref) async => [const WalletPackage(id: 'p1', name: 'Value Pack', payAmount: 500, creditAmount: 600)]),
        walletHistoryProvider.overrideWith(_FakeHistory.new),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Available balance'), findsOneWidget);
      expect(find.text('₹250'), findsWidgets);
      expect(find.text('Add money'), findsOneWidget);
      expect(find.text('Get ₹600'), findsOneWidget);
      expect(find.text('+₹100 bonus'), findsOneWidget);
      expect(find.text('Money added'), findsOneWidget);
      expect(find.text('Membership'), findsOneWidget);
      expect(find.text('− ₹250'), findsOneWidget);
    });

    testWidgets('order details: tracker with a missed pickup, items, bill and reorder', (tester) async {
      final order = Order.fromJson(_orderJson(timeline: [
        {'type': 'driver_assigned', 'status': 'pickup_scheduled', 'at': '2026-10-18T11:00:00.000Z'},
        {'type': 'pickup_failed', 'reason': 'Customer not available', 'at': '2026-10-19T08:30:00.000Z'},
        {'type': 'status', 'status': 'picked_up', 'at': '2026-10-19T09:10:00.000Z'},
      ]));
      await tester.pumpWidget(_app(const OrderDetailScreen(orderId: 'b1'), [
        orderDetailProvider.overrideWith((ref, id) async => order),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Order #0012'), findsOneWidget);
      expect(find.text('Picked up'), findsOneWidget); // status header
      expect(find.text('Order tracking'), findsOneWidget);
      expect(find.text('Pickup attempt missed'), findsOneWidget);
      expect(find.textContaining('Customer not available'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Bill details'), 300);
      expect(find.text('Shirt'), findsOneWidget);
      expect(find.text('- ₹60'), findsOneWidget);
      expect(find.text('Reorder'), findsOneWidget);
      expect(find.text('Cancel order'), findsNothing); // too late to cancel
    });

    testWidgets('membership: trial and paid plans, wallet balance check', (tester) async {
      Plan plan(String id, String name, double price, int trial) => Plan.fromJson({
            'id': id, 'name': name, 'price': price, 'durationType': 'month', 'duration': 30,
            'features': ['$name perk'], 'trialDays': trial, 'trialAvailable': trial > 0,
          });
      await tester.pumpWidget(_app(const SubscriptionsScreen(), [
        plansProvider.overrideWith((ref) async => PlansData(plans: [plan('p1', 'Basic', 150, 7), plan('p2', 'Starter', 250, 0)])),
        mySubscriptionProvider.overrideWith((ref) async => null),
        walletBalanceProvider.overrideWith((ref) async => 100),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Save on every order'), findsOneWidget);
      expect(find.text('7-day free trial'), findsOneWidget);
      expect(find.text('Start free trial'), findsOneWidget);
      expect(find.text('Get Starter'), findsOneWidget);

      final getStarter = find.widgetWithText(FilledButton, 'Get Starter');
      await tester.ensureVisible(getStarter);
      await tester.pumpAndSettle();
      await tester.tap(getStarter);
      await tester.pumpAndSettle();
      expect(find.text('Add ₹150 to wallet'), findsOneWidget); // ₹250 plan, ₹100 balance
    });
  });
}
