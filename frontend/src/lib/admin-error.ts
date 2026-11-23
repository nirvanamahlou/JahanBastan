const fieldLabels: Record<string, string> = {
  title: "عنوان",
  name: "نام",
  slug: "Slug",
  destinationId: "مقصد",
  hotelId: "هتل",
  starRating: "تعداد ستاره",
  summary: "خلاصه",
  description: "توضیحات",
  galleryImageIds: "گالری تصاویر",
  itineraryDays: "برنامه روزانه",
  departures: "تاریخ‌های برگزاری",
  hotelPackages: "پکیج‌های هتل",
  dayNumber: "شماره روز",
  label: "عنوان تاریخ",
  nights: "تعداد شب",
};

export async function adminErrorText(
  response: Response | null,
  subject: string,
) {
  if (!response) return "ارتباط با سرور برقرار نشد.";
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { loc?: (string | number)[]; msg?: string }[] }
    | null;
  if (typeof body?.detail === "string") {
    if (body.detail.includes("slug")) {
      return `Slug این ${subject} قبلاً استفاده شده یا معتبر نیست.`;
    }
    return body.detail;
  }
  if (Array.isArray(body?.detail)) {
    return body.detail
      .map((error) => {
        const field = String(error.loc?.at(-1) ?? "اطلاعات");
        return `${fieldLabels[field] ?? field}: ${error.msg ?? "نامعتبر است"}`;
      })
      .join("؛ ");
  }
  return `ذخیره ${subject} ناموفق بود (خطای ${response.status}).`;
}
