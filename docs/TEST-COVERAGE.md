# テスト網羅表 (Test Coverage Matrix)

対象: Taskbar Hero Market Analytics。2026-06-19 時点の全機能（検索A-E / 9言語i18n / 7通貨 / ライブ取得 / OG）。

環境制約: **この環境は Postgres/Redis 無し（Docker Desktop不安定）**。DB依存のE2Eは実行不可 → 「静的/純粋ロジック/データ整合/コードレビュー」で網羅する。各項目に `DB要` を明記。

判定: PASS / FAIL / BLOCKED(環境) / WARN。FAIL/WARN は詳細と再現を残すこと。

---

## A. 静的ゲート / ビルド
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| A1 | 型整合 | `npx tsc --noEmit` | エラー0 | No |
| A2 | 本番ビルド | `npx next build` | 成功・全ルート生成・警告(Dynamic server等)なし | No |
| A3 | Prismaスキーマ | `npx prisma validate` | valid | No |
| A4 | マイグレーションとスキーマ一致 | `20260619120000_stat_lines` SQL を schema.prisma と突合（enum順/カラム型/NOT NULL/DEFAULT/index名/FK） | 完全一致 | No |
| A5 | Lint | `npx next lint`（設定あれば） | 重大な警告なし | No |

## B. 説明文パーサ (`src/lib/steam/descriptions.ts`)
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| B1 | 装備パース | 単体テスト（基礎/固有/スロット/必要Lv/grade/itemType） | 全項目正しく構造化 | No |
| B2 | 装飾素材 | materialEffects（武器/防具/装飾品・tier・range） | target別・[T2]→2・min~max正しい | No |
| B3 | 彫刻素材 "Effect List" | `Weapon Engraving Effect List` 形式 | materialEffects取得（flavorに漏れない） | No |
| B4 | 碑文素材 target無し + tier範囲 | `Inscription Effect List` / `[T6-T8]` | appliesTo=NONE・tier=下限 | No |
| B5 | 特殊(Unique)ステータス | `Unique Stats` セクション | TEXT保持・数値を文章から剥がさない | No |
| B6 | 値スケール | "+36.9"→3690 / "38%"→3800 PCT / "423"→42300 | ×100整数・unit正しい | No |
| B7 | 値先頭表記 | "39% Increased Area of Effect" | value/label分離正しい | No |
| B8 | materialCategory判定 | type文字列→enum | Decoration/Engraving/Inscription/Crafting/Soulstone | No |
| B9 | 多重エスケープ解除 | `\\\"`/`\\\\n` を含むHTML | 正しくアンエスケープ | No |
| B10 | toStatLines/toItemDescriptionFields | 変換結果 | kind/appliesTo/値が一致 | No |
| B11 | エッジ: 空/壊れたHTML | descriptions無し | 例外なくEMPTY返す | No |

## C. 通貨 / 為替 (`src/lib/money/`, `src/lib/fx.ts`)
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| C1 | formatMoney JPY | JPYは実値・≈なし | "￥8" | No |
| C2 | formatMoney 他通貨 | USD/EUR/KRW/CNY/RUB/BRL 換算+≈ | レート・ロケール書式正しい | No |
| C3 | 換算式 | yen × (rate[cur]/rate.JPY) | 数値正確（手計算と一致） | No |
| C4 | currencyForLocale | en→USD…es/fr/de→EUR | マップ通り | No |
| C5 | isCurrency | 不正値/正常値 | 真偽正しい | No |
| C6 | 小数桁 | JPY/KRW/RUB=0桁, USD/EUR/CNY/BRL=2桁 | META通り | No |
| C7 | getRates フォールバック | API失敗/Redis無し | STATIC_RATES返す・例外なし | No |
| C8 | fetch が静的生成を壊さない | `next:{revalidate}` 使用確認 | no-store不使用 | No |
| C9 | クライアント混入なし | money/provider が fx/redis を import しない | ioredisがclient bundleに入らない | No |

## D. i18n 網羅 (9言語: en/ja/ko/zh/ru/pt/es/fr/de)
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| D1 | messages 全エントリ9言語 | 各entryに9locale存在 | 欠落0（215件） | No |
| D2 | facetMessages 9言語 | 同上 | 欠落0（34件） | No |
| D3 | stat-i18n.json 9言語 | ui/stats/unique 各entry | 欠落0（ui31/stats44/unique6） | No |
| D4 | STAT_KEYS=44 / グループ網羅 | STAT_GROUP_OF が全44キーを分類 | offense/defense/resist/sustain に漏れなく割当 | No |
| D5 | LOCALES整合 | LOCALES=9・LOCALE_LABEL=9 | 一致 | No |
| D6 | demo DICT/FT 9言語 | demo.html DICT(139)/FT(33) | 各entryにpt/es/fr/de | No |
| D7 | 改行コード | messages.ts/demo.html/stat-i18n.json | LF（CRLF混入なし） | No |
| D8 | 翻訳プレースホルダ整合 | `◯`/`%`等を含むkey | 各言語で記号保持 | No |

## E. データ整合 (assets/)
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| E1 | stats.json 件数 | 136件・JSON妥当 | パース可 | No |
| E2 | 表示アイテム全てステータス完備 | market.json(unique) ⊂ stats.json | 漏れ0 | No |
| E3 | 装備に基礎/固有あり | gear で baseStats∪inherentStats 非空 | 漏れ0 | No |
| E4 | 素材カテゴリ網羅 | Decoration/Engraving/Inscription に効果あり | 製作/ソウルストーン=効果なし(正常) | No |
| E5 | stat-i18n stats=実出現キーの上位集合 | data出現キー ⊂ stat-i18n.stats | 未訳キー0 | No |
| E6 | 異常値 | valueMin負/極端 | 想定内 | No |

## F. 検索クエリ (`src/lib/queries.ts`) — コードレビュー中心
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| F1 | statKeys AND合成 | where.AND に statLines.some を複数 | 1行混在でなくAND | レビュー(DB要) |
| F2 | matCategories IN | enum許可リスト+in | サニタイズ | レビュー |
| F3 | withUnique | kind=SPECIAL some | 別some | レビュー |
| F4 | reqLevel範囲 | gte/lte | 正しい | レビュー |
| F5 | sanitizeKey | `[^a-z0-9_]`除去 | インジェクション防止 | No |
| F6 | enum許可リスト | type/grade/part/class/matcat/statKind | 不正値除去 | No |
| F7 | cheapest取得 | sort=price asc pageSize=1 | 別fetch・全体最安 | レビュー |
| F8 | getItemsForCompare | ids順序保持・最大8 | 順序・上限 | レビュー |

## G. API ルート — 構造/パラメータ
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| G1 | /api/items パラメータ | statKeys/matCategories/withUnique/reqLevel配線 | listItemsへ渡る | レビュー |
| G2 | /api/items/compare | ids解析 | getItemsForCompare | レビュー |
| G3 | /api/admin/refresh-descriptions | 認可・max同期/202背景 | isAdmin・分岐 | レビュー |
| G4 | 認可 | admin系 fail-closed | timingSafeEqual | No(レビュー) |

## H. ライブ取得 / jobs / worker
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| H1 | fetchItemDescription | 実Steam1件 | パース成功 | No(ネット要) |
| H2 | refreshDescriptions ロジック | トランザクション(Item更新+statLines差替) | 途中状態なし・fail継続 | レビュー(DB要) |
| H3 | worker タイマー | desc日次/hot20s/fx12h/fx起動時 | 設定通り | No(レビュー) |
| H4 | refreshRates | invalidate→getRates | 正常 | No(レビュー) |

## I. デモ (`demo.html`)
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| I1 | build-demo 成功 | `node scripts/build-demo.mjs` | 全placeholder注入 | No |
| I2 | JSON妥当 | STATS/STAT_I18N/MARKET/TAGS | パース可 | No |
| I3 | JS構文 | ブラウザ load / console error | エラー0 | プレビュー要 |
| I4 | 言語9種切替 | 各言語でナビ/フィルタ/詳細 | 全翻訳 | プレビュー要 |
| I5 | 通貨7種切替+言語連動 | curSel/langSel | 換算・連動・override | プレビュー要 |
| I6 | 検索A-E | 素材分類/ステータス/特殊/最安/クリック遷移 | 動作 | プレビュー要 |
| I7 | レスポンシブ | 375/768 | 崩れなし | プレビュー要 |

## J. SEO / OG / 共有
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| J1 | OGルート生成 | build出力 | /opengraph-image・/items/[id]/opengraph-image | No |
| J2 | OG価格USD化 | item OGがgetRates+formatMoney(USD) | 実装確認 | レビュー |
| J3 | OGバッジ更新 | "9 languages · 7 currencies" | 確認 | No |
| J4 | metadata | title/description/twitter large image | 設定確認 | No |
| J5 | sitemap/robots | ルート存在 | 生成 | No |

## K. セキュリティ / 堅牢性
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| K1 | 入力検証 | queries enum許可/clampInt/sanitizeKey | 防御 | No |
| K2 | レート制限 | middleware.ts | in-memory単一VPS | No(レビュー) |
| K3 | admin fail-closed | admin-auth.ts | token必須・timingSafe | No |
| K4 | エラー境界 | error.tsx/global-error.tsx/og-fallback | 500回避 | No |
| K5 | Steam取得バックオフ | steam/http.ts | 429/5xx再試行 | No |

## L. デプロイ整合
| ID | 確認内容 | 方法 | 期待 | DB要 |
|----|----------|------|------|------|
| L1 | Dockerfile コピー | assets/src/scripts/prisma/tsx | 新ファイル含む | No |
| L2 | entrypoint | migrate deploy + 冪等seed | 流れ正しい | No |
| L3 | compose worker env | DESC_*/HOT_*/FX | 渡る/既定 | No |
| L4 | 一時ファイル残骸 | thb_*/public/demo.html/*.log | なし | No |
