import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getTranslator } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getTranslator();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl font-black text-muted-foreground/30">404</div>
      <p className="text-muted-foreground">{t("notfound.message")}</p>
      <Button asChild>
        <Link href="/">{t("notfound.back")}</Link>
      </Button>
    </div>
  );
}
