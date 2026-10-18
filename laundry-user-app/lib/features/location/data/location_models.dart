/// The pincode the customer chose and the store that serves it (its prices and slots apply to their orders).
class ServiceArea {
  const ServiceArea({
    required this.pincode,
    this.area,
    this.city,
    this.state,
    this.storeId,
    this.storeName,
    this.deliveryDays,
    this.minimumOrder,
  });

  final String pincode;
  final String? area;
  final String? city;
  final String? state;
  final String? storeId;
  final String? storeName;
  final int? deliveryDays;
  final double? minimumOrder;

  String get label => [area, city].where((s) => s != null && s.isNotEmpty).join(', ');

  factory ServiceArea.fromJson(Map<String, dynamic> json) {
    final store = json['location'] as Map<String, dynamic>?;
    return ServiceArea(
      pincode: json['pincode'] as String,
      area: json['area'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      storeId: (store?['id'] ?? json['storeId']) as String?,
      storeName: (store?['name'] ?? json['storeName']) as String?,
      deliveryDays: json['deliveryDays'] as int?,
      minimumOrder: double.tryParse('${json['minimumOrder'] ?? ''}'),
    );
  }

  Map<String, dynamic> toJson() => {
        'pincode': pincode,
        'area': area,
        'city': city,
        'state': state,
        'storeId': storeId,
        'storeName': storeName,
        'deliveryDays': deliveryDays,
        'minimumOrder': minimumOrder,
      };
}

/// Result of POST /location/check-pincode.
class PincodeCheck {
  const PincodeCheck({required this.pincode, required this.isServiceable, this.area, this.message});

  final String pincode;
  final bool isServiceable;
  final ServiceArea? area;
  final String? message;

  factory PincodeCheck.fromJson(Map<String, dynamic> json) {
    final serviceable = json['isServiceable'] == true;
    return PincodeCheck(
      pincode: '${json['pincode'] ?? ''}',
      isServiceable: serviceable,
      area: serviceable ? ServiceArea.fromJson(json) : null,
      message: json['message'] as String?,
    );
  }
}
