import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/env.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/contact.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../onboarding/data/onboarding_repository.dart';
import '../data/help_repository.dart';

/// Help & support: call / WhatsApp / email support, searchable FAQs by topic, and the legal pages.
class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  String _query = '';

  Future<void> _open(Future<bool> launch) async {
    if (!await launch && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Couldn\'t open that on this phone')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final config = ref.watch(appConfigProvider);
    final faqs = ref.watch(faqsProvider);
    final phone = config?.supportPhone;
    final email = config?.supportEmail;

    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: AppBar(title: const Text('Help & support'), backgroundColor: AppColors.surfaceMuted),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text('How can we help?', style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Our team is here for pickups, orders, payments and anything else.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: _ContactTile(
                icon: Icons.call_outlined,
                label: 'Call us',
                onTap: phone == null || phone.isEmpty ? null : () => _open(Contact.call(phone)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ContactTile(
                icon: Icons.chat_outlined,
                label: 'WhatsApp',
                onTap: phone == null || phone.isEmpty ? null : () => _open(Contact.whatsApp(phone, message: 'Hi NClean, I need help with')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _ContactTile(
                icon: Icons.mail_outline,
                label: 'Email',
                onTap: email == null || email.isEmpty ? null : () => _open(Contact.email(email, subject: 'NClean support')),
              ),
            ),
          ]),
          const SectionHeader('Frequently asked questions', padding: EdgeInsets.fromLTRB(4, 24, 4, 10)),
          TextField(
            decoration: const InputDecoration(hintText: 'Search questions', prefixIcon: Icon(Icons.search), isDense: true),
            onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
          ),
          const SizedBox(height: 12),
          faqs.when(
            loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: AppColors.primary))),
            error: (e, _) => AppCard(
              child: Row(children: [
                const Expanded(child: Text('Couldn\'t load the FAQs.')),
                TextButton(onPressed: () => ref.invalidate(faqsProvider), child: const Text('Try again')),
              ]),
            ),
            data: (list) {
              final shown = list.where((f) => _query.isEmpty || f.question.toLowerCase().contains(_query) || f.answer.toLowerCase().contains(_query)).toList();
              if (shown.isEmpty) {
                return AppCard(child: Text(list.isEmpty ? 'No FAQs yet.' : 'No questions match "$_query".', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)));
              }
              final byTopic = <String, List<Faq>>{};
              for (final f in shown) {
                byTopic.putIfAbsent(f.category, () => []).add(f);
              }
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final topic in byTopic.entries) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 4, 4, 6),
                    child: Text(topic.key.toUpperCase(), style: text.labelMedium?.copyWith(color: AppColors.textMuted, letterSpacing: 1, fontWeight: FontWeight.w700)),
                  ),
                  AppCard(
                    padding: EdgeInsets.zero,
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Theme(
                      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                      child: Column(children: [
                        for (var i = 0; i < topic.value.length; i++) ...[
                          if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                          ExpansionTile(
                            initiallyExpanded: _query.isNotEmpty,
                            iconColor: AppColors.primary,
                            collapsedIconColor: AppColors.textMuted,
                            title: Text(topic.value[i].question, style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            expandedAlignment: Alignment.centerLeft,
                            children: [Text(topic.value[i].answer, style: text.bodyMedium?.copyWith(color: AppColors.textMuted, height: 1.45))],
                          ),
                        ],
                      ]),
                    ),
                  ),
                ],
              ]);
            },
          ),
          const SectionHeader('About', padding: EdgeInsets.fromLTRB(4, 12, 4, 10)),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              _LinkRow(icon: Icons.info_outline, label: 'About NClean', onTap: () => context.push('/content/about')),
              const Divider(height: 1, indent: 56),
              _LinkRow(icon: Icons.description_outlined, label: 'Terms & conditions', onTap: () => context.push('/content/terms')),
              const Divider(height: 1, indent: 56),
              _LinkRow(icon: Icons.privacy_tip_outlined, label: 'Privacy policy', onTap: () => context.push('/content/privacy')),
            ]),
          ),
          const SizedBox(height: 20),
          Center(child: Text('NClean ${Env.appVersion}', style: text.bodySmall?.copyWith(color: AppColors.textMuted))),
        ],
      ),
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.45 : 1,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: Icon(icon, color: AppColors.primary),
          ),
          const SizedBox(height: 8),
          Text(label, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Icon(icon, color: AppColors.secondary),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted),
        onTap: onTap,
      );
}

/// About / Terms / Privacy text from the backend.
class ContentScreen extends ConsumerWidget {
  const ContentScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(contentPageProvider(slug));
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(page.value?.title ?? '')),
      body: AsyncView(
        value: page,
        onRetry: () => ref.invalidate(contentPageProvider(slug)),
        data: (p) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            Text(p.title, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
            if (p.updatedAt != null) ...[
              const SizedBox(height: 4),
              Text('Last updated ${shortDate(p.updatedAt)}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
            ],
            const SizedBox(height: 16),
            SelectableText(p.content, style: text.bodyLarge?.copyWith(height: 1.6)),
          ],
        ),
      ),
    );
  }
}
