/** 以隱藏表單 POST 導向綠界收銀台（瀏覽器端） */
export function redirectToEcpay(
  action: string,
  params: Record<string, string>,
) {
  if (typeof document === "undefined") {
    throw new Error("redirectToEcpay 僅能在瀏覽器執行");
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.acceptCharset = "UTF-8";
  form.style.display = "none";

  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
