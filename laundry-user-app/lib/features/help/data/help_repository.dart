import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

class Faq {
  const Faq({required this.question, required this.answer, required this.category});

  final String question;
  final String answer;
  final String category;

  factory Faq.fromJson(Map<String, dynamic> json) => Faq(
        question: json['question'] as String? ?? '',
        answer: json['answer'] as String? ?? '',
        category: (json['category'] as String?)?.trim().isNotEmpty == true ? json['category'] as String : 'General',
      );
}

/// A content page (about, terms, privacy).
class ContentPage {
  const ContentPage({required this.title, required this.content, this.updatedAt});

  final String title;
  final String content;
  final DateTime? updatedAt;

  factory ContentPage.fromJson(Map<String, dynamic> json) => ContentPage(
        title: json['title'] as String? ?? '',
        content: json['content'] as String? ?? '',
        updatedAt: DateTime.tryParse(json['updated_at'] as String? ?? ''),
      );
}

class HelpRepository {
  HelpRepository(this._dio);

  final Dio _dio;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<List<Faq>> faqs() => _call(() async => unwrap<List<dynamic>>(await _dio.get<dynamic>('/content/faq', options: publicRequest))
      .cast<Map<String, dynamic>>()
      .map(Faq.fromJson)
      .toList());

  Future<ContentPage> page(String slug) =>
      _call(() async => ContentPage.fromJson(unwrap<Map<String, dynamic>>(await _dio.get<dynamic>('/content/$slug', options: publicRequest))));
}

final helpRepositoryProvider = Provider<HelpRepository>((ref) => HelpRepository(ref.watch(dioProvider)));

final faqsProvider = FutureProvider.autoDispose<List<Faq>>((ref) => ref.watch(helpRepositoryProvider).faqs());

final contentPageProvider = FutureProvider.autoDispose.family<ContentPage, String>((ref, slug) => ref.watch(helpRepositoryProvider).page(slug));
