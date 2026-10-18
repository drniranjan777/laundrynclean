import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../home/data/driver_repository.dart';
import 'orders_repository.dart';

/// A photo taken in the app, sent to the backend as a base64 data URL (proof of pickup / delivery).
class ProofPhoto {
  const ProofPhoto(this.bytes, {this.mimeType = 'image/jpeg'});

  final Uint8List bytes;
  final String mimeType;

  String get dataUrl => 'data:$mimeType;base64,${base64Encode(bytes)}';
}

/// Reasons offered when a pickup or delivery can't be done (D3). "Other" asks for a note.
const pickupFailureReasons = ['Customer not available', 'Customer asked to reschedule', 'Wrong or incomplete address', 'Could not reach the customer', 'Other'];
const deliveryFailureReasons = ['Customer not available', 'Customer asked to reschedule', 'Customer not ready to pay', 'Wrong or incomplete address', 'Other'];

/// Driver actions on an order (Phase 3): status changes, cash collection, failed attempts, proof photos.
class OrderActions {
  OrderActions(this._ref);

  final Ref _ref;

  Future<void> _call(Future<void> Function() request) async {
    try {
      await request();
    } catch (e) {
      throw ApiException.from(e);
    } finally {
      // Lists, the open order and today's numbers all change
      _ref.invalidate(taskOrdersProvider);
      _ref.invalidate(orderByIdProvider);
      _ref.invalidate(driverStatsProvider);
    }
  }

  /// PATCH /drivers/orders/:id/status. [cashCollected] is required to deliver an unpaid COD order.
  Future<void> setStatus(String orderId, String status, {String? note, ProofPhoto? photo, int? itemCount, double? cashCollected}) =>
      _call(() => _ref.read(dioProvider).patch<dynamic>('/drivers/orders/$orderId/status', data: {
            'status': status,
            if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
            'photo': ?photo?.dataUrl,
            'itemCount': ?itemCount,
            'cashCollected': ?cashCollected,
          }));

  /// POST /drivers/orders/:id/failed. A pickup keeps its status; a delivery goes back to Ready.
  Future<void> reportFailed(String orderId, {required String reason, String? note, ProofPhoto? photo}) =>
      _call(() => _ref.read(dioProvider).post<dynamic>('/drivers/orders/$orderId/failed', data: {
            'reason': reason,
            if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
            'photo': ?photo?.dataUrl,
          }));
}

final orderActionsProvider = Provider<OrderActions>((ref) => OrderActions(ref));
