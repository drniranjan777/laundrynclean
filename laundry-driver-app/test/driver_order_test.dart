import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_driver/features/orders/data/driver_order.dart';
import 'package:istreecare_driver/features/orders/data/order_actions.dart';
import 'package:istreecare_driver/features/orders/data/orders_repository.dart';
import 'package:istreecare_driver/features/orders/presentation/contact_actions.dart';

Map<String, dynamic> orderJson({String status = 'ready', String stage = 'delivery', Map<String, dynamic>? address}) => {
      'id': 'b1',
      'orderNumber': 'ORD-001',
      'status': status,
      'stage': stage,
      'pickupDate': '2026-10-20',
      'timeSlot': {'label': '10:00 AM - 12:00 PM'},
      'customer': {'name': 'Asha Rao', 'phone': '9876500000'},
      'address': address ?? {'fullName': 'Asha Rao', 'addressLine': '12 MG Road', 'city': 'Bangalore', 'pincode': '560001', 'lat': '12.97', 'lng': '77.59'},
      'store': {'name': 'Main Store', 'phone': '9800000000', 'addressLine': '1 Store St', 'city': 'Bangalore', 'pincode': '560034'},
      'items': [
        {'name': 'Shirt', 'quantity': 3, 'garmentColor': 'Blue', 'size': 'M'},
        {'name': 'Saree', 'quantity': 1},
      ],
      'itemCount': 4,
      'paymentMethod': 'cod',
      'total': '420.00',
      'amountToCollect': 420,
    };

void main() {
  test('parses an order from /drivers/my-orders', () {
    final o = DriverOrder.fromJson(orderJson());
    expect(o.stage, OrderStage.delivery);
    expect(o.slot, '10:00 AM - 12:00 PM');
    expect(o.customerPhone, '9876500000');
    expect(o.address!.oneLine, '12 MG Road, Bangalore, 560001');
    expect(o.address!.hasCoordinates, isTrue);
    expect(o.items.first.options, 'Blue · M');
    expect(o.amountToCollect, 420);
    expect(o.paymentLabel, 'Cash on delivery');
    expect(o.statusLabel, 'Ready');
    expect(o.store!.address, '1 Store St, Bangalore, 560034');
  });

  test('stages map from the backend', () {
    expect(OrderStage.parse('pickup'), OrderStage.pickup);
    expect(OrderStage.parse('to_store'), OrderStage.toStore);
    expect(OrderStage.parse('done'), OrderStage.done);
    expect(OrderStage.parse(null), OrderStage.cancelled);
  });

  test('tabs ask for the right statuses', () {
    expect(TaskTab.pickups.statuses, ['pending', 'confirmed', 'pickup_scheduled']);
    expect(TaskTab.deliveries.statuses, ['ready', 'out_for_delivery']);
  });

  test('destination: customer for deliveries, store when taking clothes in', () {
    final delivery = DriverOrder.fromJson(orderJson());
    expect(destinationOf(delivery).phone, '9876500000');
    final toStore = DriverOrder.fromJson(orderJson(status: 'picked_up', stage: 'to_store'));
    expect(toStore.headsToStore, isTrue);
    expect(destinationOf(toStore).phone, '9800000000');
    expect(destinationOf(toStore).text, contains('Store St'));
  });

  test('Google Maps link uses the pin, else the address text', () {
    final withPin = DriverOrder.fromJson(orderJson());
    expect(directionsUri(address: withPin.address).queryParameters['destination'], '12.97,77.59');
    final noPin = DriverOrder.fromJson(orderJson(address: {'addressLine': '5 Park Rd', 'city': 'Pune', 'pincode': '411001'}));
    expect(directionsUri(address: noPin.address).queryParameters['destination'], '5 Park Rd, Pune, 411001');
    expect(directionsUri(fallbackText: '1 Store St').queryParameters['api'], '1');
  });

  test('rupees', () {
    expect(rupees(420), '₹420');
    expect(rupees(99.5), '₹99.50');
  });

  test('failed attempts and what the driver can do next', () {
    final o = DriverOrder.fromJson({...orderJson(status: 'out_for_delivery'), 'failedAttempts': 2, 'lastFailure': {'type': 'delivery_failed', 'reason': 'Customer not available'}});
    expect(o.failedAttempts, 2);
    expect(o.lastFailureReason, 'Customer not available');
    expect(o.outForDelivery, isTrue);
    expect(o.readyToDeliver, isFalse);
    expect(DriverOrder.fromJson(orderJson(status: 'pickup_scheduled', stage: 'pickup')).atPickup, isTrue);
    expect(DriverOrder.fromJson(orderJson()).failedAttempts, 0);
  });

  test('proof photo becomes a data URL the backend accepts', () {
    final photo = ProofPhoto(Uint8List.fromList([1, 2, 3]), mimeType: 'image/png');
    expect(photo.dataUrl, 'data:image/png;base64,AQID');
  });

  test('failure reasons end with Other', () {
    expect(pickupFailureReasons.last, 'Other');
    expect(deliveryFailureReasons, contains('Customer not ready to pay'));
  });
}
