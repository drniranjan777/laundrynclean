class AppUser {
  const AppUser({
    required this.id,
    required this.phone,
    required this.role,
    this.name,
    this.email,
    this.isProfileComplete = false,
  });

  final String id;
  final String phone;
  final String role;
  final String? name;
  final String? email;
  final bool isProfileComplete;

  /// New customers are asked for their name once, right after the first OTP.
  bool get needsProfile => (name ?? '').trim().isEmpty;

  String get firstName => (name ?? '').trim().split(' ').first;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        phone: json['phone'] as String? ?? '',
        role: json['role'] as String? ?? 'customer',
        name: json['name'] as String?,
        email: json['email'] as String?,
        isProfileComplete: json['isProfileComplete'] as bool? ?? false,
      );

  AppUser copyWith({String? name, String? email, bool? isProfileComplete}) => AppUser(
        id: id,
        phone: phone,
        role: role,
        name: name ?? this.name,
        email: email ?? this.email,
        isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      );
}

/// What POST /auth/send-otp returns.
class OtpRequest {
  const OtpRequest({required this.phone, required this.expiresInSeconds, required this.isNewUser});

  final String phone;
  final int expiresInSeconds;
  final bool isNewUser;

  factory OtpRequest.fromJson(Map<String, dynamic> json) => OtpRequest(
        phone: json['phone'] as String,
        expiresInSeconds: json['expiresIn'] as int? ?? 300,
        isNewUser: json['isNewUser'] as bool? ?? false,
      );
}
