import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/application/session_controller.dart';
import '../../location/data/location_repository.dart';

/// Account tab. Orders, wallet, help and profile editing arrive in Phases 4–6.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(serviceAreaProvider.notifier).clear();
    await ref.read(sessionProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider).user;
    final area = ref.watch(serviceAreaProvider);
    final text = Theme.of(context).textTheme;
    Widget soon(IconData icon, String label) => ListTile(
          leading: Icon(icon, color: AppColors.secondary),
          title: Text(label),
          trailing: Text('Soon', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
          enabled: false,
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        children: [
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            leading: CircleAvatar(
              radius: 26,
              backgroundColor: AppColors.secondary,
              foregroundColor: Colors.white,
              child: Text((user?.firstName.isNotEmpty ?? false) ? user!.firstName[0].toUpperCase() : '?', style: text.titleLarge?.copyWith(color: Colors.white)),
            ),
            title: Text(user?.name ?? '', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            subtitle: Text('+91 ${user?.phone ?? ''}${(user?.email ?? '').isEmpty ? '' : '\n${user!.email}'}'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.location_on_outlined, color: AppColors.secondary),
            title: const Text('Service area'),
            subtitle: Text(area == null ? 'Not set' : '${area.pincode} · ${area.label}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(Routes.location),
          ),
          ListTile(
            leading: const Icon(Icons.home_outlined, color: AppColors.secondary),
            title: const Text('Saved addresses'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/addresses'),
          ),
          soon(Icons.receipt_long_outlined, 'My orders'),
          soon(Icons.account_balance_wallet_outlined, 'Wallet'),
          soon(Icons.workspace_premium_outlined, 'Subscriptions'),
          soon(Icons.help_outline, 'Help & FAQs'),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.error),
            title: const Text('Sign out', style: TextStyle(color: AppColors.error)),
            onTap: () => _signOut(context, ref),
          ),
        ],
      ),
    );
  }
}
