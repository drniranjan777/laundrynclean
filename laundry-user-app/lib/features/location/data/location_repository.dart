import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/prefs.dart';
import 'location_models.dart';

class LocationRepository {
  LocationRepository(this._dio);

  final Dio _dio;

  Future<PincodeCheck> checkPincode(String pincode) async {
    try {
      final res = await _dio.post<dynamic>('/location/check-pincode', data: {'pincode': pincode.trim()}, options: publicRequest);
      return PincodeCheck.fromJson(unwrap<Map<String, dynamic>>(res));
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  // POST /location/save is deliberately not used: it overwrites the pincode of the customer's default address
  // and fails for new customers (it creates an address without a name). The chosen area is kept on the device;
  // bookings send a real addressId (Phase 3).

  /// GPS position → pincode. The phone's geocoder does the lookup (the backend's coordinate check
  /// isn't wired to a geocoding service yet). Throws [ApiException] with a message to show.
  Future<({String pincode, double lat, double lng})> detectPincode() async {
    final place = await detectPlace();
    return (pincode: place.pincode, lat: place.lat, lng: place.lng);
  }

  /// Like [detectPincode], plus street, city and state from the geocoder (to pre-fill the address form).
  Future<({String pincode, double lat, double lng, String street, String city, String state})> detectPlace() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw ApiException('Turn on location services, or enter your pin code.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      throw ApiException('Location permission is off. Enter your pin code instead.');
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)),
    );

    if (!kIsWeb) {
      try {
        final places = await Geocoding().placemarkFromCoordinates(position.latitude, position.longitude);
        final place = places.where((p) => (p.postalCode ?? '').length == 6).firstOrNull;
        if (place != null) {
          return (
            pincode: place.postalCode!,
            lat: position.latitude,
            lng: position.longitude,
            street: [place.subThoroughfare, place.thoroughfare, place.subLocality].where((s) => (s ?? '').isNotEmpty).join(', '),
            city: place.locality ?? place.subAdministrativeArea ?? '',
            state: place.administrativeArea ?? '',
          );
        }
      } catch (_) {
        // Falls through to the message below
      }
    }
    throw ApiException("We couldn't find the pin code for your location. Please enter it.");
  }
}

final locationRepositoryProvider = Provider<LocationRepository>((ref) => LocationRepository(ref.watch(dioProvider)));

/// The customer's chosen service area, remembered on the device.
class ServiceAreaController extends Notifier<ServiceArea?> {
  @override
  ServiceArea? build() {
    final raw = ref.watch(sharedPrefsProvider).getString(PrefKeys.serviceArea);
    if (raw == null) return null;
    try {
      return ServiceArea.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> choose(ServiceArea area) async {
    await ref.read(sharedPrefsProvider).setString(PrefKeys.serviceArea, jsonEncode(area.toJson()));
    state = area;
  }

  Future<void> clear() async {
    await ref.read(sharedPrefsProvider).remove(PrefKeys.serviceArea);
    state = null;
  }
}

final serviceAreaProvider = NotifierProvider<ServiceAreaController, ServiceArea?>(ServiceAreaController.new);
