import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

/// GET /drivers/stats for the dashboard.
class DriverStats {
  const DriverStats({this.todayOrders = 0, this.activeOrders = 0, this.totalDelivered = 0, this.totalAssigned = 0});

  final int todayOrders;
  final int activeOrders;
  final int totalDelivered;
  final int totalAssigned;

  factory DriverStats.fromJson(Map<String, dynamic> json) => DriverStats(
        todayOrders: json['todayOrders'] as int? ?? 0,
        activeOrders: json['activeOrders'] as int? ?? 0,
        totalDelivered: json['totalDelivered'] as int? ?? 0,
        totalAssigned: json['totalAssigned'] as int? ?? 0,
      );
}

final driverStatsProvider = FutureProvider.autoDispose<DriverStats>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get<dynamic>('/drivers/stats');
    return DriverStats.fromJson(unwrap<Map<String, dynamic>>(res));
  } catch (e) {
    throw ApiException.from(e);
  }
});
