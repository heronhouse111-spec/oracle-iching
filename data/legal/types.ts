/**
 * data/legal/types.ts — Shared schema for /privacy and /terms legal docs.
 *
 * 為什麼要 JSON-driven:
 *   隱私權 / 服務條款本來就 ~500 行純內容,5 語系 = 2500 行 JSX 太肥。
 *   抽成資料 → component 變短,翻譯走 scripts/translate-static-data.mjs 補完。
 *
 * 段落的 inline 語法(在 paragraph string 裡):
 *   - `**xxx**`         → <strong>xxx</strong>
 *   - `[text](/path)`   → 內部 next/link
 *   - `[text](http://)` → external <a target="_blank">
 *   - `[text](mailto:)` → <a href="mailto:...">
 */

export interface SectionBlock {
  /** "paragraph" 是普通段落,允許上述 inline 語法;"list" 是條列每條一行,同樣支援 inline */
  type: "paragraph" | "list";
  /** type=paragraph 時為單一段落字串,type=list 時為每個 li 的字串陣列 */
  content: string | string[];
}

export interface LegalSection {
  /** 章節標題,未設則為前言 / 收尾段落 */
  heading?: string;
  blocks: SectionBlock[];
}

export interface LegalDoc {
  /** 標題,顯示在 h1 */
  title: string;
  /** 「最後更新日期」一行;不需翻譯結構,但需要本地化文字(eg "最後更新日期: 2026 年 4 月 21 日") */
  lastUpdated: string;
  sections: LegalSection[];
  /** 收尾的灰色 callout,例如「您使用本服務即代表已詳閱並同意…」 */
  footerNote?: string;
}
