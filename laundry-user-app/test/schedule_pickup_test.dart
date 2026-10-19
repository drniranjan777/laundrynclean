import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/theme/app_theme.dart';
import 'package:istreecare_user/features/address/data/address_repository.dart';
import 'package:istreecare_user/features/orders/data/orders_repository.dart';
import 'package:istreecare_user/features/orders/presentation/order_detail_screen.dart';
import 'package:istreecare_user/features/pickup/application/pickup_draft.dart';
import 'package:istreecare_user/features/pickup/data/pickup_repository.dart';
import 'package:istreecare_user/features/pickup/presentation/pickup_booked_screen.dart';
import 'package:istreecare_user/features/pickup/presentation/pickup_review_screen.dart';
import 'package:istreecare_user/features/pickup/presentation/schedule_pickup_screen.dart';
import 'package:istreecare_user/features/wallet/data/wallet_repository.dart';

const _address = Address(id: 'a1', fullName: 'Asha', addressLine: 'H No. 2-19-79/9, Balaji Enclave', city: 'Hyderabad', pincode: '500039', label: 'Home', isDefault: true);

Map<String, dynamic> _configJson({bool enabled = true}) => {
      'enabled': enabled,
      'bulkEnabled': true,
      'minAdvanceDays': 1,
      'maxAdvanceDays': 7,
      'timezone': 'Asia/Kolkata',
      'instructions': 'Keep your clothes ready and packed.',
      'policies': 'Clothes are counted at the store. Same-day pickup is not available.',
      'addressId': 'a1',
      'store': {'id': 's1', 'name': 'Main Store', 'city': 'Hyderabad Branch'},
      'storeAcceptsPickups': true,
      'charges': {'freeAbove': 250, 'minItemsFree': null, 'deliveryCharge': 50, 'pickupCharge': 0, 'charge': 50, 'description': ''},
      'membership': null,
    };

final _days = [
  PickupDay.fromJson({'date': '2026-10-20', 'weekday': 'Tue', 'dayOfMonth': 20, 'month': 'Oct', 'day': 'Tuesday', 'available': true}),
  PickupDay.fromJson({'date': '2026-10-21', 'weekday': 'Wed', 'dayOfMonth': 21, 'month': 'Oct', 'day': 'Wednesday', 'available': false, 'reason': 'Diwali holiday'}),
  PickupDay.fromJson({'date': '2026-10-22', 'weekday': 'Thu', 'dayOfMonth': 22, 'month': 'Oct', 'day': 'Thursday', 'available': true}),
];

final _slots = [
  PickupSlotOption.fromJson({'id': 't1', 'label': '08:00 AM - 10:00 AM', 'status': 'available', 'available': true, 'remaining': 12}),
  PickupSlotOption.fromJson({'id': 't2', 'label': '10:00 AM - 12:00 PM', 'status': 'full', 'available': false, 'remaining': 0}),
  PickupSlotOption.fromJson({'id': 't3', 'label': '12:00 PM - 02:00 PM', 'status': 'available', 'available': true, 'remaining': 2}),
  PickupSlotOption.fromJson({'id': 't4', 'label': '06:00 PM - 09:00 PM', 'status': 'closed', 'available': false, 'remaining': 0}),
];

class _Addresses extends AddressesController {
  @override
  Future<List<Address>> build() async => const [_address];
}

List _overrides({bool enabled = true}) => [
      addressesProvider.overrideWith(_Addresses.new),
      walletBalanceProvider.overrideWith((ref) async => 500),
      pickupConfigProvider.overrideWith((ref, id) async => PickupConfig.fromJson(_configJson(enabled: enabled))),
      pickupDatesProvider.overrideWith((ref, id) async => PickupDates(days: _days, firstBookable: '2026-10-20', lastBookable: '2026-10-26')),
      pickupSlotsProvider.overrideWith((ref, key) async => PickupSlots(available: true, slots: _slots)),
    ];

Widget _app(Widget child, List overrides) => ProviderScope(
      overrides: [...overrides],
      child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: child),
    );

/// The page's vertical list (the day strip scrolls sideways)
final _page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;

/// Phone sizes the screens must fit without overflow: small, typical and large
const _sizes = [Size(320, 640), Size(390, 844), Size(430, 932)];

void main() {
  group('models', () {
    test('config, policies, days, slots and booking', () {
      final c = PickupConfig.fromJson(_configJson());
      expect(c.available, isTrue);
      expect(c.store!.name, 'Main Store');
      expect(c.charges.charge, 50);
      expect(c.policies, ['Clothes are counted at the store.', 'Same-day pickup is not available.']);
      expect(splitPolicies('- First rule\n• Second rule\n\nThird'), ['First rule', 'Second rule', 'Third']);
      expect(PickupConfig.fromJson({..._configJson(), 'bulkEnabled': false}).available, isFalse);

      expect(_days[1].available, isFalse);
      expect(_days[0].longLabel, 'Tue, 20 Oct');
      expect(_days[0].dayName, 'Tuesday');
      expect(_slots[1].status, SlotStatus.full);
      expect(_slots[3].status, SlotStatus.closed);
      expect(_slots[0].bookable, isTrue);
      expect(_slots[1].bookable, isFalse);

      final b = BookedPickup.fromJson({
        'id': 'b1', 'orderNumber': '0012', 'pickupDate': '2026-10-20', 'timeSlot': '08:00 AM - 10:00 AM', 'paymentMethod': 'cod', 'total': 0,
        'location': {'id': 's1', 'name': 'Main Store'}, 'charges': {'freeAbove': 250, 'charge': 50, 'deliveryCharge': 50, 'pickupCharge': 0},
      });
      expect(b.isCod, isTrue);
      expect(b.total, 0);
      expect(b.charges!.freeAbove, 250);
    });

    test('the draft keeps the selection and its idempotency key until reset', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final draft = container.read(pickupDraftProvider.notifier);
      final key = container.read(pickupDraftProvider).idempotencyKey;
      expect(key, hasLength(32));
      draft.setAddress(_address);
      draft.setDay(_days[0]);
      draft.setSlot(_slots[0]);
      draft.setPayment(PickupPayment.online);
      expect(container.read(pickupDraftProvider).readyForReview, isTrue);
      expect(container.read(pickupDraftProvider).idempotencyKey, key); // same key for retries
      draft.setDay(_days[2]);
      expect(container.read(pickupDraftProvider).slot, isNull); // a new day needs a new slot
      draft.setSlot(_slots[2]);
      draft.reset();
      expect(container.read(pickupDraftProvider).readyForReview, isFalse);
      expect(container.read(pickupDraftProvider).address?.id, 'a1'); // address kept
      expect(container.read(pickupDraftProvider).idempotencyKey, isNot(key)); // next booking is a new request
    });

    test('bulk orders: awaiting bill, pay online once billed', () {
      Map<String, dynamic> json(Map<String, dynamic> extra) => {
            'id': 'b1', 'orderNumber': '0012', 'status': 'confirmed', 'orderType': 'online', 'bookingType': 'bulk_pickup',
            'paymentMethod': 'upi', 'paymentStatus': 'pending', 'subtotal': 0, 'discount': 0, 'deliveryFee': 0, 'gstAmount': 0, 'total': 0, 'items': [],
            ...extra,
          };
      final waiting = Order.fromJson(json({}));
      expect(waiting.isBulkPickup, isTrue);
      expect(waiting.awaitingBill, isTrue);
      expect(waiting.canPayOnline, isFalse);
      expect(waiting.paymentLabel, 'UPI · Pay after billing');
      final billed = Order.fromJson(json({'status': 'in_process', 'total': '290.00', 'subtotal': '240.00', 'deliveryFee': '50.00'}));
      expect(billed.awaitingBill, isFalse);
      expect(billed.canPayOnline, isTrue);
      expect(Order.fromJson(json({'total': 290, 'paymentStatus': 'paid'})).canPayOnline, isFalse);
      expect(Order.fromJson(json({'total': 290, 'paymentMethod': 'cod'})).canPayOnline, isFalse);
      // An app order whose Razorpay payment didn't go through can be paid again
      expect(Order.fromJson(json({'bookingType': 'standard', 'status': 'pending', 'total': 540})).canPayOnline, isTrue);
      expect(Order.fromJson(json({'bookingType': 'standard', 'total': 540, 'status': 'cancelled'})).canPayOnline, isFalse);
      expect(Order.fromJson(json({'bookingType': 'standard', 'total': 540, 'orderType': 'offline'})).canPayOnline, isFalse);
    });
  });

  group('screens', () {
    for (final size in _sizes) {
      testWidgets('schedule pickup at ${size.width.toInt()}×${size.height.toInt()}: days, slots, charges, next', (tester) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(_app(const SchedulePickupScreen(), _overrides()));
        await tester.pumpAndSettle();

        expect(find.text('Schedule Pickup'), findsOneWidget);
        expect(find.text('For Bulk Orders Only'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('20 Oct'), 200, scrollable: _page);
        expect(find.text('Select Day for Pickup'), findsOneWidget);
        expect(find.text('Holiday'), findsOneWidget); // 21 Oct is a holiday
        await tester.scrollUntilVisible(find.text('Full'), 200, scrollable: _page);
        expect(find.text('08:00 AM - 10:00 AM'), findsOneWidget);
        expect(find.text('Unavailable'), findsOneWidget);
        expect(find.text('2 left'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('Delivery Charge Information'), 200, scrollable: _page);
        expect(find.textContaining('Orders below ₹250 have a ₹50 pickup & delivery charge'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('10:00 AM - 12:00 PM'), -200, scrollable: _page);

        // Next stays disabled until a slot is chosen; full slots can't be chosen
        final next = find.widgetWithText(FilledButton, 'Next');
        expect(tester.widget<FilledButton>(next).onPressed, isNull);
        await tester.ensureVisible(find.text('10:00 AM - 12:00 PM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('10:00 AM - 12:00 PM'));
        await tester.pump();
        expect(tester.widget<FilledButton>(next).onPressed, isNull);
        await tester.ensureVisible(find.text('08:00 AM - 10:00 AM'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('08:00 AM - 10:00 AM'));
        await tester.pump();
        expect(tester.widget<FilledButton>(next).onPressed, isNotNull);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('schedule pickup switched off by the admin', (tester) async {
      await tester.pumpWidget(_app(const SchedulePickupScreen(), _overrides(enabled: false)));
      await tester.pumpAndSettle();
      expect(find.text('Schedule Pickup is paused'), findsOneWidget);
      expect(find.text('Next'), findsNothing);
    });

    for (final size in [_sizes.first, _sizes.last]) {
      testWidgets('review at ${size.width.toInt()}×${size.height.toInt()}: details, summary, rules, payment', (tester) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        final container = ProviderContainer(overrides: [..._overrides()]);
        addTearDown(container.dispose);
        container.read(pickupDraftProvider.notifier)
          ..setAddress(_address)
          ..setDay(_days[0])
          ..setSlot(_slots[0]);
        await tester.pumpWidget(UncontrolledProviderScope(
          container: container,
          child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const PickupReviewScreen()),
        ));
        await tester.pumpAndSettle();

        expect(find.text('Pickup Details'), findsOneWidget);
        expect(find.text('Main Store'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('Bulk Pickup'), 200, scrollable: _page);
        expect(find.text('Tue, 20 Oct'), findsOneWidget);
        expect(find.text('Confirm Pickup'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('Payable now'), 200, scrollable: _page);
        expect(find.text('Billed after pickup'), findsOneWidget);
        expect(find.text('₹50 if below ₹250'), findsOneWidget);
        expect(find.text('Clothes are counted at the store.'), findsOneWidget); // the admin's policies, one per bullet
        expect(find.text('Minimum order value for free pickup: ₹250.'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('Pay online'), 200, scrollable: _page);
        await tester.ensureVisible(find.text('Pay online'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Pay online'));
        await tester.pump();
        expect(container.read(pickupDraftProvider).payment, PickupPayment.online);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('pickup booked confirmation fits a small phone', (tester) async {
      tester.view.physicalSize = const Size(320, 640) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final booked = BookedPickup.fromJson({
        'id': 'b1', 'orderNumber': '0012', 'pickupDate': '2026-10-20', 'timeSlot': '08:00 AM - 10:00 AM', 'paymentMethod': 'cod', 'total': 0,
        'location': {'id': 's1', 'name': 'Main Store', 'city': 'Hyderabad Branch'},
        'charges': {'freeAbove': 250, 'charge': 50, 'deliveryCharge': 50, 'pickupCharge': 0},
      });
      await tester.pumpWidget(_app(PickupBookedScreen(booked: booked, dayName: 'Tuesday'), const []));
      await tester.pumpAndSettle();
      expect(find.text('Order #0012'), findsOneWidget);
      expect(find.text('20 Oct 2026'), findsOneWidget);
      expect(find.text('Tuesday'), findsOneWidget);
      expect(find.text('Pay on delivery'), findsOneWidget);
      expect(find.text('COD'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Back to Home'), 200, scrollable: _page);
      expect(find.text('After pickup'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('bulk order details: billed after pickup, then Pay now', (tester) async {
      final waiting = Order.fromJson({
        'id': 'b1', 'orderNumber': '0012', 'status': 'confirmed', 'orderType': 'online', 'bookingType': 'bulk_pickup', 'paymentMethod': 'upi',
        'paymentStatus': 'pending', 'subtotal': 0, 'discount': 0, 'deliveryFee': 0, 'gstAmount': 0, 'total': 0, 'items': [], 'pickupDate': '2026-10-20',
      });
      await tester.pumpWidget(_app(const OrderDetailScreen(orderId: 'b1'), [orderDetailProvider.overrideWith((ref, id) async => waiting)]));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Bulk pickup'), 200, scrollable: _page);
      expect(find.textContaining('counted at the store after pickup'), findsOneWidget);
      expect(find.textContaining('Pay ₹'), findsNothing);

      final billed = Order.fromJson({
        'id': 'b2', 'orderNumber': '0013', 'status': 'in_process', 'orderType': 'online', 'bookingType': 'bulk_pickup', 'paymentMethod': 'upi',
        'paymentStatus': 'pending', 'subtotal': '240.00', 'discount': 0, 'deliveryFee': '50.00', 'gstAmount': 0, 'total': '290.00',
        'items': [{'itemId': null, 'name': 'Shirt', 'quantity': 12, 'price': '20.00', 'lineTotal': '240.00'}],
      });
      await tester.pumpWidget(_app(const OrderDetailScreen(orderId: 'b2'), [orderDetailProvider.overrideWith((ref, id) async => billed)]));
      await tester.pumpAndSettle();
      expect(find.text('Pay ₹290 now'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Bulk pickup'), 200, scrollable: _page); // chip on the items card
    });
  });
}
