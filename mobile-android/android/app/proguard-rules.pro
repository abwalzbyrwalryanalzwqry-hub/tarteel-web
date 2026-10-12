# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# ── قواعد أمان لـ R8 (React Native 0.81 + Expo SDK 54 + البنية الجديدة) ──
# وحدات Expo تُحمَّل بالانعكاس (reflection) من ExpoModulesPackageList.
-keep class expo.modules.** { *; }
-keep class com.tarteel.** { *; }
# JSI/Hermes/TurboModules وFabric.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; @com.facebook.common.internal.DoNotStrip *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep class com.swmansion.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.facebook.react.**
-dontwarn expo.modules.**
# حزمة React Native كاملة: كلفة صغيرة في الحجم مقابل أمان من أي انعكاس غير موثق.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.yoga.** { *; }
-keep class com.facebook.soloader.** { *; }
