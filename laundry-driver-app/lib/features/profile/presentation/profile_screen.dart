import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/application/session_controller.dart';
import '../../orders/presentation/contact_actions.dart';
import '../../startup/data/app_config_repository.dart';
import '../data/profile_repository.dart';

/// The driver, their store (from GET /profile), support and sign out.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

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
    if (ok == true) await ref.read(sessionProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(driverProfileProvider);
    final user = ref.watch(sessionProvider).user;
    final support = ref.watch(appConfigProvider)?.supportPhone;
    final text = Theme.of(context).textTheme;
    final store = profile.value?.store;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        children: [
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            leading: CircleAvatar(
              radius: 26,
              backgroundColor: AppColors.secondary,
              child: Text((user?.firstName.isNotEmpty ?? false) ? user!.firstName[0].toUpperCase() : 'P',
                  style: text.titleLarge?.copyWith(color: Colors.white)),
            ),
            title: Text(profile.value?.name ?? user?.name ?? '', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
            subtitle: Text('+91 ${profile.value?.phone ?? user?.phone ?? ''}'),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.store_outlined, color: AppColors.secondary),
            title: Text(store?.name ?? (profile.isLoading ? 'Loading…' : 'No store linked')),
            subtitle: (store?.address ?? '').isEmpty ? null : Text(store!.address!),
            trailing: store?.phone == null
                ? null
                : IconButton(tooltip: 'Call store', icon: const Icon(Icons.call_outlined), onPressed: () => callNumber(context, store!.phone!)),
          ),
          if (support != null)
            ListTile(
              leading: const Icon(Icons.support_agent, color: AppColors.secondary),
              title: const Text('Call support'),
              subtitle: Text(support),
              onTap: () => callNumber(context, support),
            ),
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
