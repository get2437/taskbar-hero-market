// assets/news.json (Steam実ニュース) に5言語の翻訳タイトル/要約を付与して assets/news-i18n.json を生成。
// 翻訳は要約(1-2文)。原文は英語。
import fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("assets/news.json", "utf8")).appnews.newsitems;
const fmtDate = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

// 記事ごとの翻訳 (gid で対応付け / 順序は新しい順)
const T = [
  {
    title: { en: "Server Migration & Steam Market Reopening Schedule", ja: "サーバー移行と Steam マーケット再開スケジュール", ko: "서버 마이그레이션 및 스팀 마켓 재개 일정", zh: "服务器迁移与 Steam 市场重启计划", ru: "Миграция серверов и график открытия Steam Маркета" },
    summary: {
      en: "Due to server overload, the team is migrating key game data to a more stable structure. The Steam Market will reopen once the migration is complete.",
      ja: "サーバー過負荷に対応するため、主要なゲームデータをより安定した構成へ移行しています。移行完了後に Steam マーケットを再開します。",
      ko: "서버 과부하에 대응하기 위해 주요 게임 데이터를 더 안정적인 구조로 이전하고 있습니다. 이전이 끝나면 스팀 마켓을 다시 엽니다.",
      zh: "为应对服务器过载，团队正在将关键游戏数据迁移到更稳定的架构。迁移完成后将重新开放 Steam 市场。",
      ru: "Из-за перегрузки серверов команда переносит ключевые игровые данные в более стабильную структуру. Steam Маркет откроется после завершения миграции.",
    },
  },
  {
    title: { en: "Notice: Temporary Closure of the Steam Market", ja: "お知らせ：Steam マーケットの一時停止", ko: "안내: 스팀 마켓 일시 중단", zh: "公告：Steam 市场暂时关闭", ru: "Уведомление: временное закрытие Steam Маркета" },
    summary: {
      en: "Listing items on the Steam Market has been temporarily suspended, and the in-game Trade Ship menu has been disabled accordingly.",
      ja: "Steam マーケットへの出品を一時的に停止し、ゲーム内の交易船メニューも無効化しました。",
      ko: "스팀 마켓 아이템 등록이 일시 중단되었으며, 그에 따라 게임 내 무역선 메뉴도 비활성화되었습니다.",
      zh: "Steam 市场的上架功能已暂时停用，游戏内的贸易船菜单也随之关闭。",
      ru: "Размещение предметов в Steam Маркете временно приостановлено, а внутриигровое меню «Торговый корабль» отключено.",
    },
  },
  {
    title: { en: "Chest Error Hotfix & Update Postponement Notice", ja: "宝箱不具合のホットフィックスとアップデート延期のお知らせ", ko: "상자 오류 핫픽스 및 업데이트 연기 안내", zh: "宝箱错误热修复与更新延期公告", ru: "Хотфикс ошибки сундуков и перенос обновления" },
    summary: {
      en: "A hotfix fixed an issue where chests were not appearing. The scheduled \"Relay Server Addition\" update has been postponed.",
      ja: "宝箱が表示されない不具合をホットフィックスで修正しました。予定していた「中継サーバー追加」アップデートは延期します。",
      ko: "상자가 나타나지 않던 문제를 핫픽스로 수정했습니다. 예정된 '중계 서버 추가' 업데이트는 연기되었습니다.",
      zh: "已通过热修复解决宝箱不显示的问题。原定的“中继服务器新增”更新已延期。",
      ru: "Хотфикс устранил проблему, из-за которой не появлялись сундуки. Запланированное обновление «Добавление релейных серверов» отложено.",
    },
  },
  {
    title: { en: "Temporary Closure of the Steam Market", ja: "Steam マーケットの一時停止について", ko: "스팀 마켓 일시 중단 안내", zh: "Steam 市场暂时关闭", ru: "Временное закрытие Steam Маркета" },
    summary: {
      en: "From the June 8 update, listing new items on the Steam Market will be temporarily disabled. Cancelling existing listings and buying items remain available.",
      ja: "6月8日のアップデート以降、Steam マーケットへの新規出品を一時的に停止します。既存出品のキャンセルや購入は引き続き可能です。",
      ko: "6월 8일 업데이트부터 스팀 마켓 신규 등록이 일시 중단됩니다. 기존 등록 취소와 구매는 계속 가능합니다.",
      zh: "自 6 月 8 日更新起，将暂时停用 Steam 市场的新上架。取消已有挂单和购买仍可正常使用。",
      ru: "С обновления 8 июня размещение новых предметов в Steam Маркете временно отключается. Отмена текущих лотов и покупка остаются доступны.",
    },
  },
  {
    title: { en: "[Advance Notice] Upcoming Update", ja: "【事前告知】今後のアップデート", ko: "[사전 안내] 향후 업데이트", zh: "【预告】即将到来的更新", ru: "[Анонс] Предстоящее обновление" },
    summary: {
      en: "The team is preparing an update to address the gameplay difficulties many players are experiencing, and apologizes for the inconvenience.",
      ja: "多くのプレイヤーが直面しているプレイ上の問題に対応するアップデートを準備しています。ご不便をおかけして申し訳ありません。",
      ko: "많은 플레이어가 겪고 있는 플레이 문제를 해결하기 위한 업데이트를 준비 중입니다. 불편을 드려 죄송합니다.",
      zh: "团队正在准备更新，以解决许多玩家遇到的游戏问题，并对带来的不便致歉。",
      ru: "Команда готовит обновление для устранения проблем, с которыми сталкиваются игроки, и приносит извинения за неудобства.",
    },
  },
  {
    title: { en: "Hotfix Update [Ver 1.00.09]", ja: "ホットフィックス更新【Ver 1.00.09】", ko: "핫픽스 업데이트 [Ver 1.00.09]", zh: "热修复更新【Ver 1.00.09】", ru: "Хотфикс [Ver 1.00.09]" },
    summary: {
      en: "A hotfix fixes a black-background rendering issue on certain OS environments and several other bugs.",
      ja: "特定の OS 環境で背景が黒くなる描画不具合など、いくつかのバグを修正するホットフィックスです。",
      ko: "특정 OS 환경에서 배경이 검게 표시되는 렌더링 문제 등 여러 버그를 수정하는 핫픽스입니다.",
      zh: "此热修复解决了在某些操作系统环境下背景显示为黑色的渲染问题及其他若干 bug。",
      ru: "Хотфикс исправляет чёрный фон при отрисовке в некоторых ОС и ряд других ошибок.",
    },
  },
];

const out = raw.slice(0, T.length).map((it, i) => ({
  date: fmtDate(it.date),
  url: it.url,
  title: T[i].title,
  summary: T[i].summary,
}));

fs.writeFileSync("assets/news-i18n.json", JSON.stringify(out, null, 1));
console.log(`wrote assets/news-i18n.json with ${out.length} articles`);
out.forEach((o) => console.log(" ", o.date, "|", o.title.en));
