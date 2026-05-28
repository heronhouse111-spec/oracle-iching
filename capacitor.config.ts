/**
 * Capacitor 設定 —— iOS App 殼指向 tarogram.heronhouse.me
 *
 * 跟 Android Bubblewrap 相同模式:殼不打包前端,直接 WebView 載入生產站,
 * 部署一推 App 就更新(節省 Apple 重新審查時間)。
 *
 * Bundle ID 跟 Android TWA package name 一致:me.heronhouse.tarogram
 * 反向 DNS 對應 domain heronhouse.me
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "me.heronhouse.tarogram",
  appName: "Tarogram 易問",

  /**
   * server.url 讓 Capacitor 不打包本地檔,直接從這個 URL 載入 WebView 內容。
   *
   * ?source=ios 給後端 access log / 分析用,讓你能識別「這 request 是從 iOS App 來的」。
   * 注意:SPA 內部 navigation 會丟掉這個 query string,**不可**用於前端 platform 判斷,
   *      前端 platform 判斷請用 lib/billing/platform.ts 的 getPlatform()(它讀
   *      window.Capacitor.isNativePlatform() 這個 native bridge,不靠 URL)。
   */
  server: {
    url: "https://tarogram.heronhouse.me/?source=ios",
    /**
     * cleartext: false → 強制 HTTPS,符合 Apple ATS 預設要求。
     * 如果未來要連測試環境(http://localhost:3000),改 true 並加入
     * Info.plist 的 NSAppTransportSecurity.NSAllowsArbitraryLoadsInWebContent。
     */
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
  },

  ios: {
    /**
     * contentInset: 'always' → 內容跟 iPhone safe area(瀏海 / Dynamic Island)對齊。
     * 'never' 會讓 web 內容延伸到狀態列下方,深色主題下還行,但有時鍵盤遮擋會異常。
     * 'always' 是最保守的選擇。
     */
    contentInset: "always",

    /**
     * 啟動瞬間 WebView 還沒載入完時的底色。設成跟網站 theme_color 一致,
     * 使用者點圖示開啟 → 看到深底 → WebView 漸入,不會閃一下白底再變黑。
     */
    backgroundColor: "#0a0a1a",

    /**
     * limitsNavigationsToAppBoundDomains: 跟 iOS 14+ 的 App-Bound Domains 機制相關。
     * 開啟需要在 Info.plist 加 WKAppBoundDomains 白名單,
     * 換來的好處是 WebView 內 cookie / localStorage 保留性更好。
     * 第一版設 false,等上架穩定後再優化(避免送審初期就踩 ATS / ABD 雷)。
     */
    limitsNavigationsToAppBoundDomains: false,

    /**
     * scrollEnabled: 主畫面是否可滾動。網站本身就會處理 scroll,
     * Capacitor 內層 WebView 也預設可滾,這裡用 true 配合 contentInset 自動處理。
     */
    scrollEnabled: true,
  },

  /**
   * webDir 即使我們用 server.url 載線上版,Capacitor CLI 仍要求這欄。
   * 指向 public/(網站的靜態檔資料夾)當 dummy 即可,反正不會被打包。
   */
  webDir: "public",

  /**
   * Plugin 設定。
   * SplashScreen:啟動畫面(由 @capacitor/splash-screen 提供,需另外 npm install)。
   * 第一版可不裝,iOS 預設 LaunchScreen.storyboard 配合 backgroundColor 已經夠用。
   * 列出來方便之後 enable:
   *
   *   plugins: {
   *     SplashScreen: {
   *       launchShowDuration: 1500,
   *       backgroundColor: "#0a0a1a",
   *       showSpinner: false,
   *     }
   *   }
   */
};

export default config;
