import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// NClean brand colours, sampled from the logo (navy "NCle", teal "an", the sky → blue wave).
class AppColors {
  AppColors._();
  static const primary = Color(0xFF00857A); // teal: main buttons (a deeper shade of the logo teal, so white text reads)
  static const primaryDark = Color(0xFF006E65);
  static const secondary = Color(0xFF062C5A); // navy: headings, icons, dark accents
  static const teal = Color(0xFF05AB9C); // logo teal, for decoration
  static const blue = Color(0xFF007BCA); // logo wave, deep
  static const sky = Color(0xFF02BEFC); // logo wave, light
  static const text = Color(0xFF14213D);
  static const textMuted = Color(0xFF64748B);
  static const border = Color(0xFFD0D7E2);
  static const error = Color(0xFFE5484D);
  static const surface = Colors.white;
  static const surfaceMuted = Color(0xFFF3F7FB);

  // From the app screen designs
  static const deepTeal = Color(0xFF03586E); // Book Pickup / See More buttons, selected chip, wallet "+"
  static const accent = Color(0xFFEF7757); // offers, discount badges, selected bottom tab
  static const peach = Color(0xFFFFE5D7); // unselected sub-category chips
  static const bannerBg = Color(0xFFEEF6FF); // home offer banner
  static const tealTint = Color(0xFFE7F0F4); // pickup card, wallet chip

  /// The logo's wave, for headers and promo cards.
  static const brandGradient = LinearGradient(colors: [secondary, blue, teal], begin: Alignment.topLeft, end: Alignment.bottomRight);
}

class AppTheme {
  AppTheme._();

  /// [useGoogleFonts] is off in widget tests, which can't download fonts.
  static ThemeData light({bool useGoogleFonts = true}) {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        error: AppColors.error,
        surface: AppColors.surface,
      ),
      scaffoldBackgroundColor: AppColors.surface,
    );
    final textTheme = (useGoogleFonts ? GoogleFonts.montserratTextTheme(base.textTheme) : base.textTheme)
        .apply(bodyColor: AppColors.text, displayColor: AppColors.text);

    OutlineInputBorder border(Color color, [double width = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: color, width: width),
        );

    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
      inputDecorationTheme: InputDecorationTheme(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        hintStyle: textTheme.bodyLarge?.copyWith(color: const Color(0xFFB0B7C3)),
        border: border(AppColors.border),
        enabledBorder: border(AppColors.border),
        focusedBorder: border(AppColors.secondary, 1.4),
        errorBorder: border(AppColors.error),
        focusedErrorBorder: border(AppColors.error, 1.4),
        errorStyle: textTheme.bodyMedium?.copyWith(color: AppColors.error),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.55),
          disabledForegroundColor: Colors.white,
          minimumSize: const Size.fromHeight(56),
          shape: const StadiumBorder(),
          textStyle: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w500),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.text,
          minimumSize: const Size.fromHeight(56),
          shape: const StadiumBorder(),
          side: const BorderSide(color: AppColors.text),
          textStyle: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.secondary, textStyle: textTheme.titleSmall),
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      dialogTheme: const DialogThemeData(backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent),
    );
  }
}
