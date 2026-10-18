# Release builds shrink and rename Java/Kotlin code (R8). Newer Flutter plugins (shared_preferences 2.5+,
# path_provider_android 2.3+) call their Kotlin code from Dart over JNI (package:jni), looking classes and methods up
# by name and full signature. So the plugin classes must keep their members as written, and the Kotlin types the JNI
# bridge uses by name must keep theirs. Without this the release app stops on the launch screen
# (NoSuchMethodError / ClassNotFoundException from SharedPreferencesApiRegistrar).
# Flutter's Gradle plugin adds this file to release builds automatically.
-keep class io.flutter.plugins.** { *; }
-keep class com.github.dart_lang.** { *; }
-keep class kotlin.Unit { *; }
-keep class kotlin.Result { *; }
-keep class kotlin.Result$Failure { *; }
-keep class kotlin.coroutines.** { *; }
