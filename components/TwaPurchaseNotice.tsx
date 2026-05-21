/**
 * @deprecated 2026-04-25 起停用。
 *
 * 舊架構:TWA 殼內代替 in-app purchase UI 的「請到網頁版」靜態告示卡。
 *
 * 為什麼移除:
 *   這個 component 顯示 oracle.heronhouse.me URL + 「請於瀏覽器開啟」文字,
 *   違反 Google Play anti-steering 政策(不能在 app 內引導使用者到外部付款)。
 *
 * 新架構:
 *   - TWA 內使用 Play Billing(透過 Digital Goods API)直接購買
 *   - Web 內使用 ECPay(透過 heronhouse-payments hub)
 *   - 兩條路徑共用 /account/credits + /account/upgrade 頁,內部依環境分流
 *
 * 這個檔案保留為空殼一陣子是因為:萬一有人新功能不小心 import 進去,
 * 編譯不會壞,但執行階段會出 deprecated warning。確認沒任何引用後再 git rm。
 */

import { useEffect } from "react";

interface Props {
  kind?: "credits" | "subscription";
}

export default function TwaPurchaseNotice({ kind: _kind }: Props) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.warn(
        "[deprecated] TwaPurchaseNotice 已停用,請改用 /account/credits 或 /account/upgrade 頁面(內含 Play Billing + ECPay 雙路徑)"
      );
    }
  }, []);
  return null;
}
