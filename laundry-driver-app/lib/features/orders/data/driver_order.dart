double _toDouble(Object? v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
double? _maybeDouble(Object? v) => v == null ? null : double.tryParse('$v');

/// ₹120 for whole amounts, ₹99.50 otherwise.
String rupees(num value) => value == value.roundToDouble() ? '₹${value.toInt()}' : '₹${value.toStringAsFixed(2)}';

/// What the driver does next with an order (the backend's `stage`).
enum OrderStage {
  pickup('Pickup'),
  toStore('Take to store'),
  atStore('At store'),
  delivery('Delivery'),
  done('Delivered'),
  cancelled('Cancelled');

  const OrderStage(this.label);
  final String label;

  static OrderStage parse(String? value) => switch (value) {
        'pickup' => pickup,
        'to_store' => toStore,
        'at_store' => atStore,
        'delivery' => delivery,
        'done' => done,
        _ => cancelled,
      };
}

class OrderAddress {
  const OrderAddress({this.fullName, this.phone, this.line, this.city, this.pincode, this.label, this.lat, this.lng});

  final String? fullName;
  final String? phone;
  final String? line;
  final String? city;
  final String? pincode;
  final String? label;
  final double? lat;
  final double? lng;

  String get oneLine => [line, city, pincode].where((s) => s != null && s.isNotEmpty).join(', ');
  bool get hasCoordinates => lat != null && lng != null && !(lat == 0 && lng == 0);

  factory OrderAddress.fromJson(Map<String, dynamic> json) => OrderAddress(
        fullName: json['fullName'] as String?,
        phone: json['phone'] as String?,
        line: (json['addressLine'] ?? json['address_line']) as String?,
        city: json['city'] as String?,
        pincode: json['pincode'] as String?,
        label: json['label'] as String?,
        lat: _maybeDouble(json['lat']),
        lng: _maybeDouble(json['lng']),
      );
}

class OrderItem {
  const OrderItem({required this.name, required this.quantity, this.options = '', this.note});

  final String name;
  final int quantity;
  final String options;
  final String? note;

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        name: json['name'] as String? ?? 'Item',
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        options: [json['garmentColor'] ?? json['color'], json['size']].where((s) => s != null && '$s'.isNotEmpty).join(' · '),
        note: json['itemNote'] as String?,
      );
}

class Store {
  const Store({required this.name, this.phone, this.address});

  final String name;
  final String? phone;
  final String? address;

  static Store? fromJson(Map<String, dynamic>? json) => json == null
      ? null
      : Store(
          name: json['name'] as String? ?? 'Store',
          phone: json['phone'] as String?,
          address: [json['addressLine'], json['city'], json['pincode']].where((s) => s != null && '$s'.isNotEmpty).join(', '),
        );
}

/// An order from GET /drivers/my-orders.
class DriverOrder {
  const DriverOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.stage,
    this.pickupDate,
    this.slot,
    this.customerName,
    this.customerPhone,
    this.address,
    this.store,
    this.items = const [],
    this.itemCount = 0,
    this.paymentMethod,
    this.total = 0,
    this.amountToCollect = 0,
    this.customerNote,
    this.failedAttempts = 0,
    this.lastFailureReason,
  });

  final String id;
  final String orderNumber;
  final String status;
  final OrderStage stage;
  final String? pickupDate;
  final String? slot;
  final String? customerName;
  final String? customerPhone;
  final OrderAddress? address;
  final Store? store;
  final List<OrderItem> items;
  final int itemCount;
  final String? paymentMethod;
  final double total;
  final double amountToCollect;
  final String? customerNote;
  final int failedAttempts;
  final String? lastFailureReason;

  /// Statuses the driver acts on: pickup → picked_up → (handed to store) in_process; ready → out_for_delivery → delivered.
  bool get atPickup => stage == OrderStage.pickup;
  bool get readyToDeliver => status == 'ready';
  bool get outForDelivery => status == 'out_for_delivery';

  String get statusLabel => status.replaceAll('_', ' ').replaceFirstMapped(RegExp(r'^.'), (m) => m[0]!.toUpperCase());

  /// Where to go: the customer for pickups and deliveries, the store when taking clothes in.
  bool get headsToStore => stage == OrderStage.toStore;

  String get paymentLabel => switch (paymentMethod) {
        'cod' => 'Cash on delivery',
        'upi' => 'UPI',
        'card' => 'Card',
        'wallet' => 'Wallet',
        _ => paymentMethod ?? '—',
      };

  factory DriverOrder.fromJson(Map<String, dynamic> json) {
    final customer = (json['customer'] as Map?)?.cast<String, dynamic>() ?? const {};
    return DriverOrder(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String? ?? '',
      status: json['status'] as String? ?? '',
      stage: OrderStage.parse(json['stage'] as String?),
      pickupDate: json['pickupDate'] as String?,
      slot: (json['timeSlot'] as Map?)?['label'] as String?,
      customerName: customer['name'] as String?,
      customerPhone: customer['phone'] as String?,
      address: json['address'] == null ? null : OrderAddress.fromJson((json['address'] as Map).cast<String, dynamic>()),
      store: Store.fromJson((json['store'] as Map?)?.cast<String, dynamic>()),
      items: ((json['items'] as List?) ?? const []).cast<Map<String, dynamic>>().map(OrderItem.fromJson).toList(),
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      paymentMethod: json['paymentMethod'] as String?,
      total: _toDouble(json['total']),
      amountToCollect: _toDouble(json['amountToCollect']),
      customerNote: (json['customerNote'] ?? json['notes']) as String?,
      failedAttempts: (json['failedAttempts'] as num?)?.toInt() ?? 0,
      lastFailureReason: (json['lastFailure'] as Map?)?['reason'] as String?,
    );
  }
}
