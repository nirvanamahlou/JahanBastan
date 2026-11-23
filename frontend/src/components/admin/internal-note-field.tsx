type InternalNoteFieldProps = {
  defaultValue?: string | null;
};

/**
 * Editor-only metadata. This value is sent exclusively to admin endpoints and
 * is intentionally absent from all public API schemas.
 */
export function InternalNoteField({ defaultValue = "" }: InternalNoteFieldProps) {
  return (
    <section className="space-y-2 rounded-2xl border border-dashed border-brand/35 bg-brand/5 p-4">
      <div>
        <h3 className="font-black text-brand">یادداشت داخلی</h3>
        <p className="mt-1 text-xs leading-6 text-muted">
          فقط برای مدیران و ویرایشگران در پنل قابل مشاهده است و در سایت عمومی نمایش داده نمی‌شود.
        </p>
      </div>
      <textarea
        className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-7"
        defaultValue={defaultValue ?? ""}
        name="internalNote"
        placeholder="یادداشت داخلی برای همکاران؛ مثلاً منبع اطلاعات، مورد پیگیری یا وضعیت هماهنگی"
        rows={4}
      />
    </section>
  );
}
