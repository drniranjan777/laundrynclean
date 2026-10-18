import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../orders/data/driver_order.dart';

class DriverProfile {
  const DriverProfile({required this.name, required this.phone, this.store});

  final String name;
  final String phone;
  final Store? store;
}

/// GET /profile: the driver and the store they work for.
final driverProfileProvider = FutureProvider.autoDispose<DriverProfile>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get<dynamic>('/profile');
    final user = unwrap<Map<String, dynamic>>(res)['user'] as Map<String, dynamic>;
    return DriverProfile(
      name: user['name'] as String? ?? '',
      phone: user['phone'] as String? ?? '',
      store: Store.fromJson((user['location'] as Map?)?.cast<String, dynamic>()),
    );
  } catch (e) {
    throw ApiException.from(e);
  }
});
