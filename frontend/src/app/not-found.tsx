import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-sm font-bold text-brand">خطای ۴۰۴</p>
      <h1 className="mt-3 text-4xl font-black">این صفحه پیدا نشد</h1>
      <p className="mt-4 text-muted">ممکن است آدرس تغییر کرده یا محتوا حذف شده باشد.</p>
      <ButtonLink href="/" className="mt-8">
        بازگشت به صفحه اصلی
      </ButtonLink>
    </Container>
  );
}
