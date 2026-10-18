import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_exception.dart';
import '../theme/app_theme.dart';

/// Shared building blocks for the account screens (wallet, orders, subscriptions, help), so they look alike.

/// White rounded card with a hairline border; tappable when [onTap] is set.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.margin, this.color});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: Material(
        color: color ?? AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// Bold section title with an optional action on the right ("See all").
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction, this.padding = const EdgeInsets.fromLTRB(20, 20, 12, 8)});

  final String title;
  final String? action;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(children: [
        Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
        if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
      ]),
    );
  }
}

/// Small coloured pill for a status ("Delivered", "Active").
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: color, fontWeight: FontWeight.w600)),
    );
  }
}

/// Label on the left, value on the right (bill lines, order information).
class KeyValueRow extends StatelessWidget {
  const KeyValueRow(this.label, this.value, {super.key, this.bold = false, this.valueColor, this.padding = const EdgeInsets.symmetric(vertical: 5)});

  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final style = bold ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700) : text.bodyMedium;
    return Padding(
      padding: padding,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Text(label, style: bold ? style : style?.copyWith(color: AppColors.textMuted))),
        const SizedBox(width: 12),
        Expanded(child: Text(value, textAlign: TextAlign.right, style: style?.copyWith(color: valueColor))),
      ]),
    );
  }
}

/// Icon in a tinted circle, a title, a line of help and an optional button: for empty lists.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.actionLabel, this.onAction});

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: Icon(icon, size: 40, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          ],
          if (actionLabel != null) ...[
            const SizedBox(height: 20),
            SizedBox(width: 220, child: FilledButton(onPressed: onAction, child: Text(actionLabel!))),
          ],
        ]),
      ),
    );
  }
}

/// A failed load with the message and a Try again button.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.cloud_off_outlined,
      title: 'Couldn\'t load this',
      message: ApiException.from(error).message,
      actionLabel: 'Try again',
      onAction: onRetry,
    );
  }
}

/// Loading spinner / error with retry / content for an [AsyncValue]. Keeps showing old data while refreshing.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.value, required this.data, required this.onRetry});

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (e, _) => ErrorState(error: e, onRetry: onRetry),
      data: data,
    );
  }
}

/// Gradient hero card in the logo colours (wallet balance, membership).
class BrandHeroCard extends StatelessWidget {
  const BrandHeroCard({super.key, required this.child, this.gradient = AppColors.brandGradient});

  final Widget child;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.secondary.withValues(alpha: 0.25), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: Stack(children: [
        // Soft wave circles, like the logo's wave
        Positioned(right: -40, top: -50, child: _Bubble(size: 160, alpha: 0.08)),
        Positioned(right: 40, bottom: -70, child: _Bubble(size: 140, alpha: 0.06)),
        Padding(padding: const EdgeInsets.all(20), child: child),
      ]),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.size, required this.alpha});

  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) =>
      Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: alpha)));
}

/// Short date: "18 Oct 2026". [withTime] adds ", 9:20 AM".
String shortDate(DateTime? d, {bool withTime = false}) {
  if (d == null) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final local = d.toLocal();
  final date = '${local.day} ${months[local.month - 1]} ${local.year}';
  if (!withTime) return date;
  final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
  return '$date, $h:${local.minute.toString().padLeft(2, '0')} ${local.hour < 12 ? 'AM' : 'PM'}';
}

/// "Today, 9:20 AM" / "Yesterday, 6:05 PM" / "12 Oct 2026, 9:20 AM".
String friendlyDateTime(DateTime? d, {DateTime? now}) {
  if (d == null) return '';
  final local = d.toLocal();
  final today = DateUtils.dateOnly(now ?? DateTime.now());
  final day = DateUtils.dateOnly(local);
  final h = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final time = '$h:${local.minute.toString().padLeft(2, '0')} ${local.hour < 12 ? 'AM' : 'PM'}';
  if (day == today) return 'Today, $time';
  if (day == today.subtract(const Duration(days: 1))) return 'Yesterday, $time';
  return shortDate(local, withTime: true);
}
