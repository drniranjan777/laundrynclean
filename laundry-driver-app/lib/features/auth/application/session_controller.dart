import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../data/auth_models.dart';
import '../data/auth_repository.dart';

enum SessionStatus { unknown, signedOut, signedIn }

class SessionState {
  const SessionState._(this.status, this.user);
  const SessionState.unknown() : this._(SessionStatus.unknown, null);
  const SessionState.signedOut() : this._(SessionStatus.signedOut, null);
  const SessionState.signedIn(AppUser user) : this._(SessionStatus.signedIn, user);

  final SessionStatus status;
  final AppUser? user;

  bool get isSignedIn => status == SessionStatus.signedIn;
}

/// The signed-in delivery partner. A deactivated driver gets 403 on the next call and is signed out.
class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    final sub = ref.watch(sessionExpiredProvider).stream.listen((_) => state = const SessionState.signedOut());
    ref.onDispose(sub.cancel);
    return const SessionState.unknown();
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  Future<void> restore() async {
    if (!await _repo.hasSession()) {
      state = const SessionState.signedOut();
      return;
    }
    try {
      final user = await _repo.fetchProfile();
      if (user.role != 'driver') {
        await _repo.clearLocalSession();
        state = const SessionState.signedOut();
        return;
      }
      state = SessionState.signedIn(user);
    } on ApiException catch (e) {
      if (e.isNetworkError) rethrow;
      await _repo.clearLocalSession();
      state = const SessionState.signedOut();
    }
  }

  void signedIn(AppUser user) => state = SessionState.signedIn(user);

  /// A 403 from any call (store deactivated the driver) ends the session.
  Future<void> handleForbidden() async {
    await _repo.clearLocalSession();
    state = const SessionState.signedOut();
  }

  Future<void> signOut() async {
    await _repo.logout();
    state = const SessionState.signedOut();
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);
