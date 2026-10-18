import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/format.dart';

class Plan {
  const Plan({
    required this.id,
    required this.name,
    required this.price,
    required this.durationType,
    required this.duration,
    required this.features,
    required this.freeDelivery,
    required this.discountPercent,
    required this.trialDays,
    required this.trialAvailable,
    this.description,
  });

  final String id;
  final String name;
  final double price;
  final String durationType; // month, year, days
  final int duration;
  final List<String> features;
  final bool freeDelivery;
  final double discountPercent;
  final int trialDays;
  final bool trialAvailable; // the customer hasn't had this plan yet
  final String? description;

  /// "/ month", "/ year", "/ 30 days"
  String get per => switch (durationType) {
        'month' => '/ month',
        'year' => '/ year',
        _ => '/ $duration days',
      };

  /// Benefits to list: the plan's own feature list, or one made from its settings.
  List<String> get benefits => features.isNotEmpty
      ? features
      : [
          if (discountPercent > 0) '${discountPercent.toStringAsFixed(discountPercent % 1 == 0 ? 0 : 1)}% off every order',
          if (freeDelivery) 'Free pickup & delivery on every order',
        ];

  factory Plan.fromJson(Map<String, dynamic> json) => Plan(
        id: json['id'] as String,
        name: json['name'] as String? ?? 'Plan',
        price: toDouble(json['price']),
        durationType: json['durationType'] as String? ?? 'month',
        duration: (json['duration'] as num?)?.toInt() ?? 30,
        features: ((json['features'] as List?) ?? const []).map((e) => '$e').toList(),
        freeDelivery: json['freeDelivery'] == true,
        discountPercent: toDouble(json['discountPercent']),
        trialDays: (json['trialDays'] as num?)?.toInt() ?? 0,
        trialAvailable: json['trialAvailable'] == true,
        description: json['description'] as String?,
      );
}

class PlansData {
  const PlansData({required this.plans, this.activePlanId});

  final List<Plan> plans;
  final String? activePlanId;
}

/// The customer's current plan (active, trial, or cancelled but still running until [endDate]).
class MySubscription {
  const MySubscription({required this.id, required this.status, required this.planId, required this.planName, this.startDate, this.endDate, this.amountPaid = 0, this.plan});

  final String id;
  final String status; // active, trial, cancelled
  final String planId;
  final String planName;
  final DateTime? startDate;
  final DateTime? endDate;
  final double amountPaid;
  final Plan? plan;

  bool get isTrial => status == 'trial';
  bool get isCancelled => status == 'cancelled';

  int get daysLeft => endDate == null ? 0 : endDate!.difference(DateTime.now()).inHours.clamp(0, 1 << 30) ~/ 24;

  factory MySubscription.fromJson(Map<String, dynamic> json) {
    final plan = json['plan'] is Map<String, dynamic> ? Plan.fromJson({...json['plan'] as Map<String, dynamic>, 'id': json['planId']}) : null;
    return MySubscription(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'active',
      planId: json['planId'] as String? ?? '',
      planName: plan?.name ?? 'Plan',
      startDate: DateTime.tryParse(json['startDate'] as String? ?? ''),
      endDate: DateTime.tryParse(json['endDate'] as String? ?? ''),
      amountPaid: toDouble(json['amountPaid']),
      plan: plan,
    );
  }
}

class SubscriptionsRepository {
  SubscriptionsRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<PlansData> plans() => _call(() async {
        final data = unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/subscriptions/plans'));
        return PlansData(
          plans: ((data['plans'] as List?) ?? const []).cast<Map<String, dynamic>>().map(Plan.fromJson).toList(),
          activePlanId: data['activePlanId'] as String?,
        );
      });

  Future<MySubscription?> mine() => _call(() async {
        final data = unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/subscriptions/my-subscription'));
        final sub = data['subscription'];
        return sub is Map<String, dynamic> ? MySubscription.fromJson(sub) : null;
      });

  /// Returns the backend's message ("Basic plan activated" / "Your 7-day free trial ... has started").
  Future<String> subscribe(String planId) => _call(() async {
        final res = await _dio.post<dynamic>('/subscriptions/subscribe', data: {'planId': planId, 'paymentMethod': 'wallet'});
        return (res.data as Map<String, dynamic>)['message'] as String? ?? 'Plan activated';
      });

  Future<String> cancel() => _call(() async {
        final res = await _dio.post<dynamic>('/subscriptions/cancel');
        return (res.data as Map<String, dynamic>)['message'] as String? ?? 'Subscription cancelled';
      });
}

final subscriptionsRepositoryProvider = Provider<SubscriptionsRepository>((ref) => SubscriptionsRepository(ref.watch(dioProvider)));

final plansProvider = FutureProvider.autoDispose<PlansData>((ref) => ref.watch(subscriptionsRepositoryProvider).plans());

final mySubscriptionProvider = FutureProvider.autoDispose<MySubscription?>((ref) => ref.watch(subscriptionsRepositoryProvider).mine());
