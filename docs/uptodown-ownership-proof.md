# Uptodown ownership + signature-change proof

Reusable evidence pack for the ZyniVerse Uptodown listing. Update the ticket ID
and date when submitting a new review request.

- **Prepared:** 2026-11-19
- **Ticket / review ID:** _fill when available_
- **App:** ZyniVerse
- **Official website:** https://zyverse.in
- **Developer / signer name:** Parth Gupta, ZyniVerse
- **Uptodown listing:** https://zyniverse.en.uptodown.com/android

---

## Short explanation for support

The existing Uptodown listing was created from early internal builds
(v1.0.0–v1.3.0) that used an old/temporary signing key. That keystore is not
available on the current release machine. Current stable releases are signed
with our permanent release key. The package name was also corrected from the
early typo `app.zyniverse.mobile` to match the existing listing.

We are the same developer/owner. Ownership can be verified through
`https://zyverse.in`, where the signed APK is publicly hosted.

---

## Evidence table

| Field | Existing Uptodown build | New upload |
|---|---|---|
| Version | `1.3.0` | `1.4.0` |
| versionCode | — | `140000` |
| Package | `app.zyniverse.mobile` | `app.zyniverse.mobile` |
| App label | ZyniVerse | ZyniVerse |
| APK SHA-256 | `9dd6e41d22bb205c102fe1bd034d132d5723c996c68fc31082feceee9ccae55a` | `48c5d134362fe3d96af55031b4fa29d8e9dee7688a39db60f5de4b50424a97e6` |
| APK size | 39.24 MB | 42,093,985 bytes |
| Certificate (Uptodown format) | `9abb3423c0dd2fe46510385e40c13994,5654025662a83d8ef8a0a2064269ffae` | see signer digests below |
| Signer SHA-256 | — | `a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e` |
| Signer SHA-1 | — | `5b80e49e07e71bae199627790d33411c905f75e0` |
| Signer MD5 | — | `5ac7c990da380a19d2f187a2c2199d70` |

**Uploaded file:** `dist/uptodown/ZyniVerse-1.4.0-app.zyniverse.mobile.apk`

**Main production file (different package, do not confuse):**
`dist/ZyniVerse-1.4.0.apk`
- Package `app.zyverse.mobile`
- SHA-256 `c9178820be0b777850d187abfd5f70ff2e314aec9fa4eeb2a2d7565fc86bddd9`
- Same signer SHA-256 `a2f453de...5367e`

Both APKs use the same permanent release key. The signer differs only from the
old Uptodown `1.3.0` build.

---

## Ready-to-paste support message

```text
Hello Uptodown team,

This is the official developer of ZyniVerse (https://zyverse.in).

The existing listing was created from an early internal build (v1.0–v1.3)
that used a temporary/old signing key. That keystore is no longer available
on our release machine. Our current stable production releases v1.4.0 are
signed with our permanent release key:

Signer SHA-256: a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e
Signer SHA-1:   5b80e49e07e71bae199627790d33411c905f75e0
Signer MD5:     5ac7c990da380a19d2f187a2c2199d70

I have also corrected the package name to match your listing:
app.zyniverse.mobile

Uploaded APK:
Version: 1.4.0 (versionCode 140000)
SHA-256: 48c5d134362fe3d96af55031b4fa29d8e9dee7688a39db60f5de4b50424a97e6
Size: 42,093,985 bytes

We are the same developer/owner and can verify ownership through zyverse.in
and the developer account. Please approve this as a legitimate signature-key
rotation, or advise how to update the signature on the existing listing.

Thank you,
Parth Gupta
ZyniVerse
```

---

## Commands to regenerate proof

Run from the repo root.

### Package / version / label

```powershell
& 'C:\Users\ParthGupta\android-sdk\build-tools\35.0.0\aapt.exe' dump badging 'dist\uptodown\ZyniVerse-1.4.0-app.zyniverse.mobile.apk' | Select-String '^package:|application-label:|launchable-activity:|sdkVersion:|targetSdkVersion:'
```

Expected:

```text
package: name='app.zyniverse.mobile' versionCode='140000' versionName='1.4.0'
application-label:'ZyniVerse'
launchable-activity: name='app.zyniverse.mobile.MainActivity'
sdkVersion:'24'
targetSdkVersion:'35'
```

### Signer certificate

```powershell
$env:JAVA_HOME = 'C:\Users\ParthGupta\jdk17'
& 'C:\Users\ParthGupta\android-sdk\build-tools\35.0.0\apksigner.bat' verify --print-certs 'dist\uptodown\ZyniVerse-1.4.0-app.zyniverse.mobile.apk'
```

Expected signer digest: `a2f453ded88aae9d5949f4a2f08f3330b513bf6d35d05ecd7c6c42a81515367e`

### APK hash and size

```powershell
$f = 'dist\uptodown\ZyniVerse-1.4.0-app.zyniverse.mobile.apk'
Get-Item $f | Select-Object Name, Length
(Get-FileHash $f -Algorithm SHA256).Hash.ToLowerInvariant()
```

---

## If approval is rejected

1. Ask Uptodown support to update the signature on the existing listing rather
   than rejecting the upload.
2. Offer the ownership evidence above and the live APK URL:
   `https://zyverse.in/ZyniVerse-1.4.0.apk` (main package `app.zyverse.mobile`).
3. If they still reject, ask them how to publish a fresh listing with the
   corrected package and retire/merge the old `1.3.0` listing.

## Do not do this

Do not re-upload repeatedly while a review is pending. Do not replace the main
hosted APK with the Uptodown-only package build; they are intentionally
different app identities.
