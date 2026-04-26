# `.well-known/assetlinks.json`

Digital Asset Links — Google Chrome 用這支檔案確認 TWA (Trusted Web Activity) 和
這個網站屬於同一家人。沒設好 Play 上架後打開 app 會看到網址列(URL bar),不會
全螢幕接管。

## 目前狀態:**placeholder**

`sha256_cert_fingerprints` 欄目前塞的是 `AA:AA:...:AA`(32 byte 假值),
要等到 Bubblewrap 打完第一版 AAB、拿到 keystore 之後才能填真實值。

## 什麼時候要改

- ✅ 網站先上線、`manifest.json` 驗證通過 —— 現在這個階段
- ⏳ 等使用 `bubblewrap init` 產生 keystore 或指定既有 keystore
- ⏳ 拿 fingerprint:`bubblewrap fingerprint`(或 `keytool -list -v -keystore <keystore>.jks`)
- ⏳ 複製 SHA256 進 `sha256_cert_fingerprints` 陣列

## package_name

目前設 `me.heronhouse.oracle` —— 跟著網域命名慣例。如果之後 Bubblewrap 建的 package
name 不同,**兩邊都要一致**(Play Console + assetlinks.json)。

## 如何驗證

部署後打開:
https://tarogram.heronhouse.me/.well-known/assetlinks.json

應能直接回傳 JSON(Content-Type: application/json)。Google 驗證工具:
https://developers.google.com/digital-asset-links/tools/generator

## 多個 fingerprint

Play Console 如果啟用 Play App Signing(預設會啟用),`sha256_cert_fingerprints`
陣列要同時放 upload key 跟 Play 重新簽的 app signing key 兩組。
