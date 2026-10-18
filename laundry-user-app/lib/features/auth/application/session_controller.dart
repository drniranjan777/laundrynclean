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

/// Who is signed in. Restored from the stored token at launch; cleared on logout or when the refresh token expires.
class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    final sub = ref.watch(sessionExpiredProvider).stream.listen((_) => state = const SessionState.signedOut());
    ref.onDispose(sub.cancel);
    return const SessionState.unknown();
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Network errors are rethrown so the splash screen can offer a retry.
  Future<void> restore() async {
    if (!await _repo.hasSession()) {
      state = const SessionState.signedOut();
      return;
    }
    try {
      final user = await _repo.fetchProfile();
      if (user.role != 'customer') {
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

  void updateUser(AppUser user) {
    if (state.isSignedIn) state = SessionState.signedIn(user);
  }

  Future<void> signOut() async {
    await _repo.logout();
    state = const SessionState.signedOut();
  }
}

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);
