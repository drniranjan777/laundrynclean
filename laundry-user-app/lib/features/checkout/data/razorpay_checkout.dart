import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/network/api_exception.dart';
import 'checkout_repository.dart';

/// Opens Razorpay Checkout (Android / iOS) for an order the backend created, and completes with the
/// ids /bookings/:id/verify-payment needs. Throws [ApiException] when the payment fails or is cancelled.
class RazorpayCheckout {
  static bool get isSupported => !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);

  Future<({String orderId, String paymentId, String signature})> pay(
    RazorpayOrder order, {
    required String description,
    String? name,
    String? phone,
    String? email,
  }) {
    if (!isSupported) {
      return Future.error(ApiException('Online payment works in the NClean app on your phone.'));
    }
    final completer = Completer<({String orderId, String paymentId, String signature})>();
    final razorpay = Razorpay();

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) {
      if (!completer.isCompleted) {
        completer.complete((orderId: r.orderId ?? order.orderId, paymentId: r.paymentId ?? '', signature: r.signature ?? ''));
      }
    });
    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) {
      if (completer.isCompleted) return;
      completer.completeError(ApiException(r.code == Razorpay.PAYMENT_CANCELLED
          ? 'Payment cancelled.'
          : 'Payment failed${(r.message ?? '').isEmpty ? '' : ': ${r.message}'}'));
    });
    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse _) {
      // Wallet apps finish the payment themselves; Razorpay then reports success or error
    });

    razorpay.open({
      'key': order.key,
      'order_id': order.orderId,
      'amount': order.amountPaise,
      'currency': order.currency,
      'name': 'NClean',
      'description': description,
      'prefill': {'contact': ?phone, 'email': ?email, 'name': ?name},
      'theme': {'color': '#062C5A'},
    });

    return completer.future.whenComplete(razorpay.clear);
  }
}
