import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/theme/app_theme.dart';
import 'package:istreecare_user/features/auth/presentation/sign_in_screen.dart';

void main() {
  testWidgets('an invalid number shows the error from the design and sends nothing', (tester) async {
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(theme: AppTheme.light(useGoogleFonts: false), home: const SignInScreen()),
    ));

    expect(find.text('Sign In'), findsWidgets);

    await tester.enterText(find.byType(TextField), '12345');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign In'));
    await tester.pump();

    expect(find.text('Please enter a valid mobile number'), findsOneWidget);

    // Typing again clears the error
    await tester.enterText(find.byType(TextField), '98765');
    await tester.pump();
    expect(find.text('Please enter a valid mobile number'), findsNothing);
  });
}
