import { QuotationDocumentView } from "@/components/admin/quotation-document";
import { buildQuotationDocument } from "@/lib/quotation";
import { getTenantDbByStoreId } from "@/lib/tenant-db.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** 依店家動態讀取訂閱資料，允許阻塞式伺服器渲染 */
export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tenant = await getTenantDbByStoreId(id);
  const name = tenant?.name ?? id;
  return {
    title: `服務確認單｜${name}｜拓脈`,
    description: `拓脈（Nova Crest Pulse）服務確認單與報價單：${name}`,
  };
}

export default async function AdminQuotationPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getTenantDbByStoreId(id);
  if (!tenant) {
    notFound();
  }

  const document = buildQuotationDocument(tenant);

  return <QuotationDocumentView document={document} />;
}
