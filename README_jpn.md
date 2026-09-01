<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

<p align="center">
  <a href="README.md">🇺🇸 English</a> |
  <a href="README_spa.md">🇪🇸 Español</a> |
  <a href="README_fra.md">🇫🇷 Français</a> |
  <a href="README_ita.md">🇮🇹 Italiano</a> |
  <a href="README_deu.md">🇩🇪 Deutsch</a> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  🇯🇵 <b>日本語</b>
</p>


<p align="left">
  <img src="https://img.shields.io/badge/License-GPL%203.0-blue.svg" alt="GPL 3.0">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
  <img src="https://img.shields.io/badge/Tool-Vite-646CFF.svg" alt="Vite">
</p>


**Universal Robot Tool Controller（URTC）** のブラウザベースのコンパニオン
——[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
経由で USB-CAN アダプター越しに実際の URTC ハードウェアと通信する
React/Vite シングルページアプリで、2 つのデスクトップコンパニオンツール、
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) と
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER) と同じ SLCAN
フレーミングと CAN プロトコルを使用します。目標は、単一のブラウザタブ内で
それら 2 つのツールと機能的に同等であることであり、それらの簡略化された
デモではありません——Flasher Studio と Tester Studio タブは、
[URTC ファームウェアリポジトリ](https://github.com/JuanenRac/URTC) の
`docs/CANBUS.TXT` に記載された実際の CAN フレームを送受信します。

---

## 🧭 何が本物で、何がサンドボックスか

本アプリには 2 種類のタブがあります：

- **実際のハードウェア駆動タブ** —— Flasher Studio、Tester Studio、そして
  CAN Bus Protocol Analyzer。これらは、実際の USB-CAN アダプターを接続
  （右上のヘッダーボタン）した時点で初めて何かを行います。送信するすべて
  のコマンドと表示するすべての読み取り値は、実際の CAN バスから来ます。
  これには実際の**サーマルカメラの読み取り**も含まれます——Tester Studio
  の「Thermal Inspection」パネル（`0x250`/`0x251`/`0x254`/`0x255`）が、
  ツールヘッドの実際の MLX90640 赤外線アレイを CAN 経由で照会します。
- **オフラインサンドボックスタブ** —— Control（ツールカタログ）、OLED、
  Specs/BOM、そして Thermal IR Inspection。これらにより、ハードウェアを
  一切接続することなく、25 種類のツールカタログを探索し、OLED ステータス
  画面をプレビューし、BOM/ピン配置を閲覧し、シミュレートされたサーマル
  カメラフィードを表示できます。ヘッダーの「FW v0.0 / v0.1」トグルは、
  これらのサンドボックスタブ（特定のファームウェアビルドがどのツール
  プロファイルをアンロックするか）にのみ影響し、実際に接続されたボードが
  報告する内容には一切関係ありません。
  - **2 種類のサーマルビューを混同しないでください**：独立した
    「Thermal IR Inspection」タブ（`ThermalCameraViewer.tsx`）は、
    100% クライアントサイドの `Math.random()` ノイズであり、CAN トラフィック
    はまったくありません——これは UI のモックアップであり、センサーの読み
    取り値ではありません。実際の MLX9064x データは、Tester Studio の
    「Thermal Inspection」パネル内にのみ、しかもハードウェアが接続されて
    いる場合にのみ表示されます。

## 🔌 必要なハードウェア

- **SLCAN** ファームウェアを実行する USB-CAN アダプター（例：
  `candlelight`/`slcan` を実行する CANable、または標準的な `lawicel`
  SLCAN シリアルプロトコルを話す任意のアダプター）——2 つのデスクトップ
  ツールがそれぞれの Serial トランスポート経由でサポートしているのと
  同じアダプタークラスです。
- **500 kbit/s** に設定されたバス（本アプリは、デスクトップツールの
  `--auto-detect` フラグのようにビットレートを自動検出しません。常に
  500k で開きます）。
- Web Serial をサポートするブラウザ——**Chrome または Edge**。Firefox
  と Safari は Web Serial を実装しておらず、まったく接続できません。
- Web Serial にはセキュアコンテキスト（HTTPS）または `localhost` のいず
  れかが必要であり、iframe の内部からは使用できません。本アプリを埋め
  込みフレーム内でプレビューしている場合は、まず自身のタブで開いて
  ください。

## ⚡ Flasher Studio ——実際の機能カバレッジ

`URTC-FLASHER` 自身の `flasher_protocol.py` から移植され、同じ CAN ID
に対して動作します：

- **メインボードの CAN-OTA 更新**（`0x7F0`-`0x7F7`）：ブートローダー起動
  トリガー、HMAC-SHA256 署名、ページ ACK フロー制御とリトライ/バック
  オフを伴うページ単位の転送、CRC32 + 宣言バージョンの END_UPDATE、
  そして終端状態処理（デスクトップツールと同じ方法で、失われた確認
  フレームからの復旧を含む——誤った失敗を報告するのではなく、バージョン
  を再照会します）。
- **拡張スレーブの CAN-OTA 更新**（`0x210`-`0x219`、メインボード自身の
  I2C ブリッジ経由で中継）——同じ署名/CRC 方式、このパスにはページ ACK
  もハートビートもありません（実際のプロトコルと一致；進捗はプッシュ
  されるのではなくポーリングされます）。
- **ダウングレード認可**（`0x7FD`）——確認ゲート付きのチェックボックス
  で、信頼できる古いリリースへ意図的に戻すために、今回の試行がブート
  ローダーの防ロールバックチェックを回避することを認可します。
- **フラッシュ前の F-RAM 消去**（`0x192`）、任意、メインボードのみ。
- **CAN エラーカウンター照会**（`0x7FB`/`0x7FC`、CAN コントローラー
  自身のエラーレジスタから直接読み取り）——本物のバス問題とアプリケー
  ション/ブートローダー側の問題を区別します。
- **CAN 経由のファームウェア読み戻し/バックアップ**（`0x7FE`/`0x7FF`）
  ——上書きする前に、メインスロットの現在の内容を、ホストの ACK を伴い
  2KB/ページのペースで読み戻し、`.bin` ダウンロードとして保存します。
- **ライブなボードバージョン照会**（`0x7F8`/`0x7F9`/`0x7FA`）——シミュ
  レートされたトグルではなく、実際の応答元（アプリまたはブートローダー）、
  HardwareID、バージョンを表示します。
- **`<file>.manifest.json` サイドカーサポート**——GitHub のファームウェア
  一覧（またはローカルの `public/firmware/` フォルダ）から来たファイル
  をフラッシュする際、一致するマニフェストが宣言するバージョンが、
  インストールされている内容を報告する際に優先され、その `sha256`
  （存在する場合）が早期の、ブロックしない健全性警告としてチェックされ
  ます——デスクトップツールの `_check_manifest` と同じ動作です。
- **ボード設定**：拡張ボードタイプ / MLX9064x センサーバリアント /
  フリーツール構成（ID ピン `11111`）/ 周辺機器情報とシリアル番号——
  `0x1A0`-`0x1A7`。

### SWD/JTAG ——設計上、ブラウザからは利用できません

SWD/JTAG デバッグプローブを駆動できる Web API は存在しません——Web Serial
は（USB-CAN アダプターのような）シリアルフレームデバイスとのみ通信し、
プローブ自身のプロトコルとは通信しません。STM32CubeProgrammer/pyOCD は、
デスクトップツールが呼び出すネイティブサブプロセスです。これはブラウザ
サンドボックス内で実行することの構造的な制限であり、ここに欠けている
機能ではありません。Flasher Studio の SWD/JTAG タブは、参考として、
デスクトップ版 `URTC Flasher` ツールがローカルで実行する正確なコマンドを
説明します——フルチッププログラミング、オプションバイト/RDP チェック、
または一括消去前の完全なフラッシュバックアップには、そのツールを直接
使用してください。

## 🧰 Tester Studio ——実際の機能カバレッジ

`URTC-TESTER` 自身の `tester_tool_panels.py` /
`tester_common_panels.py` から移植され、同じ CAN ID に対して動作します：

- ツールごとに 1 つのパネル（電烙铁 + ワイヤーフィーダー、共有される
  単純なステッピングモーションツール、真空ピックアップ、ドリル、AOI、
  レーザー、3D プリンターのヒーター/モーション/ファン、スキャンプローブ、
  電磁石、スポット/超音波溶接機、ADS1115 の高度なパスを含むフライング
  プローブ、UV 硬化、ホットエアリワーク、圧接、サーマル検査、ペースト
  噴射）、それぞれがそのツールの実際のコマンドバイトを送信し、実際の
  テレメトリをデコードします。
- ファームウェア側の通信ウォッチドッグを持つすべてのツール（電烙铁、
  レーザー、UV 硬化、ホットエアリワーク、3D プリンターノズル——250ms
  ウォッチドッグの下で 150ms 再送信；3D プリンターレイヤーファン——
  自身の 1000ms ウォッチドッグの下で 400ms 再送信）向けの**アクティブ
  チェックボックス + キープアライブ**、デスクトップツール自身のタイミング
  と正確に一致します。
- **Global Controls**（`0x100`）、**Expansion Board** の SPI パススルー
  + TMC DIAG0 照会（`0x180`-`0x183`）、**F-RAM** の照会/消去
  （`0x190`-`0x192`）、**Self-Test**（ツールごとの安全な静止状態チェック）、
  `.trc`/`.asc` トレースエクスポート付きの **Raw Bus Monitor**、そして
  任意の繰り返し間隔を持つ **Custom Frame** インジェクター——CAN Bus
  Protocol Analyzer 自身のフレームインジェクターと同じ方法で検証されます：
  ID は 11 ビットの CAN 標準範囲にマスクされ、データトークンは 8 バイト
  の CAN ペイロード上限に制限される前に、有効な 16 進数バイトとして
  フィルタリングされます。
- **Detect Hardware** は実際の現在のツール（`0x110`/`0x111`）とボード
  バージョン（`0x7F8`/`0x7F9`）を照会し、宣言された重大エラー（`0x111`
  バイト 1）はライブの障害バナーとして表示されます。

## 🔐 セキュリティに関する注記：OTA 署名キー

デスクトップ版 `URTC Flasher` と同様、本アプリはソースコード
（`src/lib/flasher.ts`）にプロジェクトのデフォルトの HMAC-SHA256 署名
キーをコミットした状態で出荷されます——これは、CAN-OTA 更新が受理される
かどうかをゲートする、ブートローダー自身の改ざん防止キーです。これは
デスクトップツール自身の慣例（`flasher_config.py` の `HMAC_KEY`、それ
自体がローカルの、コミットされない設定で上書き可能）に意図的に一致させ
たものであり、見落としではありません。**Web アプリ**として実行すること
に特有の注意点が伴います：ダウンロードされたデスクトップ実行ファイルとは
異なり、このページを読み込む誰もが、出荷された JS バンドルからそのキーを
そのまま読み取ることができます——静的なクライアントサイドアプリが、
自身の訪問者から署名シークレットを非公開に保つ方法はありません。本番
デプロイのために実際の署名キーをローテーションする場合は、アクセスを
制御できる場所（内部ネットワーク、VPN、またはアクセスゲート付きホスト）
にのみ本アプリをデプロイするか、デスクトップ版 Flasher ツール自体を配布
する場合と同じように扱ってください——公開インターネットではなく、権限
のある技術者向けに。

## 🚀 はじめに

### 前提条件
- Node.js（v18+）
- npm

### インストール

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### 開発モード

Vite の開発サーバーでライブリロード付きでアプリを実行します：
- **Windows：** `dev.bat` をダブルクリックするか、`npm run dev` を実行
- **Linux/Mac：** `./dev.sh` または `npm run dev` を実行

その後、Chrome または Edge で `http://localhost:3000` を開いてください。

### プロダクションビルド

`dist/` 内に静的な、最適化されたバンドルへコンパイルします：
- **Windows：** `build.bat` をダブルクリックするか、`npm run build` を実行
- **Linux/Mac：** `./build.sh` または `npm run build` を実行

これは純粋な静的サイトです——（`HYDRA-UMC STUDIO` 自身の `server.ts` とは
異なり）バンドルされたサーバーコンポーネントはありません。ビルドされた
`dist/` フォルダをローカルでプレビューするには：

```bash
npm run preview
```

または、お好みの静的ファイルホストで `dist/` を配信してください。
`npm run lint` は TypeScript コンパイラをチェックのみモードで実行します。

### バージョン管理

`package.json` の `version` は、実際の `npm run build` のたびに（`prebuild`
スクリプトとして接続され、`scripts/bump-version.mjs` を実行）自動的に
加算されます——`npm run dev`/`lint`/`preview` はこれに一切触れません。
これはセマンティックバージョニングではありません：10 進法のオドメーター
方式です。パッチ桁が 1 ずつ増加します；9 を超えるとリセットされて 0 に
なり、代わりにマイナー桁が増加します（`0.1.9` -> `0.2.0`、決して
`0.1.10` にはなりません）；同じ繰り上がりがマイナーからメジャーへ
カスケードします。バージョン履歴と本プロジェクトの過去の作業の要約は
`CHANGELOG.md` を参照してください。

## 🛠️ 技術スタック
- **言語：** TypeScript
- **フロントエンドフレームワーク：** React 18
- **ビルドツール：** Vite
- **スタイリング：** Tailwind CSS
- **アイコン：** Lucide React
- **CRC32：** `crc-32`——ファームウェアイメージの整合性チェック、ブート
  ローダー自身の CRC32 計算をミラーリング
- **ハードウェアトランスポート：** Web Serial API + SLCAN フレーミング
  （ネイティブ依存なし、コンパニオンバックエンドサーバーなし）

## 📂 リポジトリ構成

```
/
├── src/
│   ├── App.tsx                     ルートコンポーネント——タブの状態、
│   │                                ハードウェアの状態、CAN フレーム
│   │                                ロギング、そして下記の各タブに接続
│   │                                されたハンドラー（CAN OTA の開始/
│   │                                読み戻しと CAN Bus Analyzer 自身の
│   │                                フレームインジェクターを含む）
│   ├── main.tsx                    Vite/React エントリポイント
│   ├── i18n.ts                     i18next 設定——en/es/de/fr/it/zh/ja、
│   │                                localStorage に永続化
│   ├── index.css                   Tailwind エントリポイント
│   ├── types.ts                    共有 TypeScript 型（CanFrame、
│   │                                HardwareState、FlasherState、
│   │                                ExpansionBoardType など）
│   ├── vite-env.d.ts                Vite 自身のアンビエント型宣言
│   ├── components/
│   │   ├── Header.tsx               トップバー：接続/切断ボタン、現在の
│   │   │                            ツール名、FW v0.0/v0.1 サンドボックス
│   │   │                            トグル
│   │   ├── Sidebar.tsx              左ナビゲーション——本 README で説明
│   │   │                            されている 7 つのタブ
│   │   ├── ToolCatalog.tsx          サンドボックスタブ：25 種類のツール
│   │   │                            カタログ、ツール選択、設定値制御
│   │   ├── OledDisplay.tsx          サンドボックスタブ：OLED ステータス
│   │   │                            画面プレビュー
│   │   ├── SpecsAndBomViewer.tsx    サンドボックスタブ：BOM/ピン配置
│   │   │                            ブラウザー
│   │   ├── ThermalCameraViewer.tsx  サンドボックスタブ：シミュレートされた
│   │   │                            MLX90640 フィード——100%
│   │   │                            Math.random()、CAN トラフィックは
│   │   │                            まったくなし（上記の「何が本物で、
│   │   │                            何がサンドボックスか」参照）
│   │   ├── HardwarePanel.tsx        サンドボックスのジャンパー/LED/拡張
│   │   │                            ボード制御パネル、Control と OLED
│   │   │                            タブ内で使用
│   │   ├── CanBusAnalyzer.tsx       実際のタブ：生の CAN フレームログ、
│   │   │                            カスタムフレームインジェクター、
│   │   │                            プリセットコマンドトリガー
│   │   ├── FlasherStudio.tsx        実際のタブ：CAN-OTA UI（メイン +
│   │   │                            拡張スレーブ）と SWD/JTAG 機能の
│   │   │                            説明
│   │   ├── TesterStudio.tsx         実際のタブ：ツールごとのライブ制御/
│   │   │                            テレメトリ、下記の tester/ フォルダ
│   │   │                            から構築
│   │   └── tester/
│   │       ├── ToolPanels.tsx       ツールプロファイルごとに 1 つの
│   │       │                        パネル——実際のコマンドバイト、実際の
│   │       │                        テレメトリデコード、ツールごとの
│   │       │                        ウォッチドッグキープアライブ
│   │       ├── GlobalPanels.tsx     Global Controls、Expansion Board、
│   │       │                        F-RAM、Self-Test、Raw Bus Monitor、
│   │       │                        Custom Frame インジェクター
│   │       └── shared.tsx           共有 UI プリミティブ（Section、
│   │                                Field、ボタン/入力クラス、safeInt）
│   ├── data/
│   │   └── toolsData.ts             25 個の TOOL_PROFILES——サンドボックス
│   │                                タブ向けの名前、デフォルト値、アイコン
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Web Serial + SLCAN トランスポート——
│   │   │                            接続/切断、フレーム送受信、有限の
│   │   │                            受信バッファと 500 フレームのキュー
│   │   │                            上限を持つ ID ごとの waitForFrame
│   │   ├── useFlasher.ts            CAN-OTA ステートマシン（メインボード
│   │   │                            + 拡張スレーブ）、flasher_protocol.py
│   │   │                            をミラーリング
│   │   └── useKeepalive.ts          すべてのツールのアクティブチェック
│   │                                ボックスウォッチドッグキープアライブ
│   │                                を支える固定間隔再送信フック
│   ├── lib/
│   │   ├── flasher.ts               OTA プロトコル定数、コミットされた
│   │   │                            HMAC-SHA256 署名キー、CRC32/HMAC
│   │   │                            ヘルパー、マニフェストパース
│   │   └── canIds.ts                Tester Studio 用の CAN ID 定数——
│   │                                 tester_config.py をバイト単位で
│   │                                 ミラーリング
│   └── locales/                     UI 文字列——en.json、es.json、
│                                     de.json、fr.json、it.json、
│                                     zh.json、ja.json
├── scripts/
│   └── bump-version.mjs             依存関係のないバージョン加算スクリ
│                                     プト、実際のビルドのたびに自動的に
│                                     実行（上記の「バージョン管理」参照）
├── public/
│   └── firmware/                    メインアプリケーション、メインブート
│                                     ローダー、拡張スレーブアプリケー
│                                     ション、拡張スレーブブートローダー
│                                     用のバンドルされた .bin/.elf/.hex
├── images/
│   ├── URTC_LOGO_WEB_STUDIO.svg     完全なロゴバナー（本 README の先頭
│   │                                に表示）
│   ├── URTC_APP_ICON_NEW.svg        アプリアイコン
│   ├── urtc_custom_icon.svg         アプリアイコン、同じアートワーク
│   └── urtc_icon.ico                ファビコン
├── index.html                       Vite エントリ HTML
├── metadata.json                    アプリ名/説明 + 要求される「serial」
│                                     権限（ホスティングプラットフォーム
│                                     が使用）
├── vite.config.ts                   Vite + Tailwind プラグイン設定
├── tsconfig.json                    TypeScript 設定
├── .env.example                     VITE_APP_TITLE
├── dev.bat / dev.sh                 依存関係のインストール + Vite 開発
│                                     サーバーの起動
├── build.bat / build.sh             依存関係のインストール + 静的な
│                                     dist/ ビルドの生成
├── package.json
├── CHANGELOG.md                     バージョン履歴と過去の作業の要約
├── LICENSE
├── README.md                        本ファイル
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- 翻訳
```

## 📜 ライセンス

URTC Web Studio の著作権は (c) 2026 JuanenRac（Electro Hobby 3D）に帰属します。本プロジェクトまたはその派生物を配布する際は、この表示を必ず含めてください。

本プロジェクトはソースコードとそれ自身のドキュメントで構成されており、それぞれ実際にカバーする内容に適した異なるライセンスの下で提供されています：

1. ソースコード（`src/` 下のすべて、それをビルドする Vite/TypeScript 設定を含む）は、**GNU General Public License v3.0（GPL-3.0）** の下で提供されます。全文は https://www.gnu.org/licenses/gpl-3.0.html を参照してください。

2. ドキュメント（本 README およびその自身の翻訳版——`README_spa.md`、`README_ita.md`、`README_fra.md`、`README_deu.md`、`README_zho.md`、`README_jpn.md`）は、**クリエイティブ・コモンズ 表示-継承 4.0 国際（CC BY-SA 4.0）** の下で提供されます。全文は https://creativecommons.org/licenses/by-sa/4.0/ を参照してください。

本ツールは [URTC（Universal Robot Tool Controller）](https://github.com/JuanenRac/URTC) プロジェクトのブラウザベースのコンパニオンです——本ツールが対応対象としているボードファームウェア、ハードウェア設計、完全なプロトコルドキュメントは、同プロジェクト自身のリポジトリを参照してください。URTC 自身のファームウェアは GPL-3.0 であり、そのハードウェア設計は CERN-OHL-S v2 です。本ツール自身のここでのライセンスはその独立したプロジェクトには及ばず、その逆も同様です。同じ範囲をカバーする 2 つのデスクトップネイティブの代替案も存在します：[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) と [URTC Tester](https://github.com/JuanenRac/URTC-TESTER)。

本プロジェクトを基に開発を行う際は、このライセンス区分を念頭に置いてください：コードの変更は GPL-3.0 を維持し、ドキュメントの派生物は CC BY-SA を維持してください——いずれも本プロジェクトおよびその作者への帰属表示を伴う必要があります。

## 🔗 関連プロジェクト

本プロジェクトは、同一著者（JuanenRac / Electro Hobby 3D）による、ファームウェア、制御ソフトウェア、AI、産業統合にまたがる多数のプロジェクトからなる、より大きなロボティクスエコシステムの一部です。ご要望が実際にはこれらのプロジェクトのいずれかに関するものであり、本リポジトリのものではない可能性もあるため、知っておく価値があります。

### 直接関連

- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — 本ブラウザベースツールのターミナル/コマンドライン版代替。

### エコシステムのその他のプロジェクト

**💠 コアエコシステム**
[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC) · [HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER) · [HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO) · [HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE) · [HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI) · [HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL) · [HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL) · [HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF) · [URTC](https://github.com/JuanenRac/URTC) · [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER) · [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)

**👁️ ビジョン AI ノード（Hailo-8）**
[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE) · [HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER) · [HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF) · [HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES) · [HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)

**🧠 認知 AI ノード（Hailo-10）**
[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE) · [HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE) · [HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI) · [HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER) · [HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)

**🐝 オーケストレーションと群制御**
[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR) · [HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC) · [HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D) · [HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER) · [HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)

**🎮 デジタルツインとシミュレーション**
[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN) · [HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA) · [HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE) · [HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)

**📊 データと分析**
[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE) · [HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR) · [HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR) · [HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)

**🏭 産業用ゲートウェイ**
[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL) · [HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER) · [HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER) · [HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)

**🛠️ 補完ツール**
[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK) · [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL) · [HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH) · [HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)

## 👤 作者

**JuanenRac**（Electro Hobby 3D）
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
