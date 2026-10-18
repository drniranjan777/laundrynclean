import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/router/app_router.dart';
import 'package:istreecare_user/features/auth/application/session_controller.dart';
import 'package:istreecare_user/features/auth/data/auth_models.dart';
import 'package:istreecare_user/features/location/data/location_models.dart';

void main() {
  const named = AppUser(id: 'u1', phone: '9876543210', role: 'customer', name: 'Asha Rao');
  const unnamed = AppUser(id: 'u2', phone: '9876543211', role: 'customer');
  const area = ServiceArea(pincode: '560034', area: 'Koramangala', city: 'Bangalore', storeName: 'Main Store');

  test('launch route: onboarding once, then sign in', () {
    expect(launchRoute(onboardingSeen: false, session: const SessionState.signedOut(), area: null), Routes.onboarding);
    expect(launchRoute(onboardingSeen: true, session: const SessionState.signedOut(), area: null), Routes.signIn);
  });

  test('after sign in: name first, then location, then home', () {
    expect(routeAfterSignIn(const SessionState.signedIn(unnamed), area), Routes.completeProfile);
    expect(routeAfterSignIn(const SessionState.signedIn(named), null), Routes.location);
    expect(routeAfterSignIn(const SessionState.signedIn(named), area), Routes.home);
  });

  test('pincode check parses the backend response', () {
    final ok = PincodeCheck.fromJson({
      'isServiceable': true,
      'pincode': '560034',
      'city': 'Bangalore',
      'area': 'Koramangala',
      'deliveryDays': 3,
      'minimumOrder': '149.00',
      'location': {'id': 's1', 'name': 'Main Store', 'code': 'MAIN'},
    });
    expect(ok.isServiceable, isTrue);
    expect(ok.area!.storeName, 'Main Store');
    expect(ok.area!.minimumOrder, 149.0);
    expect(ok.area!.label, 'Koramangala, Bangalore');

    final no = PincodeCheck.fromJson({'isServiceable': false, 'pincode': '110001', 'message': 'Sorry'});
    expect(no.isServiceable, isFalse);
    expect(no.area, isNull);
  });

  test('service area survives a save/load round trip', () {
    final copy = ServiceArea.fromJson(area.toJson());
    expect(copy.pincode, area.pincode);
    expect(copy.storeName, area.storeName);
  });
}
