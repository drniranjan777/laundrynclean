import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/driver_order.dart';

Future<void> _open(BuildContext context, Uri uri) async {
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Couldn't open that on this phone")));
  }
}

Future<void> callNumber(BuildContext context, String phone) => _open(context, Uri(scheme: 'tel', path: phone));

/// Google Maps directions: exact pin when the address has coordinates, else the address text.
Uri directionsUri({OrderAddress? address, String? fallbackText}) {
  final destination = address != null && address.hasCoordinates
      ? '${address.lat},${address.lng}'
      : (address?.oneLine.isNotEmpty == true ? address!.oneLine : (fallbackText ?? ''));
  return Uri.https('www.google.com', '/maps/dir/', {'api': '1', 'destination': destination});
}

Future<void> navigateTo(BuildContext context, {OrderAddress? address, String? fallbackText}) =>
    _open(context, directionsUri(address: address, fallbackText: fallbackText));

/// Where the driver is headed for this order, and how to reach whoever is there.
({String? phone, OrderAddress? address, String? text}) destinationOf(DriverOrder order) => order.headsToStore
    ? (phone: order.store?.phone, address: null, text: order.store?.address)
    : (phone: order.customerPhone, address: order.address, text: null);
