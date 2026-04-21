/**
 * opencc-js 型別 shim —— 官方 types 若有,會因為 skipLibCheck 忽略差異;
 * 若沒有,這支補足最低必要欄位讓 tsc 不爆。
 */
declare module "opencc-js" {
  export type OpenCCLocale =
    | "cn"
    | "tw"
    | "hk"
    | "twp"
    | "jp"
    | "t"
    | "s";

  export interface ConverterOptions {
    from: OpenCCLocale;
    to: OpenCCLocale;
  }

  export function Converter(
    options: ConverterOptions
  ): (text: string) => string;

  export function HTMLConverter(
    converter: (text: string) => string,
    element: HTMLElement,
    fromLang: string,
    toLang: string
  ): { convert: () => void; restore: () => void };
}
