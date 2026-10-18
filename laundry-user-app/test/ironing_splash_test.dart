import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:istreecare_user/core/widgets/ironing_splash.dart';

void main() {
  testWidgets('the ironing splash plays once, reports when done and then settles', (tester) async {
    var finished = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: Center(child: IroningSplash(onFinished: () => finished++)))));

    expect(find.byType(Image), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1000));
    expect(finished, 0);

    // pumpAndSettle would time out if the steam kept repeating after the animation
    await tester.pumpAndSettle();
    expect(finished, 1);
  });
}
