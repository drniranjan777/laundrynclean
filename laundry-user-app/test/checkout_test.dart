import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/features/address/data/address_repository.dart';
import 'package:istreecare_user/features/checkout/data/checkout_repository.dart';

void main() {
  test('placed order without online payment', () {
    final o = PlacedOrder.fromJson({
      'booking': {
        'id': 'b1', 'orderNumber': '0019', 'status': 'confirmed', 'total': 410, 'paymentStatus': 'pending',
        'pickupDate': '2026-10-19', 'timeSlot': '10:00 AM - 12:00 PM', 'location': {'id': 's1', 'name': 'Main Store'},
      },
      'payment': null,
    });
    expect(o.orderNumber, '0019');
    expect(o.total, 410);
    expect(o.storeName, 'Main Store');
    expect(o.payment, isNull);
  });

  test('placed order with a Razorpay order to pay', () {
    final o = PlacedOrder.fromJson({
      'booking': {'id': 'b2', 'orderNumber': '0020', 'total': '99.50', 'paymentStatus': 'pending'},
      'payment': {'orderId': 'order_X', 'amount': 9950, 'currency': 'INR', 'key': 'rzp_test_1'},
    });
    expect(o.total, 99.5);
    expect(o.payment!.orderId, 'order_X');
    expect(o.payment!.amountPaise, 9950);
  });

  test('slots and dates', () {
    final s = PickupSlot.fromJson({'id': 't1', 'label': '08:00 AM - 10:00 AM', 'available': false, 'remainingSlots': 0});
    expect(s.available, isFalse);
    expect(PickupDate.fromJson({'date': '2026-10-19', 'display': 'Monday, 19 Oct'}).display, 'Monday, 19 Oct');
  });

  test('payment methods map to the API values', () {
    expect(PaymentMethod.cod.api, 'cod');
    expect(PaymentMethod.wallet.api, 'wallet');
    expect(PaymentMethod.online.api, 'upi');
  });

  test('address parse and input body', () {
    final a = Address.fromJson({
      'id': 'a1', 'fullName': 'Asha', 'addressLine': '12 MG Road', 'city': 'Bangalore', 'pincode': '560001',
      'lat': '12.97', 'lng': null, 'label': 'Home', 'isDefault': true,
    });
    expect(a.oneLine, '12 MG Road, Bangalore, 560001');
    expect(a.lat, 12.97);
    expect(a.lng, isNull);

    const input = AddressInput(fullName: ' Asha ', phone: '9876543210', addressLine: '12 MG Road', city: 'Bangalore', state: '', pincode: '560001', label: 'Home');
    final body = input.toJson();
    expect(body['fullName'], 'Asha');
    expect(body.containsKey('lat'), isFalse); // no coordinates sent when unknown
  });
}
