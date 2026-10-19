import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../address/data/address_repository.dart';
import '../data/pickup_repository.dart';

/// The pickup being booked, kept while the customer moves between the two screens (and back).
class PickupDraft {
  const PickupDraft({required this.idempotencyKey, this.address, this.day, this.slot, this.payment = PickupPayment.cod, this.notes = ''});

  final Address? address;
  final PickupDay? day;
  final PickupSlotOption? slot;
  final PickupPayment payment;
  final String notes;

  /// Sent with the booking; a retry of the same draft can never create a second order.
  final String idempotencyKey;

  bool get readyForReview => address != null && day != null && slot != null;

  PickupDraft copyWith({
    Address? address,
    PickupDay? day,
    PickupSlotOption? slot,
    PickupPayment? payment,
    String? notes,
    bool clearDay = false,
    bool clearSlot = false,
  }) => PickupDraft(
    idempotencyKey: idempotencyKey,
    address: address ?? this.address,
    day: clearDay ? null : (day ?? this.day),
    slot: clearSlot || clearDay ? null : (slot ?? this.slot),
    payment: payment ?? this.payment,
    notes: notes ?? this.notes,
  );
}

String newIdempotencyKey() {
  final r = Random.secure();
  return List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
}

class PickupDraftController extends Notifier<PickupDraft> {
  @override
  PickupDraft build() => PickupDraft(idempotencyKey: newIdempotencyKey());

  /// A different address may mean a different store, with its own dates and slots
  void setAddress(Address address) {
    if (address.id == state.address?.id) return;
    state = state.copyWith(address: address, clearDay: true);
  }

  void setDay(PickupDay day) {
    if (day.date == state.day?.date) return;
    state = state.copyWith(day: day, clearSlot: true);
  }

  void setSlot(PickupSlotOption slot) => state = state.copyWith(slot: slot);
  void clearSlot() => state = state.copyWith(clearSlot: true);
  void setPayment(PickupPayment payment) => state = state.copyWith(payment: payment);
  void setNotes(String notes) => state = state.copyWith(notes: notes);

  /// After a booking: start over with a fresh key (the address is kept for next time)
  void reset() => state = PickupDraft(idempotencyKey: newIdempotencyKey(), address: state.address);
}

final pickupDraftProvider = NotifierProvider<PickupDraftController, PickupDraft>(PickupDraftController.new);
