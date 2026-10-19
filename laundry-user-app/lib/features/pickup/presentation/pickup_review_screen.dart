import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/ui_kit.dart';
import '../../address/data/address_repository.dart';
import '../../checkout/data/razorpay_checkout.dart';
import '../../orders/data/orders_repository.dart';
import '../application/pickup_draft.dart';
import '../data/pickup_repository.dart';
import 'pickup_widgets.dart';

/// Schedule Pickup, screen 2: pickup details (store, address, date and slot), what is known about the price,
/// the rules, payment method, then Confirm. The server validates and reserves the slot; nothing is assumed here.
class PickupReviewScreen extends ConsumerStatefulWidget {
  const PickupReviewScreen({super.key});

  @override
  ConsumerState<PickupReviewScreen> createState() => _PickupReviewScreenState();
}

class _PickupReviewScreenState extends ConsumerState<PickupReviewScreen> {
  bool _busy = false;
  late final TextEditingController _notes = TextEditingController(text: ref.read(pickupDraftProvider).notes);

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  void _toast(String message) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  /// The store follows the address: a new address may mean a new store, so the day and slot are chosen again.
  Future<void> _changeAddress(PickupDraft draft) async {
    final picked = await context.push<Address>('/addresses?select=1&selected=${draft.address?.id ?? ''}');
    if (picked == null || !mounted || picked.id == draft.address?.id) return;
    ref.read(pickupDraftProvider.notifier).setAddress(picked);
    _toast('Address changed. Choose the day and time again for this address.');
    context.pop();
  }

  void _storeInfo(PickupDraft draft, PickupConfig config) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Your store', style: Theme.of(c).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(
                '${config.store?.name ?? 'The nearest store'} serves pincode ${draft.address?.pincode ?? ''}. To be served by another store, choose a pickup address in its area.',
                style: Theme.of(c).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  Navigator.pop(c);
                  _changeAddress(draft);
                },
                child: const Text('Choose another address'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirm(PickupDraft draft) async {
    FocusScope.of(context).unfocus();
    ref.read(pickupDraftProvider.notifier).setNotes(_notes.text);
    setState(() => _busy = true);
    try {
      final booked = await ref
          .read(pickupRepositoryProvider)
          .book(
            addressId: draft.address!.id,
            pickupDate: draft.day!.date,
            timeSlotId: draft.slot!.id,
            payment: draft.payment,
            idempotencyKey: draft.idempotencyKey,
            notes: _notes.text,
          );
      ref.invalidate(ordersProvider);
      ref.invalidate(pickupSlotsProvider((draft.day!.date, draft.address!.id)));
      ref.read(pickupDraftProvider.notifier).reset();
      if (mounted) context.go('/pickup/booked', extra: (booked: booked, dayName: draft.day!.dayName));
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
      // The slot filled up or the date closed meanwhile: back to screen 1 with fresh availability
      if (e.statusCode == 400 || e.statusCode == 404) {
        ref.invalidate(pickupDatesProvider(draft.address!.id));
        ref.invalidate(pickupSlotsProvider((draft.day!.date, draft.address!.id)));
        ref.read(pickupDraftProvider.notifier).clearSlot();
        context.pop();
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(pickupDraftProvider);
    if (!draft.readyForReview) {
      return Scaffold(
        appBar: pickupAppBar(context),
        body: EmptyState(icon: Icons.event_note_outlined, title: 'Choose a day and time first', actionLabel: 'Back', onAction: () => context.pop()),
      );
    }
    final config = ref.watch(pickupConfigProvider(draft.address!.id));
    return Scaffold(
      backgroundColor: AppColors.surfaceMuted,
      appBar: pickupAppBar(context),
      body: AsyncView<PickupConfig>(
        value: config,
        onRetry: () => ref.invalidate(pickupConfigProvider(draft.address!.id)),
        data: (c) => _content(context, draft, c),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))],
        ),
        child: SafeArea(
          top: false,
          child: FilledButton(
            onPressed: _busy || config.value?.available != true ? null : () => _confirm(draft),
            child: _busy
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.6, color: Colors.white))
                : const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [Icon(Icons.check_circle, size: 22), SizedBox(width: 10), Text('Confirm Pickup')],
                  ),
          ),
        ),
      ),
    );
  }

  Widget _content(BuildContext context, PickupDraft draft, PickupConfig c) {
    final text = Theme.of(context).textTheme;
    final charges = c.charges;
    final chargeText = charges.isFree
        ? 'Free'
        : c.memberFreeDelivery
        ? 'Free (membership)'
        : '${rupees(charges.charge)} if below ${rupees(charges.freeAbove)}';
    final rules = <(IconData, String)>[
      // The admin's policies describe the service; this line is only for when there are none
      if (c.policies.isEmpty) (Icons.inventory_2_outlined, 'Schedule pickup is only for bulk orders.'),
      if (!charges.isFree) (Icons.person_outline, 'Minimum order value for free pickup: ${rupees(charges.freeAbove)}.'),
      (
        Icons.schedule,
        c.minAdvanceDays <= 1 ? 'You can schedule pickup from tomorrow onwards.' : 'Pickups are booked at least ${c.minAdvanceDays} days ahead.',
      ),
      (Icons.verified_user_outlined, 'Our pickup partner will visit at the selected time slot.'),
      if ((c.instructions ?? '').trim().isNotEmpty)
        (Icons.info_outline, c.instructions!.trim())
      else
        (Icons.info_outline, 'Please keep your clothes ready and packed.'),
      for (final p in c.policies) (Icons.check_circle_outline, p),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        StepCard(
          step: 3,
          title: 'Pickup Details',
          subtitle: 'Confirm your store and address for pickup.',
          child: Column(
            children: [
              DetailTile(
                icon: Icons.storefront_outlined,
                title: c.store?.name ?? 'Store',
                subtitle: c.store?.city,
                action: 'Change',
                onAction: () => _storeInfo(draft, c),
              ),
              const SizedBox(height: 10),
              DetailTile(
                icon: Icons.location_on_outlined,
                title: 'Pickup Address',
                subtitle: '${draft.address!.fullName}\n${draft.address!.oneLine}',
                action: 'Change',
                onAction: () => _changeAddress(draft),
              ),
              const SizedBox(height: 10),
              DetailTile(
                icon: Icons.event_available_outlined,
                title: draft.day!.longLabel,
                subtitle: draft.slot!.label,
                action: 'Change',
                onAction: () => context.pop(),
              ),
              const SizedBox(height: 10),
              const DetailTile(
                icon: Icons.local_laundry_service_outlined,
                title: 'Bulk Pickup',
                subtitle: 'Clothes are counted and billed at the store after pickup',
              ),
              const SizedBox(height: 12),
              DeliveryChargeCard(charges: charges, memberFreeDelivery: c.memberFreeDelivery),
            ],
          ),
        ),
        const SizedBox(height: 14),
        StepCard(
          step: 4,
          title: 'Order Summary & Rules',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
                decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(14)),
                child: Column(
                  children: [
                    const KeyValueRow('Estimated amount', 'Billed after pickup'),
                    KeyValueRow('Pickup & delivery', chargeText),
                    if (c.memberDiscountPercent > 0)
                      KeyValueRow(
                        'Member discount',
                        '${c.memberDiscountPercent.toStringAsFixed(c.memberDiscountPercent % 1 == 0 ? 0 : 1)}% off the bill',
                        valueColor: const Color(0xFF16A34A),
                      ),
                    const KeyValueRow('Taxes', 'As applicable on the bill'),
                    const Divider(height: 16),
                    KeyValueRow('Payable now', rupees(0), bold: true),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'The final amount is worked out by the store when your clothes are counted. You\'ll see the bill in your order.',
                style: text.bodySmall?.copyWith(color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(14)),
                child: Column(
                  children: [
                    for (final r in rules)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 5),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(r.$1, size: 18, color: AppColors.secondary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(r.$2, style: text.bodySmall?.copyWith(color: AppColors.text, height: 1.4)),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('Payment method', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (final m in PickupPayment.values) ...[
                _PaymentOption(
                  method: m,
                  selected: draft.payment == m,
                  note: m == PickupPayment.online && !RazorpayCheckout.isSupported ? 'Pay from the NClean app on your phone' : null,
                  onTap: () => ref.read(pickupDraftProvider.notifier).setPayment(m),
                ),
                const SizedBox(height: 8),
              ],
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    const Icon(Icons.verified_user, color: AppColors.primary, size: 26),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Cash on Delivery & Online Payment',
                            style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.secondary),
                          ),
                          Text(
                            'Nothing is charged now. Pay when your clothes come back, or online once the bill is ready.',
                            style: text.bodySmall?.copyWith(color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _notes,
                maxLength: 500,
                minLines: 2,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (v) => ref.read(pickupDraftProvider.notifier).setNotes(v),
                decoration: const InputDecoration(
                  labelText: 'Instructions for the pickup partner (optional)',
                  hintText: 'e.g. 3 bags at the security desk',
                  alignLabelWithHint: true,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({required this.method, required this.selected, required this.onTap, this.note});

  final PickupPayment method;
  final bool selected;
  final VoidCallback onTap;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary.withValues(alpha: 0.06) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.6 : 1),
          ),
          child: Row(
            children: [
              Icon(method == PickupPayment.cod ? Icons.payments_outlined : Icons.qr_code_2, color: AppColors.secondary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(method.label, style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
                    Text(note ?? method.hint, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
                  ],
                ),
              ),
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: selected ? AppColors.primary : AppColors.border),
            ],
          ),
        ),
      ),
    );
  }
}
