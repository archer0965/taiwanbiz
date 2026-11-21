/**
 * 對照綠界官方檢查碼範例（developers.ecpay.com.tw 檢查碼機制說明）
 * node scripts/verify-ecpay-checkmac.mjs
 */
import { createHash } from "crypto";

const key = "pwFHCqoQZGmho4w6";
const iv = "EkRm7iFT261dpevs";
const params = {
  ChoosePayment: "ALL",
  EncryptType: "1",
  ItemName: "Apple iphone 15",
  MerchantID: "3002607",
  MerchantTradeDate: "2023/03/12 15:30:23",
  MerchantTradeNo: "ecpay20230312153023",
  PaymentType: "aio",
  ReturnURL: "https://www.ecpay.com.tw/receive.php",
  TotalAmount: "30000",
  TradeDesc: "促銷方案",
};
const expected =
  "6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840";

const sorted = Object.keys(params)
  .sort((a, b) => (a > b ? 1 : -1))
  .map((k) => `${k}=${params[k]}`)
  .join("&");
let encoded = encodeURIComponent(`HashKey=${key}&${sorted}&HashIV=${iv}`).toLowerCase();
encoded = encoded
  .replace(/%20/g, "+")
  .replace(/%2d/g, "-")
  .replace(/%5f/g, "_")
  .replace(/%2e/g, ".")
  .replace(/%21/g, "!")
  .replace(/%2a/g, "*")
  .replace(/%28/g, "(")
  .replace(/%29/g, ")");
const mac = createHash("sha256").update(encoded).digest("hex").toUpperCase();

if (mac !== expected) {
  console.error("CheckMac mismatch", { mac, expected });
  process.exit(1);
}
console.log("CheckMac OK", mac);
