import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/presentation/account_screen.dart';
import '../../features/address/data/address_repository.dart';
import '../../features/address/presentation/address_form_screen.dart';
import '../../features/address/presentation/addresses_screen.dart';
import '../../features/auth/application/session_controller.dart';
import '../../features/auth/presentation/complete_profile_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/auth/presentation/sign_in_screen.dart';
import '../../features/cart/presentation/cart_screen.dart';
import '../../features/cart/presentation/favorites_screen.dart';
import '../../features/catalogue/presentation/category_screen.dart';
import '../../features/catalogue/presentation/item_detail_screen.dart';
import '../../features/catalogue/presentation/search_screen.dart';
import '../../features/checkout/data/checkout_repository.dart';
import '../../features/checkout/presentation/checkout_screen.dart';
import '../../features/checkout/presentation/order_placed_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/location/data/location_models.dart';
import '../../features/location/data/location_repository.dart';
import '../../features/location/presentation/choose_location_screen.dart';
import '../../features/onboarding/presentation/blocked_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/onboarding/presentation/splash_screen.dart';
import '../widgets/main_shell.dart';

class Routes {
  Routes._();
  static const splash = '/';
  static const blocked = '/blocked';
  static const onboarding = '/onboarding';
  static const signIn = '/sign-in';
  static const otp = '/otp';
  static const completeProfile = '/complete-profile';
  static const location = '/location';
  static const home = '/home';
  static const favorites = '/favorites';
  static const cart = '/cart';
  static const account = '/account';
  static const search = '/search';

  /// Screens anyone can open without signing in.
  static const public = {splash, blocked, onboarding, signIn, otp};
}

/// Where a signed-in customer goes next: name first (new users), then a service area, then home.
String routeAfterSignIn(SessionState session, ServiceArea? area) {
  if (session.user?.needsProfile ?? true) return Routes.completeProfile;
  if (area == null) return Routes.location;
  return Routes.home;
}

/// Where the splash screen sends the user once the session is restored.
String launchRoute({required bool onboardingSeen, required SessionState session, required ServiceArea? area}) {
  if (!session.isSignedIn) return onboardingSeen ? Routes.signIn : Routes.onboarding;
  return routeAfterSignIn(session, area);
}

final routerProvider = Provider<GoRouter>((ref) {
  // Re-runs the redirect when the user signs in or out (or the refresh token expires)
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
      if (session.isSignedIn && (location == Routes.signIn || location == Routes.otp)) {
        return routeAfterSignIn(session, ref.read(serviceAreaProvider));
      }
      return null;
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(
        path: Routes.blocked,
        builder: (_, state) => BlockedScreen(maintenance: state.uri.queryParameters['reason'] == 'maintenance'),
      ),
      GoRoute(path: Routes.onboarding, builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: Routes.signIn, builder: (_, _) => const SignInScreen()),
      GoRoute(
        path: Routes.otp,
        redirect: (_, state) => (state.uri.queryParameters['phone'] ?? '').isEmpty ? Routes.signIn : null,
        builder: (_, state) => OtpScreen(phone: state.uri.queryParameters['phone']!),
      ),
      GoRoute(path: Routes.completeProfile, builder: (_, _) => const CompleteProfileScreen()),
      GoRoute(path: Routes.location, builder: (_, _) => const ChooseLocationScreen()),
      // Signed-in app: bottom navigation with a stack per tab
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => MainShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.home, builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.favorites, builder: (_, _) => const FavoritesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.cart, builder: (_, _) => const CartScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.account, builder: (_, _) => const AccountScreen())]),
        ],
      ),
      // Full-screen pages pushed over the tabs
      GoRoute(path: Routes.search, builder: (_, _) => const SearchScreen()),
      GoRoute(
        path: '/category/:id',
        builder: (_, state) => CategoryScreen(categoryId: state.pathParameters['id']!, initialSubCategoryId: state.uri.queryParameters['sub']),
      ),
      GoRoute(path: '/item/:id', builder: (_, state) => ItemDetailScreen(itemId: state.pathParameters['id']!)),
      // Addresses and checkout (Phase 3)
      GoRoute(
        path: '/addresses',
        builder: (_, state) => AddressesScreen(
          selectMode: state.uri.queryParameters['select'] == '1',
          selectedId: state.uri.queryParameters['selected'],
        ),
      ),
      GoRoute(path: '/addresses/new', builder: (_, _) => const AddressFormScreen()),
      GoRoute(path: '/addresses/:id/edit', builder: (_, state) => AddressFormScreen(address: state.extra as Address?)),
      GoRoute(path: '/checkout', builder: (_, _) => const CheckoutScreen()),
      GoRoute(
        path: '/order-placed',
        redirect: (_, state) => state.extra == null ? Routes.home : null,
        builder: (_, state) {
          final placed = state.extra! as ({PlacedOrder order, bool paid, String? note});
          return OrderPlacedScreen(order: placed.order, paid: placed.paid, note: placed.note);
        },
      ),
    ],
  );
});
