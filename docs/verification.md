# Encryption Verification Checklist

Manual steps to verify that Realm encryption is working correctly in a development build.

## Prerequisites
- Android emulator running (`Pixel_API_36` or physical device)
- Development build installed (`npx expo run:android`)
- `adb` available on PATH (`$ANDROID_HOME/platform-tools`)

## 1. Verify Realm File Exists

```bash
adb shell run-as com.ckaburu.flowcycleapp ls -la files/
```

Expected: A file named `flowcycle.realm` (and possibly `.lock` / `.management` files).

## 2. Verify Realm File Is Encrypted (Not Readable as Plain Text)

```bash
adb shell run-as com.ckaburu.flowcycleapp cat files/flowcycle.realm | head -c 64 | xxd
```

Expected: Random-looking binary data. If the file were unencrypted, you would see Realm's magic header bytes or readable schema strings.

## 3. Verify Key Is in SecureStore

```bash
adb shell run-as com.ckaburu.flowcycleapp cat shared_prefs/com.ckaburu.flowcycleapp.SecureStore.xml
```

Expected: An XML entry with key `flowcycle_realm_key` containing a 128-character hex string (representing the 64-byte encryption key). The value itself is encrypted by Android Keystore, so you'll see the SecureStore wrapper — but the entry should exist.

> **Note**: On newer Android versions, SecureStore may use EncryptedSharedPreferences, which means the file contents are encrypted. The presence of the file and key name is sufficient to confirm the key was stored.

## 4. Verify Key Survives App Restart

1. Open the app and create a profile.
2. Force-kill the app: `adb shell am force-stop com.ckaburu.flowcycleapp`
3. Reopen the app.
4. Expected: The profile you created is still visible — the key was retrieved from SecureStore and used to decrypt the Realm.

## 5. Verify Missing-Key Guard

> **⚠️ Destructive test** — only do this on emulator or test device.

1. Open the app and create a profile (so a Realm file exists).
2. Clear SecureStore but keep the Realm file:
   ```bash
   adb shell run-as com.ckaburu.flowcycleapp rm shared_prefs/com.ckaburu.flowcycleapp.SecureStore.xml
   ```
3. Force-kill and reopen the app.
4. Expected: The app logs an error:
   ```
   Missing encryption key "flowcycle_realm_key" for existing Realm at "flowcycle.realm".
   ```
   The app should show the loading state and not crash — the error is caught in `App.tsx` bootstrap.

## 6. Verify Fresh Install Creates New Key

1. Uninstall the app: `adb uninstall com.ckaburu.flowcycleapp`
2. Reinstall: `npx expo run:android`
3. Open the app and create a profile.
4. Repeat step 3 above — verify a new key exists in SecureStore.
5. Verify the new Realm file is created and the profile data is accessible.

## Summary

| Check | What It Proves |
|---|---|
| Realm file exists | Database is created on first use |
| File is not readable as plain text | Encryption is active |
| Key in SecureStore | Key persists across sessions |
| App restart preserves data | Key retrieval and decryption work |
| Missing key blocks access | Guard prevents silent data loss |
| Fresh install creates new key | Key generation works end-to-end |
