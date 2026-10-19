import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/theme/app_theme.dart';
import 'package:istreecare_user/features/auth/presentation/sign_in_screen.dart';

void main() {
  testWidgets('an invalid number shows the error and sends nothing', (tester) async {
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const SignInScreen()),
    ));

    expect(find.text('Login or Sign Up'), findsOneWidget);
    expect(find.text('Fresh Clothes,\nHappier You'), findsOneWidget);
    expect(find.text('+91'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '12345');
    await tester.ensureVisible(find.text('Send OTP'));
    await tester.tap(find.text('Send OTP'));
    await tester.pump();

    expect(find.text('Please enter a valid mobile number'), findsOneWidget);

    // Typing again clears the error
    await tester.enterText(find.byType(TextField), '98765');
    await tester.pump();
    expect(find.text('Please enter a valid mobile number'), findsNothing);
  });

  for (final size in const [Size(320, 640), Size(390, 844), Size(430, 932)]) {
    testWidgets('login fits a ${size.width.toInt()}×${size.height.toInt()} phone', (tester) async {
      tester.view.physicalSize = size * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(ProviderScope(child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const SignInScreen())));
      await tester.pump(const Duration(seconds: 3)); // the promise highlight moves on
      expect(find.text('Easy\nPickup'), findsOneWidget);
      expect(find.textContaining('Terms & Conditions', findRichText: true), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
