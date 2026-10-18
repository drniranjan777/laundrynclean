import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import 'driver_order.dart';

/// The task tabs and the order statuses each one lists (GET /drivers/my-orders?status=…).
enum TaskTab {
  pickups('Pickups', ['pending', 'confirmed', 'pickup_scheduled']),
  toStore('To store', ['picked_up']),
  deliveries('Deliveries', ['ready', 'out_for_delivery']),
  completed('Completed', ['delivered']);

  const TaskTab(this.label, this.statuses);
  final String label;
  final List<String> statuses;
}

Future<List<DriverOrder>> _fetch(Ref ref, {List<String>? statuses, int limit = 100}) async {
  try {
    final res = await ref.read(dioProvider).get<dynamic>('/drivers/my-orders', queryParameters: {
      if (statuses != null) 'status': statuses.join(','),
      'limit': limit,
    });
    return unwrap<List<dynamic>>(res).cast<Map<String, dynamic>>().map(DriverOrder.fromJson).toList();
  } catch (e) {
    throw ApiException.from(e);
  }
}

/// Orders in one tab. Completed shows the latest 50.
final taskOrdersProvider = FutureProvider.autoDispose.family<List<DriverOrder>, TaskTab>(
  (ref, tab) => _fetch(ref, statuses: tab.statuses, limit: tab == TaskTab.completed ? 50 : 100),
);

/// One order for the detail screen (drivers can't open /bookings/:id, so it comes from the same list).
final orderByIdProvider = FutureProvider.autoDispose.family<DriverOrder?, String>((ref, id) async {
  final all = await _fetch(ref);
  return all.where((o) => o.id == id).firstOrNull;
});
