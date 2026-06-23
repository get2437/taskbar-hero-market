import { redirect } from "next/navigation";

// アイテム一覧はホーム ("/") に統合。旧URL /items は / へリダイレクト。
export default function ItemsRedirect() {
  redirect("/");
}
