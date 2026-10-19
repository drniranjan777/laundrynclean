import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../address/data/address_repository.dart';
import '../application/pickup_draft.dart';
import '../data/pickup_repository.dart';
import 'pickup_widgets.dart';

/// Schedule Pickup, screen 1: choose a day (tomorrow onwards, within the admin's window) and a time slot.
/// Everything shown comes from the server for the store serving the pickup address; the server checks it all
/// again when the pickup is confirmed.
class SchedulePickupScreen extends ConsumerStatefulWidget {
  const SchedulePickupScreen({super.key});

  @override
  ConsumerState<SchedulePickupScreen> createState() => _SchedulePickupScreenState();
}

class _SchedulePickupScreenState extends ConsumerState<SchedulePickupScreen> {
  void _toast(String message) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  /// The default address (or the first one) until the customer picks another
  Address? _address(List<Address> addresses) {
    final picked = ref.watch(pickupDraftProvider.select((d) => d.address));
    if (picked != null && addresses.any((a) => a.id == picked.id)) return picked;
    if (addresses.isEmpty) return null;
    final fallback = addresses.firstWhere((a) => a.isDefault, orElse: () => addresses.first);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(pickupDraftProvider.notifier).setAddress(fallback);
    });
    return fallback;
  }

  Future<void> _addAddress() async {
    final saved = await context.push<Address>('/addresses/new');
    if (saved != null && mounted) ref.read(pickupDraftProvider.notifier).setAddress(saved);
  }

  Future<void> _changeAddress(Address? current) async {
    final picked = await context.push<Address>('/addresses?select=1&selected=${current?.id ?? ''}');
    if (picked != null && mounted) ref.read(pickupDraftProvider.notifier).setAddress(picked);
  }

  void _next(PickupDraft draft, PickupSlots? slots) {
    if (draft.day == null) return _toast('Choose a day for the pickup');
    if (draft.slot == null) return _toast('Choose a time slot');
    final fresh = slots?.slots.where((s) => s.id == draft.slot!.id).firstOrNull;
    if (fresh == null || !fresh.bookable) {
      ref.read(pickupDraftProvider.notifier).clearSlot();
      return _toast('That slot is no longer available. Please choose another.');
    }
    context.push('/pickup/review');
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final addresses = ref.watch(addressesProvider);
    final draft = ref.watch(pickupDraftProvider);

    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: pickupAppBar(context),
      body: AsyncView<List<Address>>(
        value: addresses,
        onRetry: () => ref.invalidate(addressesProvider),
        data: (list) {
          final address = _address(list);
          if (address == null) {
            return EmptyState(
              icon: Icons.location_on_outlined,
              title: 'Add a pickup address',
              message: 'Tell us where to pick up your clothes. We match you to the nearest NClean store.',
              actionLabel: 'Add address',
              onAction: _addAddress,
            );
          }
          return _Body(address: address, draft: draft, onChangeAddress: () => _changeAddress(address), onNext: _next, text: text);
        },
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.address, required this.draft, required this.onChangeAddress, required this.onNext, required this.text});

  final Address address;
  final PickupDraft draft;
  final VoidCallback onChangeAddress;
  final void Function(PickupDraft, PickupSlots?) onNext;
  final TextTheme text;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(pickupConfigProvider(address.id));
    return AsyncView<PickupConfig>(
      value: config,
      onRetry: () => ref.invalidate(pickupConfigProvider(address.id)),
      data: (c) {
        if (!c.available) {
          return const EmptyState(
            icon: Icons.event_busy_outlined,
            title: 'Schedule Pickup is paused',
            message: 'We aren\'t taking bulk pickup bookings right now. Please check again later.',
          );
        }
        if (c.store == null) {
          return EmptyState(
            icon: Icons.wrong_location_outlined,
            title: 'We don\'t pick up from ${address.pincode} yet',
            message: 'Choose another address served by an NClean store.',
            actionLabel: 'Choose address',
            onAction: onChangeAddress,
          );
        }
        if (!c.storeAcceptsPickups) {
          return EmptyState(
            icon: Icons.storefront_outlined,
            title: '${c.store!.name} isn\'t taking pickups right now',
            message: 'Please try again later, or choose another address.',
            actionLabel: 'Choose address',
            onAction: onChangeAddress,
          );
        }
        return _Booking(address: address, config: c, draft: draft, onChangeAddress: onChangeAddress, onNext: onNext);
      },
    );
  }
}

class _Booking extends ConsumerWidget {
  const _Booking({required this.address, required this.config, required this.draft, required this.onChangeAddress, required this.onNext});

  final Address address;
  final PickupConfig config;
  final PickupDraft draft;
  final VoidCallback onChangeAddress;
  final void Function(PickupDraft, PickupSlots?) onNext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final dates = ref.watch(pickupDatesProvider(address.id));
    final day = draft.day;
    final slots = day == null ? null : ref.watch(pickupSlotsProvider((day.date, address.id)));

    // First visit: preselect the first bookable day
    final days = dates.value?.days ?? const <PickupDay>[];
    if (day == null && days.isNotEmpty) {
      final first = days.where((d) => d.available).firstOrNull;
      if (first != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(pickupDraftProvider.notifier).setDay(first));
      }
    }
    final earliest = config.minAdvanceDays <= 1 ? 'tomorrow onwards' : '${config.minAdvanceDays} days ahead';

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(pickupConfigProvider(address.id));
              ref.invalidate(pickupDatesProvider(address.id));
              if (day != null) ref.invalidate(pickupSlotsProvider((day.date, address.id)));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                Text(
                  'Schedule Pickup',
                  style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.secondary),
                ),
                const SizedBox(height: 2),
                Text('Book a pickup for your bulk laundry order.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                const SizedBox(height: 10),
                _AddressPill(address: address, storeName: config.store!.name, onChange: onChangeAddress),
                const SizedBox(height: 12),
                const BulkInfoCard(),
                const SizedBox(height: 14),
                StepCard(
                  step: 1,
                  title: 'Select Day for Pickup',
                  subtitle: 'You can schedule pickup from $earliest.',
                  child: dates.when(
                    skipLoadingOnRefresh: true,
                    loading: () => const SizedBox(
                      height: 92,
                      child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                    ),
                    error: (e, _) => _Retry(error: e, onRetry: () => ref.invalidate(pickupDatesProvider(address.id))),
                    data: (d) => d.days.isEmpty
                        ? const _Note('No pickup dates are open right now. Please check again later.')
                        : _DayStrip(days: d.days, selected: day?.date),
                  ),
                ),
                const SizedBox(height: 14),
                StepCard(
                  step: 2,
                  title: 'Select Time Slot',
                  subtitle: 'Choose a convenient time slot for our pickup partner.',
                  child: day == null
                      ? const _Note('Choose a day first.')
                      : slots!.when(
                          skipLoadingOnRefresh: true,
                          loading: () => const SizedBox(
                            height: 120,
                            child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                          ),
                          error: (e, _) => _Retry(error: e, onRetry: () => ref.invalidate(pickupSlotsProvider((day.date, address.id)))),
                          data: (s) => !s.available
                              ? _Note(s.reason ?? 'No pickups on this day.')
                              : s.slots.isEmpty
                              ? const _Note('No time slots on this day. Please choose another day.')
                              : _SlotGrid(slots: s.slots, selected: draft.slot?.id),
                        ),
                ),
                const SizedBox(height: 14),
                DeliveryChargeCard(charges: config.charges, memberFreeDelivery: config.memberFreeDelivery),
              ],
            ),
          ),
        ),
        _BottomBar(
          child: FilledButton(
            onPressed: draft.day != null && draft.slot != null ? () => onNext(draft, slots?.value) : null,
            child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('Next'), SizedBox(width: 8), Icon(Icons.arrow_forward, size: 20)]),
          ),
        ),
      ],
    );
  }
}

class _AddressPill extends StatelessWidget {
  const _AddressPill({required this.address, required this.storeName, required this.onChange});

  final Address address;
  final String storeName;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.7)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onChange,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
          child: Row(
            children: [
              const Icon(Icons.location_on, color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pickup from ${address.label ?? 'address'} · $storeName',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.labelMedium?.copyWith(color: AppColors.textMuted),
                    ),
                    Text(
                      address.oneLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              Text(
                'Change',
                style: text.labelLarge?.copyWith(color: AppColors.secondary, fontWeight: FontWeight.w700),
              ),
              const Icon(Icons.chevron_right, color: AppColors.secondary, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontal day picker: weekday, date and a radio dot. Disabled days explain why when tapped.
class _DayStrip extends ConsumerWidget {
  const _DayStrip({required this.days, required this.selected});

  final List<PickupDay> days;
  final String? selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: days.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final d = days[i];
          final on = d.date == selected;
          final color = !d.available ? AppColors.textMuted.withValues(alpha: 0.5) : (on ? AppColors.secondary : AppColors.text);
          return Semantics(
            selected: on,
            button: true,
            enabled: d.available,
            label: '${d.longLabel}${d.available ? '' : ', unavailable: ${d.reason ?? ''}'}',
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () {
                if (!d.available) {
                  ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(SnackBar(content: Text('${d.longLabel}: ${d.reason ?? 'not available'}')));
                  return;
                }
                ref.read(pickupDraftProvider.notifier).setDay(d);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 72,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: on ? AppColors.primary.withValues(alpha: 0.08) : (d.available ? Colors.white : AppColors.surfaceMuted),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: on ? AppColors.primary : AppColors.border.withValues(alpha: 0.8), width: on ? 1.6 : 1),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      d.weekday,
                      style: text.bodySmall?.copyWith(color: color, fontWeight: on ? FontWeight.w700 : FontWeight.w500),
                    ),
                    Text(
                      '${d.dayOfMonth} ${d.month}',
                      style: text.bodyMedium?.copyWith(color: color, fontWeight: FontWeight.w700),
                    ),
                    d.available
                        ? Icon(
                            on ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                            size: 20,
                            color: on ? AppColors.primary : AppColors.border,
                          )
                        : Text(
                            _short(d.reason),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelSmall?.copyWith(color: AppColors.error.withValues(alpha: 0.8)),
                          ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  static String _short(String? reason) {
    final r = (reason ?? '').toLowerCase();
    if (r.contains('closed on this day')) return 'Closed';
    if (r.contains('ahead')) return 'Too soon';
    if (r.contains('paused')) return 'Paused';
    return 'Holiday';
  }
}

/// Two-column slot cards: selected / available / full / unavailable.
class _SlotGrid extends ConsumerWidget {
  const _SlotGrid({required this.slots, required this.selected});

  final List<PickupSlotOption> slots;
  final String? selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return LayoutBuilder(
      builder: (context, box) {
        final columns = box.maxWidth < 300 ? 1 : 2;
        final width = (box.maxWidth - (columns - 1) * 10) / columns;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final s in slots)
              SizedBox(
                width: width,
                child: Semantics(
                  button: true,
                  selected: s.id == selected,
                  enabled: s.bookable,
                  label: '${s.label}${s.bookable ? '' : (s.status == SlotStatus.full ? ', fully booked' : ', unavailable')}',
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: s.bookable
                        ? () => ref.read(pickupDraftProvider.notifier).setSlot(s)
                        : () => ScaffoldMessenger.of(context)
                            ..hideCurrentSnackBar()
                            ..showSnackBar(
                              SnackBar(
                                content: Text(
                                  s.status == SlotStatus.full
                                      ? '${s.label} is fully booked. Please choose another slot.'
                                      : '${s.label} is unavailable on this day.',
                                ),
                              ),
                            ),
                    child: _SlotCard(slot: s, selected: s.id == selected, text: text),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SlotCard extends StatelessWidget {
  const _SlotCard({required this.slot, required this.selected, required this.text});

  final PickupSlotOption slot;
  final bool selected;
  final TextTheme text;

  @override
  Widget build(BuildContext context) {
    final enabled = slot.bookable;
    final fg = !enabled ? AppColors.textMuted.withValues(alpha: 0.6) : AppColors.secondary;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: selected ? AppColors.primary.withValues(alpha: 0.08) : (enabled ? Colors.white : AppColors.surfaceMuted),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: selected ? AppColors.primary : AppColors.border.withValues(alpha: 0.8), width: selected ? 1.6 : 1),
      ),
      child: Column(
        children: [
          Icon(Icons.schedule, color: fg, size: 22),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              slot.label,
              style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: enabled ? AppColors.text : fg),
            ),
          ),
          const SizedBox(height: 6),
          if (enabled)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  size: 20,
                  color: selected ? AppColors.primary : AppColors.border,
                ),
                if (slot.remaining > 0 && slot.remaining <= 3) ...[
                  const SizedBox(width: 6),
                  Text(
                    '${slot.remaining} left',
                    style: text.labelSmall?.copyWith(color: const Color(0xFFB45309), fontWeight: FontWeight.w700),
                  ),
                ],
              ],
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: AppColors.error.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10)),
              child: Text(
                slot.status == SlotStatus.full ? 'Full' : 'Unavailable',
                style: text.labelSmall?.copyWith(color: AppColors.error, fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.message);

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        const Icon(Icons.info_outline, size: 18, color: AppColors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(message, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted)),
        ),
      ],
    ),
  );
}

class _Retry extends StatelessWidget {
  const _Retry({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text('$error', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.error)),
      ),
      TextButton(onPressed: onRetry, child: const Text('Try again')),
    ],
  );
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
    decoration: const BoxDecoration(
      color: Colors.white,
      boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))],
    ),
    child: SafeArea(top: false, child: child),
  );
}
