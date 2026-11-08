# BrowOS 1.4
Created by Fouz_312 using Claude (Sonnet 5.5 High). Inspired by the BrowOS project by Allysun.
A desktop-style environment inside an Android app. It does not replace Android.

New in 1.4: crash protection (a web page that runs out of memory is closed and reopened instead of crashing the app), lighter graphics, Back and Home keep web apps running (Shut down closes them), full screen that is remembered per app, no extra bar under web apps, key button for saved logins, sign-in suggestions from Vault, drag an app out of Start to pin it to the desktop or taskbar, Chrome-style browser menu, phone notifications, accounts, backup and restore, Camera, Voice Changer (for websites opened inside BrowOS), a secret app, hide-the-Android-bars full screen mode.
Folders: www (app), icons, android-patch (3 Java files: MainActivity, NativeBrowserPlugin, Extras), package.json, capacitor.config.json, debug.keystore, .github/workflows/build-apk.yml.
See ROADMAP_MONDAY.md for what is not included yet. Privacy: everything stays on your phone except the sites you open, site icons from Google's icon service, Open-Meteo (weather) and cdnjs (PDF engine).
