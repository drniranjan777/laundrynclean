import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/cart/application/cart_controller.dart';
import '../theme/app_theme.dart';

/// Bottom navigation for the signed-in app: Home, Favourites, Cart (with item count), Account.
/// Styled as in the designs: the selected tab is orange with a short bar under its label.
class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  static const _tabs = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.favorite_border, Icons.favorite, 'Favourites'),
    (Icons.shopping_cart_outlined, Icons.shopping_cart, 'Cart'),
    (Icons.person_outline, Icons.person, 'Account'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartProvider.select((c) => c.value?.totalQuantity ?? 0));
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: shell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(children: [
              for (var i = 0; i < _tabs.length; i++)
                Expanded(
                  child: Semantics(
                    selected: shell.currentIndex == i,
                    button: true,
                    label: '${_tabs[i].$3}${i == 2 && count > 0 ? ', $count items' : ''}',
                    excludeSemantics: true,
                    child: InkWell(
                      onTap: () => shell.goBranch(i, initialLocation: i == shell.currentIndex),
                      child: Builder(builder: (context) {
                        final on = shell.currentIndex == i;
                        final color = on ? AppColors.accent : AppColors.textMuted;
                        final icon = Icon(on ? _tabs[i].$2 : _tabs[i].$1, color: color, size: 26);
                        return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          i == 2 ? Badge(isLabelVisible: count > 0, label: Text('$count'), backgroundColor: AppColors.deepTeal, child: icon) : icon,
                          const SizedBox(height: 2),
                          Text(_tabs[i].$3, style: text.labelMedium?.copyWith(color: color, fontWeight: on ? FontWeight.w700 : FontWeight.w500)),
                          const SizedBox(height: 3),
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            width: on ? 22 : 0,
                            height: 3,
                            decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(2)),
                          ),
                        ]);
                      }),
                    ),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}
