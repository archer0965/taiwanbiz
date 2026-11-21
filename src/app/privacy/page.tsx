import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { BUSINESS_EMAIL, LINE_OFFICIAL_ID } from "@/lib/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策｜拓脈（Nova Crest Pulse）",
  description:
    "拓脈隱私權政策：說明個資蒐集、處理、利用方式，並聲明符合台灣《個人資料保護法》。",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy Policy"
      title="隱私權政策"
      description="拓脈（Nova Crest Pulse）重視您的隱私權與個人資料保護。本政策說明我們與使用本平台之店家，如何蒐集、處理、利用與保護個人資料，並遵循中華民國《個人資料保護法》及相關法令。"
    >
      <LegalSection id="controller" title="一、資料蒐集者與適用對象">
        <p>
          本政策適用於造訪拓脈官方網站、填寫諮詢表單、使用示範店家前台，以及店家透過本平台互動行銷模組接觸之終端顧客。依場景不同，個人資料之「蒐集者／保有者」可能為：
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-white">本公司（拓脈）</span>
            ：處理商務諮詢、帳號、帳單與平台維運相關資料。
          </li>
          <li>
            <span className="font-semibold text-white">店家用戶</span>
            ：透過刮刮樂、優惠券、聯絡表單等模組蒐集其顧客名單時，原則上由該店家作為資料蒐集／保有者，並應自行履行個資法告知與保全義務；本公司僅於提供系統服務之必要範圍內受託處理。
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="collect" title="二、蒐集之個人資料類別與來源">
        <p>視使用情境，可能蒐集之資料包括但不限於：</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>識別類：姓名、店家／品牌名稱、LINE ID、電子郵件、電話／手機號碼。</li>
          <li>
            特徵與商務類：店面類型、感興趣方案、需求說明、營業地址與公開聯絡資訊。
          </li>
          <li>
            互動行銷類：顧客參加刮刮樂／優惠券時提供之台灣手機號碼、中獎紀錄、兌換序號與相關活動識別資訊。
          </li>
          <li>
            電商交易類（Pulse Shop）：收件人姓名、電話、地址、訂單內容、付款狀態、物流單號，以及店家提供之撥款銀行帳戶資訊（供結算匯款）。
          </li>
          <li>
            帳單與金流類：訂閱方案、扣款結果、綠界等金流回傳之交易／會員識別碼（不含完整信用卡卡號；卡號由金流商依 PCI 規範處理）。
          </li>
          <li>
            技術類：IP、裝置／瀏覽器資訊、Cookie 或類似技術、操作紀錄（用於安全與服務改善）。
          </li>
        </ul>
        <p>資料來源包含您主動填寫、店家後台設定，以及系統為提供服務所自動產生之紀錄。</p>
      </LegalSection>

      <LegalSection id="purpose" title="三、蒐集目的與利用方式">
        <p>個人資料之蒐集與利用，將於特定目的必要範圍內為之，主要包括：</p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>提供、維護、改善微型官網與後台功能，完成訂閱與客服支援。</li>
          <li>回覆商務諮詢、報價、合約與技術支援（例如透過 LINE 或 Email）。</li>
          <li>
            <span className="font-semibold text-white">互動行銷模組用途</span>
            ：店家透過刮刮樂、優惠券等功能收集顧客手機號碼與名單，目的在於核發／驗證優惠、防止重複領取、活動通知，以及店家後續合法之顧客經營（如到店兌換提醒）。該等名單原則供「該店家」於告知之目的範圍內使用。
          </li>
          <li>
            <span className="font-semibold text-white">Pulse Shop 與撥款</span>
            ：處理訂單履約、平台服務抽成（每筆成功交易 3%）、第三方金流／物流手續費之代收代付，以及每月結算後匯入店家指定帳戶；並於欠費或違約暫停時依法／依約處理未結算款項之抵扣與通知。
          </li>
          <li>資安監控、詐欺防制、爭議處理與法令遵循。</li>
        </ol>
        <p>
          非經當事人同意或法令許可，本公司不會將個人資料用於與蒐集目的無正當關聯之行銷，亦不會出售個人資料。
        </p>
      </LegalSection>

      <LegalSection id="pdpa" title="四、符合《個人資料保護法》之承諾">
        <p>
          本公司承諾依台灣《個人資料保護法》及相關子法，以合理安全措施保護所持有之個人資料，防止個人資料被竊取、竄改、毀損、滅失或洩漏。未經授權，本公司不會出售、出租或以其他不正當方式對外提供個人資料。
        </p>
        <p>
          店家用戶使用本平台蒐集顧客個資時，應自行完成告知義務（蒐集目的、資料類別、利用期間／地區／對象／方式、當事人權利及不提供之影響等），並僅在合法、特定目的範圍內利用。若店家違反個資法令，應自行承擔相關法律責任；本公司得要求改正或暫停相關功能。
        </p>
        <p>
          當事人就本公司所持有之個人資料，得依法請求查詢／閱覽、製給複製本、補充／更正、停止蒐集／處理／利用或刪除。惟依法本公司得因執行業務所必須或法令規定拒絕部分請求，並將說明理由。
        </p>
      </LegalSection>

      <LegalSection id="retention" title="五、利用期間、地區、對象與方式">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-white">期間</span>
            ：至特定目的消失、契約終止後依法／依約應保存之期間屆滿，或您行使刪除／停止利用且無保存義務時為止。
          </li>
          <li>
            <span className="font-semibold text-white">地區</span>
            ：中華民國境內；若使用境外雲端服務，將於必要且合法範圍內處理，並要求相當於我國之合理保護措施。
          </li>
          <li>
            <span className="font-semibold text-white">對象</span>
            ：本公司、受託處理之金流／雲端／通訊服務商、以及經您同意或依法得揭露之對象；店家顧客名單原則僅提供予該店家用戶。
          </li>
          <li>
            <span className="font-semibold text-white">方式</span>
            ：以自動化機器或其他非自動化方式為蒐集、處理、利用、傳輸與儲存。
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title="六、Cookie 與類似技術">
        <p>
          本網站可能使用 Cookie 或類似技術以維持登入狀態、記住偏好、進行安全防護與流量分析。您可透過瀏覽器設定管理 Cookie；惟停用後部分功能可能無法正常運作。
        </p>
      </LegalSection>

      <LegalSection id="contact" title="七、聯絡方式與政策更新">
        <p>
          如對本政策或個人資料權利行使有疑問，請聯絡：Email {BUSINESS_EMAIL}
          ；LINE {LINE_OFFICIAL_ID}。
        </p>
        <p>
          本公司得因法令、業務或技術變更更新本政策，並於網站公告。重大變更時，將以網站提示或其他適當方式告知。繼續使用本服務即視為知悉更新後內容。
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
