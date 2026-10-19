import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/brand_widgets.dart';
import '../../wallet/presentation/wallet_screen.dart';
import '../data/pickup_repository.dart';

/// Shared pieces of the Schedule Pickup screens: the branded app bar, numbered step cards and info cards.

/// Back · NClean logo (no tagline) · wallet balance with "+" · avatar, as in the design.
PreferredSizeWidget pickupAppBar(BuildContext context) => AppBar(
  toolbarHeight: 68,
  centerTitle: false,
  backgroundColor: AppColors.surfaceMuted,
  titleSpacing: 0,
  title: Image.asset('assets/images/logo_wordmark.png', height: 32, semanticLabel: 'NClean'),
  actions: const [WalletChip(), SizedBox(width: 10), BrandAvatar(size: 40), SizedBox(width: 16)],
);

/// White card with a numbered badge, title and subtitle (steps 1–4 in the design).
class StepCard extends StatelessWidget {
  const StepCard({super.key, required this.step, required this.title, this.subtitle, required this.child});

  final int step;
  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
        boxShadow: [BoxShadow(color: AppColors.secondary.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
                child: Text(
                  '$step',
                  style: text.titleMedium?.copyWith(color: AppColors.secondary, fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

/// Laundry basket illustration from the design, used on the info and Home cards.
class BasketArt extends StatelessWidget {
  const BasketArt({super.key, this.size = 84});

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size * 0.76,
    child: Image.asset('assets/images/art_basket_card.webp', fit: BoxFit.contain, excludeFromSemantics: true),
  );
}

/// "For Bulk Orders Only" card at the top of the first screen.
class BulkInfoCard extends StatelessWidget {
  const BulkInfoCard({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      decoration: BoxDecoration(color: const Color(0xFFE7F6FE), borderRadius: BorderRadius.circular(16)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Icon(Icons.info, color: AppColors.blue, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'For Bulk Orders Only',
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary),
                ),
                const SizedBox(height: 4),
                Text(
                  'Use this option if you have a large quantity of clothes (e.g. home, office, hotel, hostel) for pickup. We count and bill them at the store.',
                  style: text.bodySmall?.copyWith(color: AppColors.text, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          const BasketArt(size: 96),
        ],
      ),
    );
  }
}

/// The store's pickup & delivery charge rule in words (amounts come from the admin's rule).
class DeliveryChargeCard extends StatelessWidget {
  const DeliveryChargeCard({super.key, required this.charges, this.memberFreeDelivery = false});

  final PickupCharges charges;
  final bool memberFreeDelivery;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final items = charges.minItemsFree != null && charges.minItemsFree! > 0 ? ' or have fewer than ${charges.minItemsFree} pieces' : '';
    final message = charges.isFree
        ? 'Pickup and delivery are free at this store.'
        : 'Orders below ${rupees(charges.freeAbove)}$items have a ${rupees(charges.charge)} pickup & delivery charge. For ${rupees(charges.freeAbove)} and above, pickup and delivery are free.';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(16)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
            child: const Icon(Icons.local_shipping_outlined, color: AppColors.primary, size: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Delivery Charge Information',
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary),
                ),
                const SizedBox(height: 4),
                Text(message, style: text.bodySmall?.copyWith(color: AppColors.textMuted, height: 1.4)),
                if (memberFreeDelivery && !charges.isFree) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Your membership includes free pickup & delivery.',
                    style: text.bodySmall?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Icon tile + label + value row (pickup details, confirmation).
class DetailTile extends StatelessWidget {
  const DetailTile({super.key, required this.icon, required this.title, this.subtitle, this.action, this.onAction});

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.7)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08), shape: BoxShape.circle),
            child: Icon(icon, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!, style: text.bodySmall?.copyWith(color: AppColors.textMuted, height: 1.35)),
              ],
            ),
          ),
          if (action != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(48, 40)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [Text(action!), const Icon(Icons.chevron_right, size: 18)]),
            ),
        ],
      ),
    );
  }
}
