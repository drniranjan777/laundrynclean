import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_driver/core/theme/app_theme.dart';
import 'package:istreecare_driver/features/auth/presentation/sign_in_screen.dart';

void main() {
  testWidgets('partner sign in shows the badge and rejects an invalid number', (tester) async {
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const SignInScreen()),
    ));

    expect(find.text('PARTNER'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '5123456789');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign In'));
    await tester.pump();
    expect(find.text('Please enter a valid mobile number'), findsOneWidget);
  });
}
