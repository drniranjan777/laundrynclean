import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/format.dart';
import '../../checkout/data/checkout_repository.dart';

/// GET /wallet
class WalletSummary {
  const WalletSummary({required this.balance, required this.totalCredited, required this.totalDebited});

  final double balance;
  final double totalCredited; // everything added: top-ups, bonuses, refunds, credits
  final double totalDebited; // everything spent: orders, subscriptions

  factory WalletSummary.fromJson(Map<String, dynamic> json) => WalletSummary(
        balance: toDouble(json['balance']),
        totalCredited: toDouble(json['totalCredited']),
        totalDebited: toDouble(json['totalDebited']),
      );
}

/// One line of wallet history.
class WalletTxn {
  const WalletTxn({
    required this.id,
    required this.isCredit,
    required this.amount,
    required this.balanceAfter,
    required this.description,
    required this.kind,
    this.createdAt,
  });

  final String id;
  final bool isCredit;
  final double amount;
  final double balanceAfter;
  final String description;
  final String kind; // recharge, package_bonus, order_payment, refund, admin_credit, subscription
  final DateTime? createdAt;

  /// Short heading for the history list; the backend's description is shown under it.
  String get title => switch (kind) {
        'recharge' => 'Money added',
        'package_bonus' => 'Bonus credit',
        'order_payment' => 'Order payment',
        'refund' => 'Refund',
        'subscription' => 'Membership',
        'admin_credit' => isCredit ? 'Credit from NClean' : 'Adjustment',
        _ => isCredit ? 'Credit' : 'Debit',
      };

  factory WalletTxn.fromJson(Map<String, dynamic> json) => WalletTxn(
        id: json['id'] as String,
        isCredit: json['type'] == 'credit',
        amount: toDouble(json['amount']),
        balanceAfter: toDouble(json['balanceAfter']),
        description: json['description'] as String? ?? '',
        kind: json['referenceType'] as String? ?? '',
        createdAt: DateTime.tryParse(json['created_at'] as String? ?? json['createdAt'] as String? ?? ''),
      );
}

/// A recharge offer: pay [payAmount], get [creditAmount] in the wallet.
class WalletPackage {
  const WalletPackage({required this.id, required this.name, required this.payAmount, required this.creditAmount});

  final String id;
  final String name;
  final double payAmount;
  final double creditAmount;

  double get bonus => creditAmount - payAmount;

  factory WalletPackage.fromJson(Map<String, dynamic> json) => WalletPackage(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        payAmount: toDouble(json['payAmount']),
        creditAmount: toDouble(json['creditAmount']),
      );
}

/// POST /wallet/create-order: the Razorpay order to pay, and what the wallet gets once it's paid.
class RechargeOrder {
  const RechargeOrder({required this.payment, required this.amountToPay, required this.amountToCredit});

  final RazorpayOrder payment;
  final double amountToPay;
  final double amountToCredit;

  factory RechargeOrder.fromJson(Map<String, dynamic> json) => RechargeOrder(
        payment: RazorpayOrder.fromJson(json),
        amountToPay: toDouble(json['amountToPay']),
        amountToCredit: toDouble(json['amountToCredit']),
      );
}

/// POST /wallet/add-money result.
class AddMoneyResult {
  const AddMoneyResult({required this.amountPaid, required this.amountCredited, required this.bonus, required this.newBalance});

  final double amountPaid;
  final double amountCredited;
  final double bonus;
  final double newBalance;

  factory AddMoneyResult.fromJson(Map<String, dynamic> json) => AddMoneyResult(
        amountPaid: toDouble(json['amountPaid']),
        amountCredited: toDouble(json['amountCredited']),
        bonus: toDouble(json['bonus']),
        newBalance: toDouble(json['newBalance']),
      );
}

class TxnPage {
  const TxnPage({required this.items, required this.page, required this.totalPages});

  final List<WalletTxn> items;
  final int page;
  final int totalPages;

  bool get hasMore => page < totalPages;
}

class WalletRepository {
  WalletRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<WalletSummary> summary() => _call(() async => WalletSummary.fromJson(unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/wallet'))));

  Future<TxnPage> transactions({int page = 1, int limit = 20}) => _call(() async {
        final data = unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/wallet/transactions', queryParameters: {'page': page, 'limit': limit}));
        return TxnPage(
          items: ((data['transactions'] as List?) ?? const []).cast<Map<String, dynamic>>().map(WalletTxn.fromJson).toList(),
          page: (data['page'] as num?)?.toInt() ?? page,
          totalPages: (data['totalPages'] as num?)?.toInt() ?? page,
        );
      });

  Future<List<WalletPackage>> packages() => _call(() async =>
      unwrap<List<dynamic>>(await _dio.get<dynamic>('/wallet/packages')).cast<Map<String, dynamic>>().map(WalletPackage.fromJson).toList());

  /// A custom [amount] or a [packageId].
  Future<RechargeOrder> createRecharge({double? amount, String? packageId}) => _call(() async => RechargeOrder.fromJson(unwrap<Map<String, dynamic>>(
      await _dio.post<dynamic>('/wallet/create-order', data: packageId != null ? {'packageId': packageId} : {'amount': amount}))));

  Future<AddMoneyResult> addMoney({required String orderId, required String paymentId, required String signature}) =>
      _call(() async => AddMoneyResult.fromJson(unwrap<Map<String, dynamic>>(await _dio.post<dynamic>('/wallet/add-money', data: {
            'razorpayOrderId': orderId,
            'razorpayPaymentId': paymentId,
            'razorpaySignature': signature,
          }))));
}

final walletRepositoryProvider = Provider<WalletRepository>((ref) => WalletRepository(ref.watch(dioProvider)));

final walletSummaryProvider = FutureProvider.autoDispose<WalletSummary>((ref) => ref.watch(walletRepositoryProvider).summary());

/// Balance for checkout, the wallet chip and the account screen; 0 when it can't be loaded.
final walletBalanceProvider = FutureProvider.autoDispose<double>((ref) async {
  try {
    return (await ref.watch(walletSummaryProvider.future)).balance;
  } catch (_) {
    return 0;
  }
});

final walletPackagesProvider = FutureProvider.autoDispose<List<WalletPackage>>((ref) => ref.watch(walletRepositoryProvider).packages());

/// Wallet history, loaded a page at a time.
class WalletHistoryController extends AsyncNotifier<TxnPage> {
  @override
  Future<TxnPage> build() => ref.read(walletRepositoryProvider).transactions();

  bool _loadingMore = false;

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    try {
      final next = await ref.read(walletRepositoryProvider).transactions(page: current.page + 1);
      state = AsyncData(TxnPage(items: [...current.items, ...next.items], page: next.page, totalPages: next.totalPages));
    } finally {
      _loadingMore = false;
    }
  }
}

final walletHistoryProvider = AsyncNotifierProvider.autoDispose<WalletHistoryController, TxnPage>(WalletHistoryController.new);

/// Refreshes everything that shows wallet money (after a top-up, an order or a subscription).
void refreshWallet(WidgetRef ref) {
  ref.invalidate(walletSummaryProvider);
  ref.invalidate(walletHistoryProvider);
}
