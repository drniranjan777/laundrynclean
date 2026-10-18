import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// The NClean logo with a "PARTNER" badge, so drivers don't confuse this app with the customer app.
class PartnerLogo extends StatelessWidget {
  const PartnerLogo({super.key, this.width = 220});

  final double width;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset('assets/images/logo_wordmark.png', width: width, semanticLabel: 'NClean'),
        const SizedBox(height: 10),
        const PartnerBadge(),
      ],
    );
  }
}

class PartnerBadge extends StatelessWidget {
  const PartnerBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(20)),
      child: Text('PARTNER',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Colors.white, letterSpacing: 3, fontWeight: FontWeight.w600)),
    );
  }
}
