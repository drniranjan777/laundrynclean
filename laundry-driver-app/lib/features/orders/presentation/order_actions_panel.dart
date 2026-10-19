import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/primary_button.dart';
import '../data/driver_order.dart';
import '../data/order_actions.dart';

void _toast(BuildContext context, String message) => ScaffoldMessenger.of(context)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(message)));

/// The buttons for what the driver does next with this order.
class OrderActionsPanel extends ConsumerWidget {
  const OrderActionsPanel({super.key, required this.order});

  final DriverOrder order;

  Future<void> _simple(BuildContext context, WidgetRef ref, {required String title, required String body, required String status, required String done}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(orderActionsProvider).setStatus(order.id, status);
      if (context.mounted) _toast(context, done);
    } on ApiException catch (e) {
      if (context.mounted) _toast(context, e.message);
    }
  }

  void _sheet(BuildContext context, Widget child) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (_) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: child),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    Widget two(String failLabel, VoidCallback onFail, String okLabel, VoidCallback onOk) => Row(children: [
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)),
              onPressed: onFail,
              child: Text(failLabel),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: FilledButton(onPressed: onOk, child: Text(okLabel))),
        ]);

    final Widget content;
    if (order.atPickup) {
      content = two(
        "Couldn't pick up",
        () => _sheet(context, FailedSheet(order: order, reasons: pickupFailureReasons, title: "Couldn't pick up")),
        'Picked up',
        () => _sheet(context, PickedUpSheet(order: order)),
      );
    } else if (order.status == 'picked_up') {
      content = PrimaryButton(
        label: 'Handed to store',
        onPressed: () => _simple(context, ref,
            title: 'Handed to store?', body: 'Confirm the clothes are with ${order.store?.name ?? 'the store'}.', status: 'in_process', done: 'Marked as handed to the store'),
      );
    } else if (order.status == 'in_process') {
      content = Text('At the store. It moves to your Deliveries once the store marks it ready.',
          textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: AppColors.textMuted));
    } else if (order.readyToDeliver) {
      content = PrimaryButton(
        label: 'Start delivery',
        onPressed: () => _simple(context, ref,
            title: 'Start delivery?', body: 'The customer\'s order will show as out for delivery.', status: 'out_for_delivery', done: 'Out for delivery'),
      );
    } else if (order.outForDelivery) {
      content = two(
        "Couldn't deliver",
        () => _sheet(context, FailedSheet(order: order, reasons: deliveryFailureReasons, title: "Couldn't deliver")),
        'Delivered',
        () => _sheet(context, DeliveredSheet(order: order)),
      );
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
      child: SafeArea(top: false, child: content),
    );
  }
}

/// Optional proof photo: camera on a phone (the file picker on web).
class PhotoPicker extends StatelessWidget {
  const PhotoPicker({super.key, required this.photo, required this.onChanged, this.label = 'Add photo (optional)'});

  final ProofPhoto? photo;
  final ValueChanged<ProofPhoto?> onChanged;
  final String label;

  Future<void> _take(BuildContext context) async {
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1280, imageQuality: 70);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final mime = file.mimeType ?? (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      onChanged(ProofPhoto(bytes, mimeType: mime));
    } catch (_) {
      if (context.mounted) _toast(context, "Couldn't open the camera");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (photo == null) {
      return OutlinedButton.icon(onPressed: () => _take(context), icon: const Icon(Icons.photo_camera_outlined), label: Text(label));
    }
    return Row(children: [
      ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.memory(photo!.bytes, width: 64, height: 64, fit: BoxFit.cover)),
      const SizedBox(width: 12),
      const Expanded(child: Text('Photo added')),
      TextButton(onPressed: () => onChanged(null), child: const Text('Remove')),
    ]);
  }
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          ...children,
        ]),
      ),
    );
  }
}

/// Picked up: confirm the piece count, note any damage, optional photo.
class PickedUpSheet extends ConsumerStatefulWidget {
  const PickedUpSheet({super.key, required this.order});

  final DriverOrder order;

  @override
  ConsumerState<PickedUpSheet> createState() => _PickedUpSheetState();
}

class _PickedUpSheetState extends ConsumerState<PickedUpSheet> {
  late int _count = widget.order.itemCount;
  final _note = TextEditingController();
  ProofPhoto? _photo;
  bool _saving = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(orderActionsProvider).setStatus(widget.order.id, 'picked_up', itemCount: _count, note: _note.text, photo: _photo);
      if (!mounted) return;
      Navigator.pop(context);
      _toast(context, 'Picked up $_count piece${_count == 1 ? '' : 's'}');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final mismatch = _count != widget.order.itemCount;
    return _SheetFrame(title: 'Picked up', children: [
      Row(children: [
        Expanded(child: Text('Pieces collected', style: text.titleSmall)),
        IconButton.outlined(onPressed: _count > 0 ? () => setState(() => _count--) : null, icon: const Icon(Icons.remove)),
        SizedBox(width: 48, child: Text('$_count', textAlign: TextAlign.center, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
        IconButton.outlined(onPressed: () => setState(() => _count++), icon: const Icon(Icons.add)),
      ]),
      if (widget.order.isBulkPickup && widget.order.items.isEmpty)
        Text('Bulk pickup: count every piece (or bag) you collect. The store bills the order after counting.',
            style: text.bodySmall?.copyWith(color: AppColors.textMuted))
      else
        Text(mismatch ? 'The order says ${widget.order.itemCount}. Add a note about the difference.' : 'Matches the order (${widget.order.itemCount}).',
            style: text.bodySmall?.copyWith(color: mismatch ? const Color(0xFFB45309) : AppColors.textMuted)),
      const SizedBox(height: 12),
      TextField(controller: _note, maxLength: 500, maxLines: 2, decoration: const InputDecoration(hintText: 'Note (e.g. stain on one shirt)', isDense: true)),
      PhotoPicker(photo: _photo, onChanged: (p) => setState(() => _photo = p), label: 'Photo of the clothes (optional)'),
      const SizedBox(height: 16),
      PrimaryButton(label: 'Confirm pickup', loading: _saving, onPressed: _save),
    ]);
  }
}

/// Delivered: collect cash for unpaid COD orders (D4), optional proof photo (D5).
class DeliveredSheet extends ConsumerStatefulWidget {
  const DeliveredSheet({super.key, required this.order});

  final DriverOrder order;

  @override
  ConsumerState<DeliveredSheet> createState() => _DeliveredSheetState();
}

class _DeliveredSheetState extends ConsumerState<DeliveredSheet> {
  late final _cash = TextEditingController(text: widget.order.amountToCollect > 0 ? _plain(widget.order.amountToCollect) : '');
  late final _receiver = TextEditingController(text: widget.order.customerName ?? '');
  final _note = TextEditingController();
  ProofPhoto? _photo;
  bool _saving = false;
  String? _cashError;

  static String _plain(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(2);

  @override
  void dispose() {
    _cash.dispose();
    _receiver.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final due = widget.order.amountToCollect;
    double? cash;
    if (due > 0) {
      cash = double.tryParse(_cash.text.trim());
      if (cash == null || cash < due) {
        setState(() => _cashError = 'Collect at least ${rupees(due)}');
        return;
      }
    }
    setState(() {
      _saving = true;
      _cashError = null;
    });
    try {
      await ref
          .read(orderActionsProvider)
          .setStatus(widget.order.id, 'delivered', cashCollected: cash, note: _note.text, photo: _photo, receiverName: _receiver.text);
      if (!mounted) return;
      Navigator.pop(context);
      _toast(context, cash != null ? 'Delivered · ${rupees(cash)} collected' : 'Delivered');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final due = widget.order.amountToCollect;
    return _SheetFrame(title: 'Delivered', children: [
      if (due > 0) ...[
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFFF4E5), borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            const Icon(Icons.payments_outlined, color: Color(0xFFB45309)),
            const SizedBox(width: 10),
            Expanded(child: Text('Collect ${rupees(due)} in cash', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: const Color(0xFF92400E)))),
          ]),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _cash,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
          decoration: InputDecoration(labelText: 'Cash collected (₹)', errorText: _cashError, isDense: true),
        ),
        const SizedBox(height: 12),
      ] else
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text('Already paid (${widget.order.paymentLabel}). Nothing to collect.', style: text.bodyMedium?.copyWith(color: AppColors.textMuted)),
        ),
      TextField(
        controller: _receiver,
        maxLength: 100,
        textCapitalization: TextCapitalization.words,
        decoration: const InputDecoration(labelText: 'Received by', hintText: 'Customer, family member, security…', isDense: true),
      ),
      TextField(controller: _note, maxLength: 500, maxLines: 2, decoration: const InputDecoration(hintText: 'Note (optional, e.g. handed to security)', isDense: true)),
      PhotoPicker(photo: _photo, onChanged: (p) => setState(() => _photo = p), label: 'Proof photo (optional)'),
      const SizedBox(height: 16),
      PrimaryButton(label: due > 0 ? 'Cash collected · mark delivered' : 'Mark delivered', loading: _saving, onPressed: _save),
    ]);
  }
}

/// A pickup or delivery that couldn't be done (D3): reason, note, optional photo.
class FailedSheet extends ConsumerStatefulWidget {
  const FailedSheet({super.key, required this.order, required this.reasons, required this.title});

  final DriverOrder order;
  final List<String> reasons;
  final String title;

  @override
  ConsumerState<FailedSheet> createState() => _FailedSheetState();
}

class _FailedSheetState extends ConsumerState<FailedSheet> {
  String? _reason;
  final _note = TextEditingController();
  ProofPhoto? _photo;
  bool _saving = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_reason == null) return _toast(context, 'Choose a reason');
    if (_reason == 'Other' && _note.text.trim().isEmpty) return _toast(context, 'Add a short note for "Other"');
    setState(() => _saving = true);
    try {
      await ref.read(orderActionsProvider).reportFailed(widget.order.id, reason: _reason!, note: _note.text, photo: _photo);
      if (!mounted) return;
      Navigator.pop(context);
      _toast(context, widget.order.atPickup ? 'Pickup attempt recorded. The store will follow up.' : 'Delivery attempt recorded. The order is back with the store.');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(title: widget.title, children: [
      RadioGroup<String>(
        groupValue: _reason,
        onChanged: (v) => setState(() => _reason = v),
        child: Column(children: [
          for (final r in widget.reasons)
            RadioListTile<String>(value: r, title: Text(r), dense: true, contentPadding: EdgeInsets.zero, activeColor: AppColors.secondary),
        ]),
      ),
      TextField(controller: _note, maxLength: 500, maxLines: 2, decoration: const InputDecoration(hintText: 'Note (what happened)', isDense: true)),
      PhotoPicker(photo: _photo, onChanged: (p) => setState(() => _photo = p), label: 'Photo (optional, e.g. locked door)'),
      const SizedBox(height: 16),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: AppColors.error),
        onPressed: _saving ? null : _save,
        child: _saving ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : const Text('Report'),
      ),
    ]);
  }
}
