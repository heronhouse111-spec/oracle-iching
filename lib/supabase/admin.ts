import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with SERVICE_ROLE privileges.
 *
 * 用途:後端 API route 需要繞過 RLS 做系統級操作時使用
 *   - 扣點 / 加點 / 退點(credit_transactions 只允許 service_role 寫)
 *   - 之後的 webhook 處理(訂閱 / 金流)也會用到
 *
 * 🚫 絕對不能在 client component、browser code、或任何可能
 *    被 bundle 進前端的檔案中 import 這個模組。
 *    ——SERVICE_ROLE_KEY 外流 = 整個資料庫被接管。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
