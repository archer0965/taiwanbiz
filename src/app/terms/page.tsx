import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell";
import { BUSINESS_EMAIL, LINE_OFFICIAL_ID } from "@/lib/pricing";
import { GRACE_PERIOD_DAYS } from "@/lib/tenants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服務條款｜拓脈（Nova Crest Pulse）",
  description:
    "拓脈服務條款：實體服務業預約導流、自主經營雙方案、付款解約與智慧財產權。",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms of Service"
      title="服務條款概述"
      description="本條款適用於拓脈（Nova Crest Pulse）所提供之實體服務業微型官網、線上預約導流與互動行銷服務。使用本服務即表示您已閱讀、瞭解並同意下列約定。"
      updatedAt="2026-11-19"
    >
      <LegalSection id="parties" title="一、契約當事人與適用範圍">
        <p>
          本服務由「拓脈／Nova Crest Pulse」（下稱「本公司」）提供。訂閱、試用或以其他方式使用本平台之店家、工作室或企業用戶（下稱「用戶」）應遵守本條款。若用戶為法人或商號，代表簽署或下訂之人保證其已獲合法授權。
        </p>
        <p>
          正式接案之個別報價單或訂單，若與本概述有特別約定，以個別文件為準；未特別約定之部分，適用本條款。
        </p>
      </LegalSection>

      <LegalSection id="services" title="二、服務內容與訂閱機制">
        <p>
          本公司專注實體服務業（美甲、美睫、沙龍、個人工作室等）預約導流，提供自主經營雙方案，用戶得依營運需求選擇並可依平台規則升降級：
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <span className="font-semibold text-white">極速預約基礎版</span>
            ：線上極速預約表單（項目／時段／防重疊）、預約成功與 LINE
            即時推播、每日晚間隔日行程彙整，以及賣家後台預約統計與視覺化日曆。
          </li>
          <li>
            <span className="font-semibold text-white">品牌導流旗艦版</span>
            ：含基礎版全部能力，另含專屬品牌形象微型官網（自訂風格／作品與價目表）與手機互動刮刮樂（熟客留客與
            LINE 導流）。創始名額限量前 15 組：含 14 天免費試用，之後續費終身 8 折。
          </li>
        </ol>
        <p>
          服務範圍以當期方案規格與定價頁為準；本平台為純自助預約 SaaS，不含網拍購物車或超商金物流。
        </p>
        <p>
          訂閱採月繳或年繳（年繳另享折扣，計算方式以定價頁或訂單為準）。服務採先註冊流程：新店先開通帳號再進入試用。創始名額內新店得享 14
          天免費全功能試用；額滿後新客改為 3
          天免費試用（每店一次）。試用期間不扣款，試用結束前應完成正式訂閱付款；若忘記續費，網站得保留 30
          日，其後系統得暫停服務。正式訂閱自成功付款日起算，並依帳單週期自動續訂，直至用戶依本條款完成解約或本公司依法／依約終止服務。創始會員試用結束後每次續費終身 8
          折；額滿後新客依原價訂閱。
        </p>
      </LegalSection>

      <LegalSection id="self-serve-scope" title="三、自主經營與支援範圍">
        <p className="font-semibold text-white">3.1 用戶自行維運</p>
        <p>
          用戶得於後台自行維護服務項目、預約時段、刮刮樂活動與店家資料。本公司提供系統平台、教學資源與客服支援。
        </p>
        <p className="font-semibold text-white">3.2 需另行報價之項目</p>
        <p>
          下列事項不屬標準訂閱範圍，須另行評估工期與報價後方執行：大規模風格改版、版型重構、客製化功能開發、第三方系統串接、額外行銷企劃製作、大量素材重製，或其他超出原方案規格之需求。
        </p>
      </LegalSection>

      <LegalSection id="billing" title="四、付款、續約、欠費與暫停">
        <p className="font-semibold text-white">4.1 付款</p>
        <p>
          用戶應依訂單約定之週期（月繳／年繳）支付費用。訂閱採綠界金流（含信用卡、定期定額、ATM 虛擬帳號、超商代碼等已開通通路）：付款成功後由系統自動開通或展延。已開立之合法憑證依稅務與會計規範辦理。
        </p>
        <p className="font-semibold text-white">4.2 升降級</p>
        <p>
          升級原則上立即生效，並得依剩餘天數比例計費；降級原則於下一計費週期生效。創始會員一經確認，其終身 8 折續費資格適用於後續任一升降級後之訂閱。細節以訂單或客服確認為準。
        </p>
        <p className="font-semibold text-white">4.3 欠費寬限與服務暫停（Suspended）</p>
        <p>
          試用或訂閱到期未續費時，訂閱狀態得改為待處理（Pending），並給予網站保留寬限期（預設{" "}
          {GRACE_PERIOD_DAYS}{" "}
          日，實際天數以系統設定或訂單為準）。寬限期內前台網站原則上仍可保留，用戶應完成補繳；逾期仍未成功扣款或人工確認收款者，本公司得將店家狀態改為暫停（Suspended），限制或關閉其獨立前台、後台與相關模組，直至補繳完成並經系統或總管重新啟用。暫停期間之訂閱費用得依訂單約定繼續計算或另行協商。
        </p>
        <p className="font-semibold text-white">4.4 解約與年繳提前終止</p>
        <p>
          用戶得於當期服務結束前，透過店家後台「訂閱付款」頁面自行提出解約，或依本公司客服／總管指定方式辦理。解約後將停止後續續約提醒與展延，當期服務原則上可用至當期帳單結束日，其後系統得暫停前台與後台。採年繳之用戶若於合約期未屆滿前申請提前解約，除法令另有規定或雙方書面另行同意外，應按「月費原價 × 已使用（含當月）月數」計算應收費額，並就年繳實付金額與前述應收費額之差額補足；已提供之客製開發或一次性建置費原則不予退還。
        </p>
      </LegalSection>

      <LegalSection id="booking" title="五、預約導流、刮刮樂與顧客資料">
        <p>
          本節適用於實體服務業預約導流方案。本公司提供微型官網、線上預約、刮刮樂留客、LINE
          提醒與 VIP
          名單等工具；服務品質、現場收費、預約變更與消費爭議，原則由用戶對其顧客負責。
        </p>

        <p className="font-semibold text-white">5.1 線上預約</p>
        <p>
          系統得提供服務項目選擇、服務人員／設計師指定、時段排程與自動防重疊等功能（依方案等級開放）。用戶應據實標示服務內容、時長與可預約時段，並自行處理現場改期、取消與 No-show
          政策。
        </p>

        <p className="font-semibold text-white">5.2 刮刮樂與優惠券</p>
        <p>
          刮刮樂／優惠券模組用於到店或預約後之留客與名單回收。用戶應確保優惠內容合法、可履行，並妥善保管透過本服務取得之顧客聯絡資料。
        </p>

        <p className="font-semibold text-white">5.3 LINE 自動化雙向通知</p>
        <p>
          方案得依規格提供雙向通知：顧客端為預約成功確認與到店／服務行前
          LINE
          提醒；店家端為新預約成立時，以 LINE／Email
          即時推播預約細節予店家與對應服務人員。實際訊息送達取決於用戶之官方帳號設定、顧客同意狀態與第三方通訊服務可用性；本公司不保證
          100% 送達或完全消除 No-show。
        </p>

        <p className="font-semibold text-white">5.4 已下架之網拍／金物流功能</p>
        <p>
          自本條款更新日期起，拓脈不再提供周邊商品購物車、超商 C2C
          物流、商品線上刷卡／ATM
          對帳或網拍代收代付撥款等方案。既有示範或歷史紀錄若仍可見，僅供系統維運參考，不構成持續提供該等服務之承諾。
        </p>
      </LegalSection>

      <LegalSection id="ip" title="六、智慧財產權">
        <p>
          用戶上傳或提供之店家名稱、文案、照片、商標、價格與其他素材，其著作權與相關權利仍歸用戶或合法權利人所有。用戶保證其有權授權本公司為提供服務之必要範圍內使用、重製、公開傳輸該等素材，並對第三人權利主張自負責任。
        </p>
        <p>
          本平台之系統架構、原始碼、介面設計、資料庫結構、文件與相關營業秘密，其智慧財產權歸 Nova Crest Pulse（本公司）所有。未經事前書面同意，用戶不得重製、改作、還原工程、散布或以任何方式商業利用前述資產。
        </p>
      </LegalSection>

      <LegalSection id="mandatory-storefront" title="七、店家獨立前台之硬性標示">
        <p>
          凡經本公司提供系統建置之店家獨立前台（含子網域、示範站或正式站），頁面底部應硬性顯示平台標示（Powered
          by 拓脈／Nova Crest Pulse）、服務條款與隱私權政策連結，以及智慧財產權與個人資料相關必要聲明。該等區塊屬系統強制元件，用戶不得要求移除、遮蓋或以技術方式規避；違反者本公司得暫停服務並請求排除侵害。
        </p>
      </LegalSection>

      <LegalSection id="liability" title="八、責任限制與準據法">
        <p>
          本服務依現況提供。對於因不可抗力、第三方雲端／電信中斷、用戶素材錯誤、或用戶未依建議維護資安所生之損害，本公司於法律允許範圍內不負賠償責任。可歸責於本公司之損害賠償，以該用戶最近十二個月內就系爭服務實際支付之費用總額為上限（故意或重大過失除外）。
        </p>
        <p>
          本條款以中華民國法律為準據法。因本服務生爭議時，雙方應先善意協商；協商不成者，以臺灣臺中地方法院為第一審管轄法院（若用戶營業所在地另有強制規定，從其規定）。
        </p>
        <p>
          諮詢與客服：Email {BUSINESS_EMAIL}；LINE {LINE_OFFICIAL_ID}。
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
