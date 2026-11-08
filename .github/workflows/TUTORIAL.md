# Build BrowOS in a new repository
1. GitHub (Chrome, menu > Desktop site) > + > New repository > Create repository.
2. Extract the zip. Upload loose files with Add file > Upload files, Commit changes after each batch:
   - main folder: package.json, capacitor.config.json, debug.keystore
   - www: index.html, style.css
   - www/js: ALL 18 .js files
   - icons: the 5 png files
   - android-patch: MainActivity.java, NativeBrowserPlugin.java, Extras.java
3. Actions > set up a workflow yourself > name it build-apk.yml > paste the workflow > Commit changes.
4. Wait 5-10 minutes for the green tick. Summary > Artifacts > BrowOS-APK. Extract, install app-debug.apk over the old one (same keystore keeps your data).
Safe mode: if the app misbehaves, delete Extras.java from the repository and rebuild; if it still misbehaves delete the other two .java files too.
