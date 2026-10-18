import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../data/address_repository.dart';

/// Saved addresses. With [selectMode] (checkout) tapping one pops it back as the pickup address.
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key, this.selectMode = false, this.selectedId});

  final bool selectMode;
  final String? selectedId;

  Future<void> _run(BuildContext context, Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ApiException.from(e).message)));
    }
  }

  Future<void> _add(BuildContext context) async {
    final saved = await context.push<Address>('/addresses/new');
    if (saved != null && selectMode && context.mounted) context.pop(saved);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressesProvider);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(selectMode ? 'Pickup address' : 'Saved addresses')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.secondary,
        foregroundColor: Colors.white,
        onPressed: () => _add(context),
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add address'),
      ),
      body: addresses.when(
        data: (list) => list.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.home_outlined, size: 64, color: AppColors.primary),
                    const SizedBox(height: 12),
                    Text('No saved addresses', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Text('Add where we should pick up and deliver your clothes.', textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                  ]),
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final a = list[i];
                  final selected = selectMode && a.id == selectedId;
                  return Material(
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: selected ? AppColors.secondary : AppColors.border, width: selected ? 1.6 : 1),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: selectMode ? () => context.pop(a) : null,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Icon(a.label == 'Work' ? Icons.work_outline : (a.label == 'Other' ? Icons.place_outlined : Icons.home_outlined),
                              color: AppColors.secondary),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Text(a.label ?? 'Address', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                                if (a.isDefault) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(6)),
                                    child: Text('Default', style: text.labelSmall),
                                  ),
                                ],
                              ]),
                              const SizedBox(height: 4),
                              Text(a.fullName, style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
                              Text(a.oneLine, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                              if ((a.phone ?? '').isNotEmpty) Text('+91 ${a.phone}', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                            ]),
                          ),
                          PopupMenuButton<String>(
                            onSelected: (v) async {
                              switch (v) {
                                case 'edit':
                                  await context.push('/addresses/${a.id}/edit', extra: a);
                                case 'default':
                                  await _run(context, () => ref.read(addressesProvider.notifier).makeDefault(a.id));
                                case 'delete':
                                  await _run(context, () => ref.read(addressesProvider.notifier).remove(a.id));
                              }
                            },
                            itemBuilder: (_) => [
                              const PopupMenuItem(value: 'edit', child: Text('Edit')),
                              if (!a.isDefault) const PopupMenuItem(value: 'default', child: Text('Make default')),
                              const PopupMenuItem(value: 'delete', child: Text('Delete')),
                            ],
                          ),
                        ]),
                      ),
                    ),
                  );
                },
              ),
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
        error: (e, _) => Center(child: TextButton(onPressed: () => ref.invalidate(addressesProvider), child: Text('$e — try again'))),
      ),
    );
  }
}
