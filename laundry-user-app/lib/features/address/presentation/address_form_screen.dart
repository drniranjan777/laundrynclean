import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/validators.dart';
import '../../../core/widgets/primary_button.dart';
import '../../auth/application/session_controller.dart';
import '../../location/data/location_repository.dart';
import '../data/address_repository.dart';

/// Add or edit a pickup address. The pin code must be one NClean serves.
/// Pops with the saved [Address] (new) or true (edited).
class AddressFormScreen extends ConsumerStatefulWidget {
  const AddressFormScreen({super.key, this.address});

  final Address? address;

  @override
  ConsumerState<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends ConsumerState<AddressFormScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name, _phone, _line, _city, _state, _pincode;
  String _label = 'Home';
  double? _lat, _lng;
  bool _saving = false;
  bool _locating = false;
  String? _pincodeError;

  @override
  void initState() {
    super.initState();
    final a = widget.address;
    final user = ref.read(sessionProvider).user;
    final area = ref.read(serviceAreaProvider);
    _name = TextEditingController(text: a?.fullName ?? user?.name ?? '');
    _phone = TextEditingController(text: a?.phone ?? user?.phone ?? '');
    _line = TextEditingController(text: a?.addressLine ?? '');
    _city = TextEditingController(text: a?.city ?? area?.city ?? '');
    _state = TextEditingController(text: a?.state ?? area?.state ?? '');
    _pincode = TextEditingController(text: a?.pincode ?? area?.pincode ?? '');
    _label = a?.label ?? 'Home';
    _lat = a?.lat;
    _lng = a?.lng;
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _line, _city, _state, _pincode]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _useLocation() async {
    setState(() => _locating = true);
    try {
      final place = await ref.read(locationRepositoryProvider).detectPlace();
      setState(() {
        _pincode.text = place.pincode;
        if (place.street.isNotEmpty && _line.text.trim().isEmpty) _line.text = place.street;
        if (place.city.isNotEmpty) _city.text = place.city;
        if (place.state.isNotEmpty) _state.text = place.state;
        _lat = place.lat;
        _lng = place.lng;
        _pincodeError = null;
      });
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Couldn't get your location")));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    setState(() => _pincodeError = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      // Only addresses we can pick up from
      final check = await ref.read(locationRepositoryProvider).checkPincode(_pincode.text.trim());
      if (!check.isServiceable) {
        setState(() => _pincodeError = "We don't pick up from ${_pincode.text.trim()} yet");
        return;
      }
      final input = AddressInput(
        fullName: _name.text,
        phone: Validators.normaliseMobile(_phone.text),
        addressLine: _line.text,
        city: _city.text,
        state: _state.text,
        pincode: _pincode.text,
        label: _label,
        lat: _lat,
        lng: _lng,
      );
      final notifier = ref.read(addressesProvider.notifier);
      if (widget.address == null) {
        final saved = await notifier.add(input);
        if (mounted) context.pop(saved);
      } else {
        await notifier.edit(widget.address!.id, input);
        if (mounted) context.pop(true);
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget label(String s) => Padding(
          padding: const EdgeInsets.only(bottom: 8, top: 16),
          child: Text(s, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w500)),
        );
    String? required(String? v, String what) => (v ?? '').trim().isEmpty ? 'Please enter $what' : null;

    return Scaffold(
      appBar: AppBar(title: Text(widget.address == null ? 'Add address' : 'Edit address')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          children: [
            OutlinedButton.icon(
              onPressed: _locating ? null : _useLocation,
              icon: _locating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.my_location),
              label: const Text('Use my current location'),
            ),
            label('Full name'),
            TextFormField(controller: _name, textCapitalization: TextCapitalization.words, validator: (v) => required(v, 'the name')),
            label('Mobile number'),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')), LengthLimitingTextInputFormatter(14)],
              decoration: const InputDecoration(prefixText: '+91  '),
              validator: (v) => Validators.mobile(v ?? ''),
            ),
            label('House / flat, street, area'),
            TextFormField(controller: _line, maxLines: 2, textCapitalization: TextCapitalization.sentences, validator: (v) => required(v, 'the address')),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                label('City'),
                TextFormField(controller: _city, textCapitalization: TextCapitalization.words, validator: (v) => required(v, 'the city')),
              ])),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                label('State'),
                TextFormField(controller: _state, textCapitalization: TextCapitalization.words),
              ])),
            ]),
            label('Pin code'),
            TextFormField(
              controller: _pincode,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              decoration: InputDecoration(errorText: _pincodeError),
              validator: (v) => Validators.pincode(v ?? ''),
            ),
            label('Save as'),
            Wrap(spacing: 8, children: [
              for (final l in const ['Home', 'Work', 'Other'])
                ChoiceChip(
                  label: Text(l),
                  selected: _label == l,
                  showCheckmark: false,
                  selectedColor: AppColors.secondary,
                  backgroundColor: Colors.white,
                  labelStyle: TextStyle(color: _label == l ? Colors.white : AppColors.text),
                  shape: StadiumBorder(side: BorderSide(color: _label == l ? AppColors.secondary : AppColors.border)),
                  onSelected: (_) => setState(() => _label = l),
                ),
            ]),
            const SizedBox(height: 28),
            PrimaryButton(label: 'Save address', loading: _saving, onPressed: _save),
          ],
        ),
      ),
    );
  }
}
