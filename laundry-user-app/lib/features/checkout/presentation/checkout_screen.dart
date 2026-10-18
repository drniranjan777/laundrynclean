import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/primary_button.dart';
import '../../address/data/address_repository.dart';
import '../../auth/application/session_controller.dart';
import '../../cart/application/cart_controller.dart';
import '../../cart/data/cart_models.dart';
import '../../cart/data/cart_repository.dart';
import '../data/checkout_repository.dart';
import '../data/razorpay_checkout.dart';

/// Schedule pickup: address → date & slot (capacity of the store serving that address) → promo →
/// payment → disclaimer → place order (POST /bookings/confirm, then Razorpay for UPI / card).
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  Address? _address;
  String? _date;
  PickupSlot? _slot;
  AppliedPromo? _promo;
  PaymentMethod _method = PaymentMethod.cod;
  bool _agreed = false;
  bool _placing = false;
  bool _applyingPromo = false;
  String? _promoError;
  final _promoCode = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _promoCode.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _toast(String message) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));

  Future<void> _changeAddress() async {
    final picked = await context.push<Address>('/addresses?select=1&selected=${_address?.id ?? ''}');
    if (picked != null && picked.id != _address?.id) {
      setState(() {
        _address = picked;
        _slot = null; // slots and prices depend on the store serving the address
        _promo = null;
      });
    }
  }

  /// No saved address yet: straight to the form, and use the new address for this pickup.
  Future<void> _addFirstAddress() async {
    final saved = await context.push<Address>('/addresses/new');
    if (saved != null && mounted) setState(() => _address = saved);
  }

  Future<void> _applyPromo(Cart cart) async {
    final code = _promoCode.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _applyingPromo = true;
      _promoError = null;
    });
    try {
      final promo = await ref.read(checkoutRepositoryProvider).applyPromo(code, cart.subtotal);
      if (!mounted) return;
      setState(() => _promo = promo);
      FocusScope.of(context).unfocus();
    } on ApiException catch (e) {
      setState(() => _promoError = e.message);
    } finally {
      if (mounted) setState(() => _applyingPromo = false);
    }
  }

  double _total(Cart cart) => (cart.subtotal - (_promo?.discount ?? 0) + cart.deliveryFee).clamp(0, double.infinity).toDouble();

  Future<void> _place(Cart cart, bool needsDisclaimer) async {
    final problem = _address == null
        ? 'Choose a pickup address'
        : _date == null || _slot == null
            ? 'Choose a pickup date and time'
            : cart.lines.any((l) => !l.isAvailable)
                ? 'Remove the items your store doesn\'t offer'
                : needsDisclaimer && !_agreed
                    ? 'Please accept the terms to continue'
                    : null;
    if (problem != null) return _toast(problem);

    setState(() => _placing = true);
    final repo = ref.read(checkoutRepositoryProvider);
    try {
      final order = await repo.confirm(
        addressId: _address!.id,
        pickupDate: _date!,
        timeSlotId: _slot!.id,
        method: _method,
        promoCode: _promo?.code,
        notes: _notes.text,
        disclaimerAccepted: _agreed || !needsDisclaimer,
      );
      ref.invalidate(cartProvider); // the backend emptied the cart

      var paid = order.paymentStatus == 'paid';
      String? paymentNote;
      if (order.payment != null) {
        final user = ref.read(sessionProvider).user;
        try {
          final result = await RazorpayCheckout().pay(order.payment!,
              description: 'Order ${order.orderNumber}', name: user?.name, phone: user?.phone, email: user?.email);
          await repo.verifyPayment(order.id, orderId: result.orderId, paymentId: result.paymentId, signature: result.signature);
          paid = true;
        } on ApiException catch (e) {
          paymentNote = '${e.message} Your order is saved; the store will contact you about payment.';
        }
      }
      if (mounted) context.go('/order-placed', extra: (order: order, paid: paid, note: paymentNote));
    } on ApiException catch (e) {
      _toast(e.message);
      // A full slot: show the fresh counts
      if (_address != null && _date != null) ref.invalidate(pickupSlotsProvider((_date!, _address!.id)));
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final addresses = ref.watch(addressesProvider);
    // Start with the default address once the list arrives
    final list = addresses.value ?? const <Address>[];
    if (_address == null && list.isNotEmpty) _address = list.firstWhere((a) => a.isDefault, orElse: () => list.first);

    if (addresses.isLoading && _address == null) {
      return Scaffold(appBar: AppBar(title: const Text('Schedule pickup')), body: const Center(child: CircularProgressIndicator(color: AppColors.secondary)));
    }
    if (_address == null) return _NoAddress(onAdd: _addFirstAddress);

    final cart = ref.watch(checkoutCartProvider(_address!.id));
    final disclaimer = ref.watch(disclaimerProvider).value;
    final balance = ref.watch(walletBalanceProvider).value ?? 0;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Schedule pickup')),
      body: cart.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.secondary)),
        error: (e, _) => Center(child: TextButton(onPressed: () => ref.invalidate(checkoutCartProvider(_address!.id)), child: Text('$e — try again'))),
        data: (c) {
          if (c.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Your cart is empty'),
              TextButton(onPressed: () => context.go('/home'), child: const Text('Browse items')),
            ]));
          }
          final total = _total(c);
          final unavailable = c.lines.where((l) => !l.isAvailable).toList();
          return Column(children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _Section(
                    title: 'Pickup address',
                    trailing: TextButton(onPressed: _changeAddress, child: const Text('Change')),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${_address!.label ?? 'Address'} · ${_address!.fullName}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                      Text(_address!.oneLine, style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
                      if (c.storeName != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text('Served by ${c.storeName}', style: text.bodySmall?.copyWith(color: AppColors.secondary)),
                        ),
                    ]),
                  ),
                  _Section(title: 'Pickup date & time', child: _SlotPicker(
                    addressId: _address!.id,
                    date: _date,
                    slot: _slot,
                    onDate: (d) => setState(() {
                      _date = d;
                      _slot = null;
                    }),
                    onSlot: (s) => setState(() => _slot = s),
                  )),
                  _Section(
                    title: 'Items (${c.totalQuantity})',
                    trailing: TextButton(onPressed: () => context.go('/cart'), child: const Text('Edit')),
                    child: Column(children: [
                      for (final l in c.lines)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(children: [
                            Expanded(
                              child: Text('${l.quantity} × ${l.item.name}${l.options.isEmpty ? '' : ' (${l.options})'}',
                                  style: text.bodyMedium?.copyWith(
                                      color: l.isAvailable ? null : AppColors.error, decoration: l.isAvailable ? null : TextDecoration.lineThrough)),
                            ),
                            Text(rupees(l.lineTotal), style: text.bodyMedium),
                          ]),
                        ),
                      if (unavailable.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text('${c.storeName ?? 'This store'} doesn\'t offer the crossed-out items. Remove them from your cart to book.',
                              style: text.bodySmall?.copyWith(color: AppColors.error)),
                        ),
                    ]),
                  ),
                  _Section(
                    title: 'Offer code',
                    child: _promo != null
                        ? Row(children: [
                            const Icon(Icons.local_offer_outlined, color: Color(0xFF16A34A)),
                            const SizedBox(width: 8),
                            Expanded(child: Text('${_promo!.code} applied · you save ${rupees(_promo!.discount)}', style: text.bodyMedium)),
                            TextButton(onPressed: () => setState(() => _promo = null), child: const Text('Remove')),
                          ])
                        : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Expanded(
                              child: TextField(
                                controller: _promoCode,
                                textCapitalization: TextCapitalization.characters,
                                decoration: InputDecoration(hintText: 'Enter code', isDense: true, errorText: _promoError, errorMaxLines: 2),
                                onSubmitted: (_) => _applyPromo(c),
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              height: 48,
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(minimumSize: const Size(88, 48)),
                                onPressed: _applyingPromo ? null : () => _applyPromo(c),
                                child: _applyingPromo ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Apply'),
                              ),
                            ),
                          ]),
                  ),
                  _Section(
                    title: 'Instructions for pickup (optional)',
                    child: TextField(
                      controller: _notes,
                      maxLines: 2,
                      maxLength: 300,
                      decoration: const InputDecoration(hintText: 'e.g. Ring the bell twice, handle the silk saree with care', isDense: true),
                    ),
                  ),
                  _Section(
                    title: 'Payment',
                    child: Column(children: [
                      for (final m in PaymentMethod.values)
                        _PaymentOption(
                          method: m,
                          selected: _method == m,
                          enabled: switch (m) {
                            PaymentMethod.wallet => balance >= total,
                            PaymentMethod.online => RazorpayCheckout.isSupported,
                            PaymentMethod.cod => true,
                          },
                          note: switch (m) {
                            PaymentMethod.wallet => 'Balance ${rupees(balance)}${balance < total ? ' · not enough for this order' : ''}',
                            PaymentMethod.online => RazorpayCheckout.isSupported ? null : 'Available in the app on your phone',
                            PaymentMethod.cod => null,
                          },
                          onTap: () => setState(() => _method = m),
                        ),
                    ]),
                  ),
                  if (disclaimer != null)
                    _DisclaimerTile(disclaimer: disclaimer, agreed: _agreed, onChanged: (v) => setState(() => _agreed = v)),
                  const SizedBox(height: 8),
                ],
              ),
            ),
            _BillBar(
              cart: c,
              discount: _promo?.discount ?? 0,
              total: total,
              placing: _placing,
              label: _method == PaymentMethod.online ? 'Pay ${rupees(total)}' : 'Place order · ${rupees(total)}',
              onPlace: () => _place(c, disclaimer != null),
            ),
          ]);
        },
      ),
    );
  }
}

class _NoAddress extends StatelessWidget {
  const _NoAddress({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Schedule pickup')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.add_location_alt_outlined, size: 64, color: AppColors.primary),
            const SizedBox(height: 12),
            Text('Where should we pick up?', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text('Add your address to see pickup times.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
            const SizedBox(height: 20),
            SizedBox(width: 220, child: FilledButton(onPressed: onAdd, child: const Text('Add address'))),
          ]),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
      decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
          ?trailing,
        ]),
        const SizedBox(height: 6),
        child,
      ]),
    );
  }
}

class _SlotPicker extends ConsumerWidget {
  const _SlotPicker({required this.addressId, required this.date, required this.slot, required this.onDate, required this.onSlot});

  final String addressId;
  final String? date;
  final PickupSlot? slot;
  final ValueChanged<String> onDate;
  final ValueChanged<PickupSlot> onSlot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dates = ref.watch(pickupDatesProvider);
    final text = Theme.of(context).textTheme;
    return dates.when(
      loading: () => const LinearProgressIndicator(),
      error: (e, _) => Text('$e'),
      data: (list) {
        final current = date ?? (list.isNotEmpty ? list.first.date : null);
        if (date == null && current != null) WidgetsBinding.instance.addPostFrameCallback((_) => onDate(current));
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final d in list)
              ChoiceChip(
                label: Text(d.display),
                selected: d.date == current,
                showCheckmark: false,
                selectedColor: AppColors.secondary,
                backgroundColor: Colors.white,
                labelStyle: TextStyle(color: d.date == current ? Colors.white : AppColors.text),
                shape: StadiumBorder(side: BorderSide(color: d.date == current ? AppColors.secondary : AppColors.border)),
                onSelected: (_) => onDate(d.date),
              ),
          ]),
          const SizedBox(height: 10),
          if (current != null)
            ref.watch(pickupSlotsProvider((current, addressId))).when(
                  loading: () => const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator()),
                  error: (e, _) => Text('$e', style: text.bodySmall?.copyWith(color: AppColors.error)),
                  data: (slots) => slots.isEmpty
                      ? Text('No pickup times on this day.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted))
                      : Column(children: [
                          for (final s in slots)
                            _SlotTile(slot: s, selected: slot?.id == s.id, onTap: s.available ? () => onSlot(s) : null),
                        ]),
                ),
        ]);
      },
    );
  }
}

class _SlotTile extends StatelessWidget {
  const _SlotTile({required this.slot, required this.selected, required this.onTap});

  final PickupSlot slot;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final full = !slot.available;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? AppColors.secondary.withValues(alpha: 0.08) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: selected ? AppColors.secondary : AppColors.border, width: selected ? 1.6 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: full ? AppColors.border : AppColors.secondary),
              const SizedBox(width: 10),
              Expanded(child: Text(slot.label, style: text.bodyLarge?.copyWith(color: full ? AppColors.textMuted : null))),
              Text(
                full ? 'Full' : (slot.remaining <= 3 ? '${slot.remaining} left' : 'Available'),
                style: text.bodySmall?.copyWith(color: full ? AppColors.error : (slot.remaining <= 3 ? const Color(0xFFB45309) : const Color(0xFF16A34A))),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({required this.method, required this.selected, required this.enabled, required this.onTap, this.note});

  final PaymentMethod method;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final icon = switch (method) {
      PaymentMethod.cod => Icons.payments_outlined,
      PaymentMethod.wallet => Icons.account_balance_wallet_outlined,
      PaymentMethod.online => Icons.credit_card,
    };
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            Icon(selected && enabled ? Icons.radio_button_checked : Icons.radio_button_off, color: AppColors.secondary),
            const SizedBox(width: 10),
            Icon(icon, color: AppColors.textMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(method.label, style: text.bodyLarge?.copyWith(fontWeight: FontWeight.w500)),
                Text(note ?? method.hint, style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _DisclaimerTile extends StatelessWidget {
  const _DisclaimerTile({required this.disclaimer, required this.agreed, required this.onChanged});

  final Disclaimer disclaimer;
  final bool agreed;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: AppColors.surfaceMuted, borderRadius: BorderRadius.circular(16)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Checkbox(value: agreed, activeColor: AppColors.secondary, onChanged: (v) => onChanged(v ?? false)),
          title: Text('I agree to the ${disclaimer.title.toLowerCase()}', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
          subtitle: Text('Tap to read', style: text.bodySmall?.copyWith(color: AppColors.textMuted)),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [Text(disclaimer.content, style: text.bodySmall?.copyWith(height: 1.4))],
        ),
      ),
    );
  }
}

class _BillBar extends StatelessWidget {
  const _BillBar({required this.cart, required this.discount, required this.total, required this.placing, required this.label, required this.onPlace});

  final Cart cart;
  final double discount;
  final double total;
  final bool placing;
  final String label;
  final VoidCallback onPlace;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget row(String l, String v, {Color? color, bool bold = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(children: [
            Text(l, style: (bold ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700) : text.bodyMedium)?.copyWith(color: color)),
            const Spacer(),
            Text(v, style: (bold ? text.titleMedium?.copyWith(fontWeight: FontWeight.w700) : text.bodyMedium)?.copyWith(color: color)),
          ]),
        );
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
      decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          row('Subtotal', rupees(cart.subtotal)),
          row('Pickup & delivery', cart.deliveryFee == 0 ? 'Free' : rupees(cart.deliveryFee)),
          if (discount > 0) row('Offer', '- ${rupees(discount)}', color: const Color(0xFF16A34A)),
          const Divider(height: 14),
          row('Total', rupees(total), bold: true),
          const SizedBox(height: 10),
          PrimaryButton(label: label, loading: placing, onPressed: onPlace),
        ]),
      ),
    );
  }
}
