import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/utils/validators.dart';

void main() {
  group('mobile number', () {
    test('accepts 10 digits starting 6-9, with or without +91 / 0', () {
      for (final input in ['9876543210', '+91 98765 43210', '+919876543210', '09876543210', '6000000000']) {
        expect(Validators.mobile(input), isNull, reason: input);
      }
      expect(Validators.normaliseMobile('+91 98765 43210'), '9876543210');
    });

    test('rejects what the backend rejects, with the design text', () {
      for (final input in ['', '12345', '5876543210', '98765432101', '+91-12345678912']) {
        expect(Validators.mobile(input), Validators.invalidMobile, reason: input);
      }
      expect(Validators.invalidMobile, 'Please enter a valid mobile number');
    });
  });

  test('pin code', () {
    expect(Validators.pincode('560034'), isNull);
    expect(Validators.pincode('012345'), isNotNull);
    expect(Validators.pincode('56003'), isNotNull);
  });

  test('optional email', () {
    expect(Validators.optionalEmail(''), isNull);
    expect(Validators.optionalEmail('a@b.co'), isNull);
    expect(Validators.optionalEmail('not-an-email'), isNotNull);
  });

  test('app version compare for force update', () {
    expect(Validators.isOlderVersion('1.0.0', '1.0.0'), isFalse);
    expect(Validators.isOlderVersion('1.0.0', '1.0.1'), isTrue);
    expect(Validators.isOlderVersion('1.2.0', '1.10.0'), isTrue);
    expect(Validators.isOlderVersion('2.0', '1.9.9'), isFalse);
  });
}
