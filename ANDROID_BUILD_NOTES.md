# BIGBULLS Android build

The 109 files from the supplied Forex Brokerage export are imported without redesigning their screens or client workflows. The Android package is a Capacitor shell around the same React/Vite frontend.

Backend, Supabase, broker API and back-office integrations are intentionally not configured in this preview phase. The existing source still contains its original Zite authentication dependency and local demo trading/wallet state. Those are not real broker operations.

Run the **BIGBULLS Android APK** GitHub Actions workflow to generate a debug APK artifact. Android SDK and Gradle are provisioned by the workflow runner.
