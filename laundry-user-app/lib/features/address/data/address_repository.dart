import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../auth/application/session_controller.dart';

/// A pickup / delivery address (GET /addresses).
class Address {
  const Address({
    required this.id,
    required this.fullName,
    required this.addressLine,
    required this.city,
    required this.pincode,
    this.phone,
    this.state,
    this.label,
    this.lat,
    this.lng,
    this.isDefault = false,
  });

  final String id;
  final String fullName;
  final String addressLine;
  final String city;
  final String pincode;
  final String? phone;
  final String? state;
  final String? label;
  final double? lat;
  final double? lng;
  final bool isDefault;

  String get oneLine => [addressLine, city, pincode].where((s) => s.isNotEmpty).join(', ');

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: json['id'] as String,
        fullName: json['fullName'] as String? ?? '',
        addressLine: json['addressLine'] as String? ?? '',
        city: json['city'] as String? ?? '',
        pincode: json['pincode'] as String? ?? '',
        phone: json['phone'] as String?,
        state: json['state'] as String?,
        label: json['label'] as String?,
        lat: double.tryParse('${json['lat'] ?? ''}'),
        lng: double.tryParse('${json['lng'] ?? ''}'),
        isDefault: json['isDefault'] == true,
      );
}

/// What the address form sends (POST / PUT /addresses).
class AddressInput {
  const AddressInput({
    required this.fullName,
    required this.phone,
    required this.addressLine,
    required this.city,
    required this.state,
    required this.pincode,
    required this.label,
    this.lat,
    this.lng,
  });

  final String fullName;
  final String phone;
  final String addressLine;
  final String city;
  final String state;
  final String pincode;
  final String label;
  final double? lat;
  final double? lng;

  Map<String, dynamic> toJson() => {
        'fullName': fullName.trim(),
        'phone': phone.trim(),
        'addressLine': addressLine.trim(),
        'city': city.trim(),
        'state': state.trim(),
        'pincode': pincode.trim(),
        'label': label,
        'lat': ?lat,
        'lng': ?lng,
      };
}

class AddressRepository {
  AddressRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<List<Address>> list() => _call(() async =>
      unwrap<List<dynamic>>(await _dio.get<dynamic>('/addresses')).cast<Map<String, dynamic>>().map(Address.fromJson).toList());

  Future<Address> add(AddressInput input) =>
      _call(() async => Address.fromJson(unwrap<Map<String, dynamic>>(await _dio.post<dynamic>('/addresses', data: input.toJson()))));

  Future<Address> update(String id, AddressInput input) =>
      _call(() async => Address.fromJson(unwrap<Map<String, dynamic>>(await _dio.put<dynamic>('/addresses/$id', data: input.toJson()))));

  Future<void> setDefault(String id) => _call(() => _dio.patch<dynamic>('/addresses/$id/set-default'));

  Future<void> delete(String id) => _call(() => _dio.delete<dynamic>('/addresses/$id'));
}

final addressRepositoryProvider = Provider<AddressRepository>((ref) => AddressRepository(ref.watch(dioProvider)));

/// The customer's saved addresses, default first (as the backend orders them).
class AddressesController extends AsyncNotifier<List<Address>> {
  @override
  Future<List<Address>> build() async {
    if (!ref.watch(sessionProvider.select((s) => s.isSignedIn))) return const [];
    return ref.watch(addressRepositoryProvider).list();
  }

  AddressRepository get _repo => ref.read(addressRepositoryProvider);

  Future<Address> add(AddressInput input) async {
    final address = await _repo.add(input);
    state = AsyncData(await _repo.list());
    return address;
  }

  Future<void> edit(String id, AddressInput input) async {
    await _repo.update(id, input);
    state = AsyncData(await _repo.list());
  }

  Future<void> makeDefault(String id) async {
    await _repo.setDefault(id);
    state = AsyncData(await _repo.list());
  }

  Future<void> remove(String id) async {
    await _repo.delete(id);
    state = AsyncData(await _repo.list());
  }
}

final addressesProvider = AsyncNotifierProvider<AddressesController, List<Address>>(AddressesController.new);
