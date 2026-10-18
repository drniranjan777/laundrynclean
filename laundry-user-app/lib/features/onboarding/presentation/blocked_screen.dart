import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../data/onboarding_repository.dart';

/// Maintenance mode or an app version below the backend's minimumAppVersion.
class BlockedScreen extends ConsumerWidget {
  const BlockedScreen({super.key, required this.maintenance});

  final bool maintenance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              Icon(maintenance ? Icons.build_circle_outlined : Icons.system_update_outlined, size: 72, color: AppColors.secondary),
              const SizedBox(height: 24),
              Text(maintenance ? "We'll be right back" : 'Update required',
                  style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Text(
                maintenance
                    ? 'NClean is getting a quick tune-up. Please try again in a little while.'
                    : 'A new version of NClean is available. Please update the app to continue.',
                style: text.bodyLarge?.copyWith(color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
              if (config?.supportPhone != null) ...[
                const SizedBox(height: 16),
                Text('Need help? Call ${config!.supportPhone}', style: text.bodyMedium, textAlign: TextAlign.center),
              ],
              const Spacer(),
              FilledButton(onPressed: () => context.go(Routes.splash), child: const Text('Try again')),
            ],
          ),
        ),
      ),
    );
  }
}
