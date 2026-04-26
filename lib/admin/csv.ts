/**
 * CSV 共用 helpers — 為 Excel 友善:UTF-8 BOM + CRLF + 雙引號跳脫
 */

export function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    // 包含 , " \r \n 都需要用 " 包起來,內部 " 變成 ""
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [];
  lines.push(headers.map(escape).join(","));
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  // BOM 讓 Excel 自動辨識為 UTF-8
  return "﻿" + lines.join("\r\n");
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
