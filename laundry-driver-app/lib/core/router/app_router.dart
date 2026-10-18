import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/session_controller.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/auth/presentation/sign_in_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/orders/presentation/order_detail_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/startup/presentation/blocked_screen.dart';
import '../../features/startup/presentation/splash_screen.dart';

class Routes {
  Routes._();
  static const splash = '/';
  static const blocked = '/blocked';
  static const signIn = '/sign-in';
  static const otp = '/otp';
  static const home = '/home';

  static const public = {splash, blocked, signIn, otp};
}

final routerProvider = Provider<GoRouter>((ref) {
  final sessionChanges = ValueNotifier<int>(0);
  ref.listen(sessionProvider, (_, _) => sessionChanges.value++);
  ref.onDispose(sessionChanges.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: sessionChanges,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final location = state.matchedLocation;
      if (session.status == SessionStatus.unknown) {
        return location == Routes.splash || location == Routes.blocked ? null : Routes.splash;
      }
      if (!session.isSignedIn && !Routes.public.contains(location)) return Routes.signIn;
      if (session.isSignedIn && (location == Routes.signIn || location == Routes.otp)) return Routes.home;
      return null;
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(
        path: Routes.blocked,
        builder: (_, state) => BlockedScreen(maintenance: state.uri.queryParameters['reason'] == 'maintenance'),
      ),
      GoRoute(path: Routes.signIn, builder: (_, _) => const SignInScreen()),
      GoRoute(
        path: Routes.otp,
        redirect: (_, state) => (state.uri.queryParameters['phone'] ?? '').isEmpty ? Routes.signIn : null,
        builder: (_, state) => OtpScreen(phone: state.uri.queryParameters['phone']!),
      ),
      GoRoute(path: Routes.home, builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/order/:id', builder: (_, state) => OrderDetailScreen(orderId: state.pathParameters['id']!)),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    ],
  );
});
