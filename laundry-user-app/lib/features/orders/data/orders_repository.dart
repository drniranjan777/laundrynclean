import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';

/// Order statuses in the order they happen (plus cancelled).
enum OrderStatus {
  pending('pending', 'Awaiting payment', 'Order placed'),
  confirmed('confirmed', 'Confirmed', 'Order confirmed'),
  pickupScheduled('pickup_scheduled', 'Pickup scheduled', 'Pickup partner assigned'),
  pickedUp('picked_up', 'Picked up', 'Clothes picked up'),
  inProcess('in_process', 'In process', 'Cleaning & ironing'),
  ready('ready', 'Ready', 'Ready for delivery'),
  outForDelivery('out_for_delivery', 'Out for delivery', 'Out for delivery'),
  delivered('delivered', 'Delivered', 'Delivered'),
  readyForPickup('ready_for_pickup', 'Ready to collect', 'Ready to collect at the store'),
  collected('collected', 'Collected', 'Collected'),
  cancelled('cancelled', 'Cancelled', 'Cancelled');

  const OrderStatus(this.api, this.label, this.step);
  final String api;
  final String label; // chip text
  final String step; // tracker step text

  static OrderStatus from(String? value) => OrderStatus.values.firstWhere((s) => s.api == value, orElse: () => OrderStatus.pending);

  bool get isActive => this != delivered && this != collected && this != cancelled;

  /// Handed over to the customer: delivered, or collected at the store
  bool get isCompleted => this == delivered || this == collected;

  Color get color => switch (this) {
        delivered || collected => const Color(0xFF16A34A),
        cancelled => AppColors.error,
        pending => const Color(0xFFB45309),
        outForDelivery || ready || readyForPickup => AppColors.blue,
        _ => AppColors.primary,
      };

  /// Tracker steps for a home pickup and delivery (pending and confirmed share the first one).
  static const trackerSteps = [confirmed, pickupScheduled, pickedUp, inProcess, ready, outForDelivery, delivered];

  /// Tracker steps when the customer collects the clothes at the store.
  static const collectionSteps = [confirmed, pickupScheduled, pickedUp, inProcess, ready, readyForPickup, collected];

  /// Store orders: handed in at the counter, collected there.
  static const storeSteps = [confirmed, inProcess, ready, readyForPickup, collected];
}

class OrderLine {
  const OrderLine({required this.name, required this.quantity, required this.price, required this.lineTotal, this.itemId, this.color, this.size, this.note});

  final String? itemId; // null for custom store items
  final String name;
  final int quantity;
  final double price;
  final double lineTotal;
  final String? color;
  final String? size;
  final String? note;

  String get options => [color, size].whereType<String>().where((s) => s.isNotEmpty).join(' · ');

  factory OrderLine.fromJson(Map<String, dynamic> json) => OrderLine(
        itemId: json['itemId'] as String?,
        name: json['name'] as String? ?? 'Item',
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        price: toDouble(json['price']),
        lineTotal: toDouble(json['lineTotal']),
        color: json['color'] as String?,
        size: json['size'] as String?,
        note: json['itemNote'] as String?,
      );
}

class OrderAddress {
  const OrderAddress({required this.fullName, required this.lines, this.phone, this.label});

  final String fullName;
  final String lines;
  final String? phone;
  final String? label;

  factory OrderAddress.fromJson(Map<String, dynamic> json) => OrderAddress(
        fullName: json['fullName'] as String? ?? '',
        phone: json['phone'] as String?,
        label: json['label'] as String?,
        lines: [json['addressLine'], json['city'], json['state'], json['pincode']].whereType<String>().where((s) => s.isNotEmpty).join(', '),
      );
}

/// A step that happened, from the order's history: a status reached, or a failed pickup / delivery attempt.
class TimelineEvent {
  const TimelineEvent({required this.type, this.status, this.reason, this.at});

  final String type; // status, driver_assigned, pickup_failed, delivery_failed
  final OrderStatus? status;
  final String? reason;
  final DateTime? at;

  bool get isFailure => type == 'pickup_failed' || type == 'delivery_failed';

  factory TimelineEvent.fromJson(Map<String, dynamic> json) => TimelineEvent(
        type: json['type'] as String? ?? 'status',
        status: json['status'] == null ? null : OrderStatus.from(json['status'] as String),
        reason: json['reason'] as String?,
        at: DateTime.tryParse(json['at'] as String? ?? ''),
      );
}

class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.isStoreOrder,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.subtotal,
    required this.discount,
    required this.deliveryFee,
    required this.gstAmount,
    required this.total,
    required this.lines,
    this.pickupDate,
    this.slot,
    this.storeName,
    this.storePhone,
    this.createdAt,
    this.estimatedDelivery,
    this.notes,
    this.invoiceNumber,
    this.address,
    this.timeline = const [],
  });

  final String id;
  final String orderNumber;
  final OrderStatus status;
  final bool isStoreOrder; // placed at the store counter (POS)
  final String paymentMethod;
  final String paymentStatus;
  final double subtotal;
  final double discount;
  final double deliveryFee;
  final double gstAmount;
  final double total;
  final List<OrderLine> lines;
  final String? pickupDate;
  final String? slot;
  final String? storeName;
  final String? storePhone;
  final DateTime? createdAt;
  final String? estimatedDelivery;
  final String? notes;
  final String? invoiceNumber;
  final OrderAddress? address; // detail only
  final List<TimelineEvent> timeline; // detail only

  int get itemCount => lines.fold(0, (sum, l) => sum + l.quantity);

  /// The customer may cancel an online order until it's on the way to be picked up (the backend's rule)
  bool get canCancel => !isStoreOrder && (status == OrderStatus.pending || status == OrderStatus.confirmed);

  /// Items that can go back into the cart (custom store items have no catalogue id)
  List<OrderLine> get reorderable => lines.where((l) => l.itemId != null).toList();

  String get paymentLabel {
    final method = switch (paymentMethod) {
      'cod' => 'Cash on delivery',
      'wallet' => 'NClean wallet',
      'upi' => 'UPI',
      'card' => 'Card',
      'cash' => 'Cash',
      _ => paymentMethod.isEmpty ? 'Payment' : paymentMethod[0].toUpperCase() + paymentMethod.substring(1),
    };
    final state = switch (paymentStatus) {
      'paid' => 'Paid',
      'refunded' => 'Refunded',
      'failed' => 'Failed',
      _ => paymentMethod == 'cod' ? 'Pay on delivery' : 'Pending',
    };
    return '$method · $state';
  }

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: json['id'] as String,
        orderNumber: json['orderNumber'] as String? ?? '',
        status: OrderStatus.from(json['status'] as String?),
        isStoreOrder: json['orderType'] == 'offline',
        paymentMethod: json['paymentMethod'] as String? ?? '',
        paymentStatus: json['paymentStatus'] as String? ?? 'pending',
        subtotal: toDouble(json['subtotal']),
        discount: toDouble(json['discount']),
        deliveryFee: toDouble(json['deliveryFee']),
        gstAmount: toDouble(json['gstAmount']),
        total: toDouble(json['total']),
        lines: ((json['items'] as List?) ?? const []).cast<Map<String, dynamic>>().map(OrderLine.fromJson).toList(),
        pickupDate: json['pickupDate'] as String?,
        slot: json['timeSlot'] is Map ? json['timeSlot']['label'] as String? : json['timeSlot'] as String?,
        storeName: json['location'] is Map ? json['location']['name'] as String? : null,
        storePhone: json['location'] is Map ? json['location']['phone'] as String? : null,
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? json['createdAt'] as String? ?? ''),
        estimatedDelivery: json['estimatedDeliveryDate'] as String?,
        notes: json['notes'] as String?,
        invoiceNumber: json['invoiceNumber'] as String?,
        address: json['address'] is Map<String, dynamic> ? OrderAddress.fromJson(json['address'] as Map<String, dynamic>) : null,
        timeline: ((json['timeline'] as List?) ?? const []).cast<Map<String, dynamic>>().map(TimelineEvent.fromJson).toList(),
      );
}

class OrderPage {
  const OrderPage({required this.orders, required this.page, required this.totalPages});

  final List<Order> orders;
  final int page;
  final int totalPages;

  bool get hasMore => page < totalPages;
}

class OrdersRepository {
  OrdersRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<OrderPage> list({int page = 1, int limit = 20}) => _call(() async {
        final data = unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/bookings', queryParameters: {'page': page, 'limit': limit}));
        return OrderPage(
          orders: ((data['bookings'] as List?) ?? const []).cast<Map<String, dynamic>>().map(Order.fromJson).toList(),
          page: (data['page'] as num?)?.toInt() ?? page,
          totalPages: (data['totalPages'] as num?)?.toInt() ?? page,
        );
      });

  Future<Order> detail(String id) => _call(() async => Order.fromJson(unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/bookings/$id'))));

  /// Returns the backend's message ("Booking cancelled. ₹420 refunded to your wallet").
  Future<String> cancel(String id) => _call(() async {
        final res = await _dio.patch<dynamic>('/bookings/$id/cancel');
        return (res.data as Map<String, dynamic>)['message'] as String? ?? 'Order cancelled';
      });
}

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) => OrdersRepository(ref.watch(dioProvider)));

/// All of the customer's orders, newest first, a page at a time (the tabs filter them on the phone).
class OrdersController extends AsyncNotifier<OrderPage> {
  @override
  Future<OrderPage> build() => ref.read(ordersRepositoryProvider).list();

  bool _loadingMore = false;

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    try {
      final next = await ref.read(ordersRepositoryProvider).list(page: current.page + 1);
      state = AsyncData(OrderPage(orders: [...current.orders, ...next.orders], page: next.page, totalPages: next.totalPages));
    } finally {
      _loadingMore = false;
    }
  }
}

final ordersProvider = AsyncNotifierProvider.autoDispose<OrdersController, OrderPage>(OrdersController.new);

final orderDetailProvider = FutureProvider.autoDispose.family<Order, String>((ref, id) => ref.watch(ordersRepositoryProvider).detail(id));
