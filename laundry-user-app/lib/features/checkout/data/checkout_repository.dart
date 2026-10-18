import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/format.dart';

class PickupDate {
  const PickupDate({required this.date, required this.display});

  final String date; // YYYY-MM-DD
  final String display;

  factory PickupDate.fromJson(Map<String, dynamic> json) =>
      PickupDate(date: json['date'] as String, display: json['display'] as String? ?? json['date'] as String);
}

/// A pickup slot on a date at the store serving the address (capacity is per store).
class PickupSlot {
  const PickupSlot({required this.id, required this.label, required this.available, required this.remaining});

  final String id;
  final String label;
  final bool available;
  final int remaining;

  factory PickupSlot.fromJson(Map<String, dynamic> json) => PickupSlot(
        id: json['id'] as String,
        label: json['label'] as String? ?? '',
        available: json['available'] == true,
        remaining: (json['remainingSlots'] as num?)?.toInt() ?? 0,
      );
}

class AppliedPromo {
  const AppliedPromo({required this.code, required this.discount});

  final String code;
  final double discount;
}

class Disclaimer {
  const Disclaimer({required this.title, required this.content});

  final String title;
  final String content;
}

/// POST /bookings/confirm result. [payment] is set for UPI / card: open Razorpay with it, then verify.
class PlacedOrder {
  const PlacedOrder({
    required this.id,
    required this.orderNumber,
    required this.total,
    required this.paymentStatus,
    this.pickupDate,
    this.slot,
    this.storeName,
    this.payment,
  });

  final String id;
  final String orderNumber;
  final double total;
  final String paymentStatus;
  final String? pickupDate;
  final String? slot;
  final String? storeName;
  final RazorpayOrder? payment;

  factory PlacedOrder.fromJson(Map<String, dynamic> json) {
    final b = json['booking'] as Map<String, dynamic>;
    final p = json['payment'] as Map<String, dynamic>?;
    return PlacedOrder(
      id: b['id'] as String,
      orderNumber: b['orderNumber'] as String? ?? '',
      total: toDouble(b['total']),
      paymentStatus: b['paymentStatus'] as String? ?? 'pending',
      pickupDate: b['pickupDate'] as String?,
      slot: b['timeSlot'] as String?,
      storeName: b['location']?['name'] as String?,
      payment: p == null ? null : RazorpayOrder.fromJson(p),
    );
  }
}

class RazorpayOrder {
  const RazorpayOrder({required this.orderId, required this.amountPaise, required this.currency, required this.key});

  final String orderId;
  final int amountPaise;
  final String currency;
  final String key;

  factory RazorpayOrder.fromJson(Map<String, dynamic> json) => RazorpayOrder(
        orderId: json['orderId'] as String,
        amountPaise: (json['amount'] as num).toInt(),
        currency: json['currency'] as String? ?? 'INR',
        key: json['key'] as String? ?? '',
      );
}

enum PaymentMethod {
  cod('cod', 'Cash on delivery', 'Pay the delivery partner when your clothes come back'),
  wallet('wallet', 'NClean wallet', 'Paid now from your wallet balance'),
  online('upi', 'UPI / Card', 'Pay now with Razorpay');

  const PaymentMethod(this.api, this.label, this.hint);
  final String api;
  final String label;
  final String hint;
}

class CheckoutRepository {
  CheckoutRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<List<PickupDate>> dates() => _call(() async =>
      unwrap<List<dynamic>>(await _dio.get<dynamic>('/bookings/available-dates')).cast<Map<String, dynamic>>().map(PickupDate.fromJson).toList());

  Future<List<PickupSlot>> slots(String date, String addressId) => _call(() async => unwrap<List<dynamic>>(
          await _dio.get<dynamic>('/bookings/time-slots', queryParameters: {'date': date, 'addressId': addressId}))
      .cast<Map<String, dynamic>>()
      .map(PickupSlot.fromJson)
      .toList());

  Future<AppliedPromo> applyPromo(String code, double orderAmount) => _call(() async {
        final data = unwrap<Map<String, dynamic>>(
            await _dio.post<dynamic>('/promocodes/apply', data: {'code': code.trim(), 'orderAmount': orderAmount}));
        return AppliedPromo(code: (data['code'] as String?) ?? code.trim().toUpperCase(), discount: toDouble(data['discount']));
      });

  Future<Disclaimer?> disclaimer() async {
    try {
      final data = unwrap<Map<String, dynamic>?>(await _dio.get<dynamic>('/content/disclaimer', options: publicRequest));
      if (data == null || (data['content'] as String? ?? '').isEmpty) return null;
      return Disclaimer(title: data['title'] as String? ?? 'Disclaimer', content: data['content'] as String);
    } catch (_) {
      return null; // a missing disclaimer must not block booking
    }
  }

  Future<PlacedOrder> confirm({
    required String addressId,
    required String pickupDate,
    required String timeSlotId,
    required PaymentMethod method,
    String? promoCode,
    String? notes,
    bool disclaimerAccepted = false,
  }) =>
      _call(() async => PlacedOrder.fromJson(unwrap<Map<String, dynamic>>(await _dio.post<dynamic>('/bookings/confirm', data: {
            'addressId': addressId,
            'pickupDate': pickupDate,
            'timeSlotId': timeSlotId,
            'paymentMethod': method.api,
            if (promoCode != null && promoCode.isNotEmpty) 'promoCode': promoCode,
            if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
            'disclaimerAccepted': disclaimerAccepted,
          }))));

  Future<void> verifyPayment(String bookingId, {required String orderId, required String paymentId, required String signature}) =>
      _call(() => _dio.post<dynamic>('/bookings/$bookingId/verify-payment', data: {
            'razorpayOrderId': orderId,
            'razorpayPaymentId': paymentId,
            'razorpaySignature': signature,
          }));
}

final checkoutRepositoryProvider = Provider<CheckoutRepository>((ref) => CheckoutRepository(ref.watch(dioProvider)));

final pickupDatesProvider = FutureProvider.autoDispose<List<PickupDate>>((ref) => ref.watch(checkoutRepositoryProvider).dates());

/// (date, addressId)
final pickupSlotsProvider = FutureProvider.autoDispose.family<List<PickupSlot>, (String, String)>(
  (ref, key) => ref.watch(checkoutRepositoryProvider).slots(key.$1, key.$2),
);

final disclaimerProvider = FutureProvider.autoDispose<Disclaimer?>((ref) => ref.watch(checkoutRepositoryProvider).disclaimer());
