import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/format.dart';
import '../../checkout/data/checkout_repository.dart';

/// The store's pickup & delivery charge rule (admin-configured). The server applies it when the order is billed.
class PickupCharges {
  const PickupCharges({
    required this.freeAbove,
    required this.deliveryCharge,
    required this.pickupCharge,
    required this.charge,
    required this.description,
    this.minItemsFree,
  });

  final double freeAbove;
  final int? minItemsFree;
  final double deliveryCharge;
  final double pickupCharge;
  final double charge; // delivery + pickup
  final String description;

  bool get isFree => charge == 0;

  factory PickupCharges.fromJson(Map<String, dynamic> json) => PickupCharges(
    freeAbove: toDouble(json['freeAbove']),
    minItemsFree: (json['minItemsFree'] as num?)?.toInt(),
    deliveryCharge: toDouble(json['deliveryCharge']),
    pickupCharge: toDouble(json['pickupCharge']),
    charge: toDouble(json['charge']),
    description: json['description'] as String? ?? '',
  );
}

class PickupStore {
  const PickupStore({required this.id, required this.name, this.city, this.phone});

  final String id;
  final String name;
  final String? city;
  final String? phone;

  factory PickupStore.fromJson(Map<String, dynamic> json) =>
      PickupStore(id: json['id'] as String, name: json['name'] as String? ?? 'Store', city: json['city'] as String?, phone: json['phone'] as String?);
}

/// GET /pickups/config: switches, booking window, texts, and the store and charges for an address.
class PickupConfig {
  const PickupConfig({
    required this.enabled,
    required this.bulkEnabled,
    required this.minAdvanceDays,
    required this.maxAdvanceDays,
    required this.instructions,
    required this.policies,
    required this.storeAcceptsPickups,
    required this.charges,
    this.addressId,
    this.store,
    this.memberPlan,
    this.memberFreeDelivery = false,
    this.memberDiscountPercent = 0,
  });

  final bool enabled;
  final bool bulkEnabled;
  final int minAdvanceDays;
  final int maxAdvanceDays;
  final String? instructions;
  final List<String> policies;
  final String? addressId;
  final PickupStore? store;
  final bool storeAcceptsPickups;
  final PickupCharges charges;
  final String? memberPlan;
  final bool memberFreeDelivery;
  final double memberDiscountPercent;

  /// Whether the Book Pickup entry points should show at all
  bool get available => enabled && bulkEnabled;

  factory PickupConfig.fromJson(Map<String, dynamic> json) {
    final membership = json['membership'] as Map<String, dynamic>?;
    return PickupConfig(
      enabled: json['enabled'] == true,
      bulkEnabled: json['bulkEnabled'] == true,
      minAdvanceDays: (json['minAdvanceDays'] as num?)?.toInt() ?? 1,
      maxAdvanceDays: (json['maxAdvanceDays'] as num?)?.toInt() ?? 7,
      instructions: json['instructions'] as String?,
      policies: splitPolicies(json['policies'] as String?),
      addressId: json['addressId'] as String?,
      store: json['store'] is Map<String, dynamic> ? PickupStore.fromJson(json['store'] as Map<String, dynamic>) : null,
      storeAcceptsPickups: json['storeAcceptsPickups'] == true,
      charges: PickupCharges.fromJson(json['charges'] as Map<String, dynamic>? ?? const {}),
      memberPlan: membership?['planName'] as String?,
      memberFreeDelivery: membership?['freeDelivery'] == true,
      memberDiscountPercent: toDouble(membership?['discountPercent']),
    );
  }
}

/// The admin writes policies one per line; a single paragraph is split into sentences.
List<String> splitPolicies(String? text) {
  final value = (text ?? '').trim();
  if (value.isEmpty) return const [];
  final lines = value.split(RegExp(r'\r?\n')).map((l) => l.replaceFirst(RegExp(r'^[-•*\s]+'), '').trim()).where((l) => l.isNotEmpty).toList();
  if (lines.length > 1) return lines;
  return value.split(RegExp(r'(?<=[.!?])\s+')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
}

/// A date in the booking window: bookable or not, and why not (holiday, closed day, too soon).
class PickupDay {
  const PickupDay({
    required this.date,
    required this.weekday,
    required this.dayOfMonth,
    required this.month,
    required this.available,
    this.dayName = '',
    this.reason,
  });

  final String date; // YYYY-MM-DD in the business timezone
  final String weekday; // Mon
  final int dayOfMonth;
  final String month; // Oct
  final String dayName; // Sunday
  final bool available;
  final String? reason;

  String get longLabel => '$weekday, $dayOfMonth $month';

  factory PickupDay.fromJson(Map<String, dynamic> json) {
    final date = json['date'] as String;
    final parsed = DateTime.tryParse(date);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return PickupDay(
      date: date,
      weekday: json['weekday'] as String? ?? (parsed == null ? '' : days[parsed.weekday - 1]),
      dayOfMonth: (json['dayOfMonth'] as num?)?.toInt() ?? parsed?.day ?? 0,
      month: json['month'] as String? ?? (parsed == null ? '' : months[parsed.month - 1]),
      dayName: json['day'] as String? ?? '',
      available: json['available'] == true,
      reason: json['reason'] as String?,
    );
  }
}

class PickupDates {
  const PickupDates({required this.days, this.firstBookable, this.lastBookable});

  final List<PickupDay> days;
  final String? firstBookable;
  final String? lastBookable;
}

enum SlotStatus { available, full, closed }

/// A time slot on a date at the address's store. Full / closed slots are shown but can't be booked.
class PickupSlotOption {
  const PickupSlotOption({required this.id, required this.label, required this.status, required this.remaining, this.reason});

  final String id;
  final String label;
  final SlotStatus status;
  final int remaining;
  final String? reason;

  bool get bookable => status == SlotStatus.available;

  factory PickupSlotOption.fromJson(Map<String, dynamic> json) => PickupSlotOption(
    id: json['id'] as String,
    label: json['label'] as String? ?? '',
    status: switch (json['status']) {
      'full' => SlotStatus.full,
      'closed' => SlotStatus.closed,
      _ => json['available'] == true ? SlotStatus.available : SlotStatus.full,
    },
    remaining: (json['remaining'] as num?)?.toInt() ?? 0,
    reason: json['reason'] as String?,
  );
}

class PickupSlots {
  const PickupSlots({required this.available, required this.slots, this.reason});

  final bool available;
  final String? reason;
  final List<PickupSlotOption> slots;
}

/// POST /pickups result: what the confirmation screen shows.
class BookedPickup {
  const BookedPickup({
    required this.id,
    required this.orderNumber,
    required this.pickupDate,
    required this.paymentMethod,
    required this.total,
    this.timeSlot,
    this.store,
    this.charges,
  });

  final String id;
  final String orderNumber;
  final String pickupDate;
  final String? timeSlot;
  final PickupStore? store;
  final String paymentMethod; // cod | upi
  final double total; // 0 until billed after pickup
  final PickupCharges? charges;

  bool get isCod => paymentMethod == 'cod';

  factory BookedPickup.fromJson(Map<String, dynamic> json) => BookedPickup(
    id: json['id'] as String,
    orderNumber: json['orderNumber'] as String? ?? '',
    pickupDate: json['pickupDate'] as String? ?? '',
    timeSlot: json['timeSlot'] as String?,
    store: json['location'] is Map<String, dynamic> ? PickupStore.fromJson(json['location'] as Map<String, dynamic>) : null,
    paymentMethod: json['paymentMethod'] as String? ?? 'cod',
    total: toDouble(json['total']),
    charges: json['charges'] is Map<String, dynamic> ? PickupCharges.fromJson(json['charges'] as Map<String, dynamic>) : null,
  );
}

enum PickupPayment {
  cod('cod', 'Cash on delivery', 'Pay the delivery partner when your clothes come back'),
  online('online', 'Pay online', 'UPI / card in the app once your bill is ready');

  const PickupPayment(this.api, this.label, this.hint);
  final String api;
  final String label;
  final String hint;
}

class PickupRepository {
  PickupRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Map<String, dynamic> _address(String? addressId) => {if (addressId != null && addressId.isNotEmpty) 'addressId': addressId};

  Future<PickupConfig> config({String? addressId}) => _call(
    () async => PickupConfig.fromJson(unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/pickups/config', queryParameters: _address(addressId)))),
  );

  Future<PickupDates> dates(String addressId) => _call(() async {
    final data = unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/pickups/dates', queryParameters: _address(addressId)));
    return PickupDates(
      days: ((data['dates'] as List?) ?? const []).cast<Map<String, dynamic>>().map(PickupDay.fromJson).toList(),
      firstBookable: data['firstBookable'] as String?,
      lastBookable: data['lastBookable'] as String?,
    );
  });

  Future<PickupSlots> slots(String date, String addressId) => _call(() async {
    final data = unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/pickups/slots', queryParameters: {'date': date, ..._address(addressId)}));
    return PickupSlots(
      available: data['available'] == true,
      reason: data['reason'] as String?,
      slots: ((data['slots'] as List?) ?? const []).cast<Map<String, dynamic>>().map(PickupSlotOption.fromJson).toList(),
    );
  });

  /// Books the pickup. The same [idempotencyKey] always returns the same order, so a retry never duplicates it.
  Future<BookedPickup> book({
    required String addressId,
    required String pickupDate,
    required String timeSlotId,
    required PickupPayment payment,
    required String idempotencyKey,
    String? notes,
  }) => _call(
    () async => BookedPickup.fromJson(
      unwrap<Map<String, dynamic>>(
        await _dio.post<dynamic>(
          '/pickups',
          data: {
            'addressId': addressId,
            'pickupDate': pickupDate,
            'timeSlotId': timeSlotId,
            'paymentMethod': payment.api,
            'idempotencyKey': idempotencyKey,
            if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          },
        ),
      ),
    ),
  );

  /// Starts online payment for a billed order; the app then opens Razorpay and verifies the result.
  Future<RazorpayOrder> startPayment(String bookingId) => _call(() async {
    final data = unwrap<Map<String, dynamic>>(await _dio.post<dynamic>('/bookings/$bookingId/pay'));
    return RazorpayOrder.fromJson(data['payment'] as Map<String, dynamic>);
  });
}

final pickupRepositoryProvider = Provider<PickupRepository>((ref) => PickupRepository(ref.watch(dioProvider)));

/// Config for an address (null: the default address). Home uses it to decide whether to show Book Pickup.
final pickupConfigProvider = FutureProvider.autoDispose.family<PickupConfig, String?>(
  (ref, addressId) => ref.watch(pickupRepositoryProvider).config(addressId: addressId),
);

final pickupDatesProvider = FutureProvider.autoDispose.family<PickupDates, String>(
  (ref, addressId) => ref.watch(pickupRepositoryProvider).dates(addressId),
);

/// (date, addressId)
final pickupSlotsProvider = FutureProvider.autoDispose.family<PickupSlots, (String, String)>(
  (ref, key) => ref.watch(pickupRepositoryProvider).slots(key.$1, key.$2),
);
