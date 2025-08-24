import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

export default function RootPage() {
  // 기본 언어로 리다이렉트
  redirect(`/${defaultLocale}`);
}
