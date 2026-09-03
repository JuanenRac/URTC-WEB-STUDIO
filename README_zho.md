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
  🇨🇳 <b>简体中文</b> |
  <a href="README_jpn.md">🇯🇵 日本語</a>
</p>


<p align="left">
  <img src="https://img.shields.io/badge/License-GPL%203.0-blue.svg" alt="GPL 3.0">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
  <img src="https://img.shields.io/badge/Tool-Vite-646CFF.svg" alt="Vite">
</p>


一个基于浏览器的**通用机器人工具控制器（URTC）**配套工具——一个 React/Vite
单页应用，通过 [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)，
经由 USB-CAN 适配器与真实的 URTC 硬件通信，使用与两款桌面配套工具
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) 和
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER) 相同的 SLCAN 帧格式和
CAN 协议。目标是在单个浏览器标签页内实现与这两款工具功能对等，而非它们的
简化演示版——Flasher Studio 和 Tester Studio 选项卡发送和接收的正是
[URTC 固件仓库](https://github.com/JuanenRac/URTC) `docs/CANBUS.TXT` 中所描述
的真实 CAN 帧。

---

## 🧭 什么是真实的，什么是沙盒

本应用有两类选项卡：

- **真实的、由硬件驱动的选项卡** —— Flasher Studio、Tester Studio，以及 CAN
  总线协议分析器。这些只有在你连接了一个真实的 USB-CAN 适配器（顶部标题栏
  右侧的按钮）之后才会有任何作用；它们发送的每一条指令、显示的每一个读数
  都来自真实的 CAN 总线。这也包括真实的**热成像相机读数**——Tester Studio
  的“热成像检测”面板（`0x250`/`0x251`/`0x254`/`0x255`）通过 CAN 查询工具头
  实际的 MLX90640 红外阵列。
- **离线沙盒选项卡** —— 控制（工具目录）、OLED、规格/BOM，以及热成像红外
  检测。这些让你可以在完全不连接任何硬件的情况下,探索这 25 种工具目录、
  预览 OLED 状态屏幕、浏览 BOM/引脚定义,并查看一个模拟的热成像相机画面。
  顶部标题栏中的“FW v0.0 / v0.1”切换开关只影响这些沙盒选项卡（某个固件
  构建版本会解锁哪些工具配置文件）——对一块真实连接的板卡所报告的内容毫无
  影响。
  - **不要混淆这两种热成像视图**：独立的“热成像红外检测”选项卡
    （`ThermalCameraViewer.tsx`）100% 是纯客户端的 `Math.random()` 噪声,
    完全没有任何 CAN 流量——它是一个界面模拟展示,而非传感器读数。真实的
    MLX9064x 数据只会出现在 Tester Studio 的“热成像检测”面板内,并且只有
    在硬件已连接的情况下才会出现。

## 🔌 你需要的硬件

- 一个运行 **SLCAN** 固件的 USB-CAN 适配器（例如运行
  `candlelight`/`slcan` 的 CANable,或任何支持标准 `lawicel` SLCAN 串口
  协议的适配器）——这与两款桌面工具通过各自的串口传输方式所支持的适配器
  类型相同。
- 总线设置为 **500 kbit/s**（本应用不会像桌面工具的 `--auto-detect`
  标志那样自动检测比特率；它始终以 500k 打开）。
- 一款支持 Web Serial 的浏览器——**Chrome 或 Edge**。Firefox 和 Safari
  未实现 Web Serial,将完全无法连接。
- Web Serial 需要安全上下文（HTTPS）或 `localhost`——并且不能在 iframe
  内使用。如果你正在一个嵌入式框架内预览本应用,请先在其自身的标签页中
  打开它。

## ⚡ Flasher Studio ——真实功能覆盖

从 `URTC-FLASHER` 自身的 `flasher_protocol.py` 移植而来,针对相同的
CAN ID：

- **主板的 CAN-OTA 更新**（`0x7F0`-`0x7F7`）：进入引导程序触发指令、
  HMAC-SHA256 签名、带页面 ACK 流量控制和重试/退避的分页传输、CRC32 +
  声明版本的 END_UPDATE,以及最终状态处理（包括以与桌面工具相同的方式
  从丢失的确认帧中恢复——它会重新查询版本,而不是报告一个错误的失败）。
- **扩展从属的 CAN-OTA 更新**（`0x210`-`0x219`,经主板自身的 I2C 桥中继）
  ——相同的签名/CRC 方案,此路径上没有页面 ACK 或心跳（与真实协议一致；
  进度是轮询获取的,而非推送的）。
- **降级授权**（`0x7FD`）——一个带确认门控的复选框,授权当前尝试绕过
  引导程序的防回滚检查,用于刻意恢复到旧版本。
- **刷写前擦除 F-RAM**（`0x192`）,可选,仅限主板。
- **CAN 错误计数器查询**（`0x7FB`/`0x7FC`,直接从 CAN 控制器自身的错误
  寄存器读取 TEC/REC）——能够区分真实的总线问题与应用/引导程序端的问题。
- **通过 CAN 进行固件读回/备份**（`0x7FE`/`0x7FF`）——在你覆盖它之前,
  以每页 2KB 的速度配合主机 ACK,读回主槽当前的内容,并将其保存为
  `.bin` 下载文件。
- **实时板卡版本查询**（`0x7F8`/`0x7F9`/`0x7FA`）——显示真实的应答方
  （应用或引导程序）、HardwareID 和版本,而非一个模拟的开关。
- **`<file>.manifest.json` 附属文件支持**——当刷写一个来自 GitHub 固件
  列表（或本地 `public/firmware/` 文件夹）的文件时,一个匹配清单所声明
  的版本在报告正在安装的内容时会优先采用,其 `sha256`（如果存在）会作为
  一项早期的、非阻塞的健全性警告被检查——与桌面工具的 `_check_manifest`
  行为一致。
- **板卡配置**：扩展板类型 / MLX9064x 传感器变体 / 自由工具配置（ID
  引脚 `11111`）/ 外设信息与序列号——`0x1A0`-`0x1A7`。

### SWD/JTAG ——按设计,无法从浏览器中使用

没有任何 Web API 可以驱动一个 SWD/JTAG 调试探针——Web Serial 只能与
串行帧设备（如 USB-CAN 适配器）通信,而不能与探针自身的协议通信,
STM32CubeProgrammer/pyOCD 是桌面工具所调用的原生子进程。这是在浏览器
沙盒中运行的一项结构性限制,而非这里缺失的功能。Flasher Studio 中的
SWD/JTAG 选项卡说明了桌面版 `URTC Flasher` 工具在本地会运行的确切指令,
仅供参考——请直接使用该工具进行完整芯片编程、选项字节/RDP 检查,或在
批量擦除之前进行完整闪存备份。

## 🧰 Tester Studio ——真实功能覆盖

从 `URTC-TESTER` 自身的 `tester_tool_panels.py` /
`tester_common_panels.py` 移植而来,针对相同的 CAN ID：

- 每个工具一个面板（电烙铁 + 送丝器、共享的纯步进运动工具、真空拾取、
  钻头、AOI、激光器、3D 打印机加热器/运动/风扇、扫描探针、电磁铁、
  点焊/超声波焊接机、包含 ADS1115 高级路径的飞针探测、UV 固化、热风
  返修、压接、热成像检测、焊膏喷射）,每一个都发送该工具的真实指令
  字节并解码其真实遥测数据。
- 为每一个在固件端具有通信看门狗的工具（电烙铁、激光器、UV 固化、
  热风返修、3D 打印机喷嘴——在 250ms 看门狗下每 150ms 重发；3D 打印机
  层冷却风扇——在其自身 1000ms 看门狗下每 400ms 重发）提供**活动复选框
  + 保活**,与桌面工具自身的时序完全一致。
- **全局控制**（`0x100`）、**扩展板** SPI 透传 + TMC DIAG0 查询
  （`0x180`-`0x183`）、**F-RAM** 查询/擦除（`0x190`-`0x192`）、**自检**
  （每种工具的安全静止状态检查）、带 `.trc`/`.asc` 追踪导出的**原始
  总线监视器**,以及带可选重复间隔的**自定义帧**注入器——验证方式与
  CAN 总线协议分析器自身的帧注入器相同：ID 被限制在 11 位 CAN 标准范围
  内,数据令牌在被限制为 8 字节 CAN 负载上限之前会被过滤为有效的十六
  进制字节。
- **检测硬件**查询真实的当前工具（`0x110`/`0x111`）和板卡版本
  （`0x7F8`/`0x7F9`）,声明的严重错误（`0x111` 字节 1）会以一条实时
  故障横幅显示出来。

## 🔐 安全说明：OTA 签名密钥

与桌面版 `URTC Flasher` 一样,本应用在源码（`src/lib/flasher.ts`）中
提交了项目的默认 HMAC-SHA256 签名密钥——这是引导程序自身用于门控是否
接受一次 CAN-OTA 更新的防篡改密钥。这是刻意与桌面工具自身的惯例
（`flasher_config.py` 的 `HMAC_KEY`,本身可通过一个本地的、不提交的
配置覆盖）保持一致,而非疏忽。它伴随着一个特定于作为**网页应用**运行
的注意事项：与一个下载的桌面可执行文件不同,任何加载此页面的人都可以
直接从发布的 JS 包中读取该密钥——对于一个静态客户端应用而言,没有办法
向其自身的访问者保密一个签名密钥。如果你为生产部署轮换了真实的签名
密钥,请只将本应用部署到你自己控制访问权限的地方（内部网络、VPN,或
门控访问的主机),或者以你对待分发桌面版 Flasher 工具本身相同的方式
对待它——只面向授权技术人员,而非公开互联网。

## 🚀 快速开始

### 前置条件
- Node.js（v18+）
- npm

### 安装

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### 开发模式

使用 Vite 的开发服务器运行本应用,支持实时重载：
- **Windows：** 双击 `dev.bat`,或运行 `npm run dev`
- **Linux/Mac：** 运行 `./dev.sh` 或 `npm run dev`

然后在 Chrome 或 Edge 中打开 `http://localhost:3000`。

### 生产构建

编译为 `dist/` 中一个静态的、经过优化的构建包：
- **Windows：** 双击 `build.bat`,或运行 `npm run build`
- **Linux/Mac：** 运行 `./build.sh` 或 `npm run build`

这是一个纯粹的静态网站——没有内置的服务器组件（不同于 `HYDRA-UMC STUDIO`
自身的 `server.ts`）。使用以下命令在本地预览构建好的 `dist/` 文件夹：

```bash
npm run preview
```

或使用你选择的任何静态文件托管服务提供 `dist/`。`npm run lint` 以仅检查
模式运行 TypeScript 编译器。

### 版本管理

`package.json` 的 `version` 会在每次真正的 `npm run build`（作为 `prebuild`
脚本接入,运行 `scripts/bump-version.mjs`）时自动递增——`npm run dev`/
`lint`/`preview` 绝不会触碰它。这不是语义化版本控制：它是一个十进制
里程表。补丁位加一;一旦它会超过 9,就重置为 0,并改为将次版本位加一
（`0.1.9` -> `0.2.0`,绝不会是 `0.1.10`）;同样的进位会从次版本级联到
主版本。版本历史以及本项目过往工作的摘要见 `CHANGELOG.md`。

## 🛠️ 技术栈
- **语言：** TypeScript
- **前端框架：** React 18
- **构建工具：** Vite
- **样式：** Tailwind CSS
- **图标：** Lucide React
- **CRC32：** `crc-32`——固件镜像完整性检查,镜像引导程序自身的 CRC32 计算
- **硬件传输：** Web Serial API + SLCAN 帧格式（无原生依赖,无配套后端
  服务器）

## 📂 仓库结构

```
/
├── src/
│   ├── App.tsx                     根组件——选项卡状态、硬件状态、CAN
│   │                                帧日志记录,以及下方每个选项卡所接入
│   │                                的处理程序（包括 CAN OTA 启动/读回,
│   │                                以及 CAN 总线分析器自身的帧注入器）
│   ├── main.tsx                    Vite/React 入口点
│   ├── i18n.ts                     i18next 配置——en/es/de/fr/it/zh/ja,
│   │                                持久化到 localStorage
│   ├── index.css                   Tailwind 入口点
│   ├── types.ts                    共享的 TypeScript 类型（CanFrame、
│   │                                HardwareState、FlasherState、
│   │                                ExpansionBoardType 等）
│   ├── vite-env.d.ts                Vite 自身的环境类型声明
│   ├── components/
│   │   ├── Header.tsx               顶部栏：连接/断开按钮、当前工具
│   │   │                            名称、FW v0.0/v0.1 沙盒切换开关
│   │   ├── Sidebar.tsx              左侧导航——本 README 中描述的 7 个
│   │   │                            选项卡
│   │   ├── ToolCatalog.tsx          沙盒选项卡：25 种工具目录、工具
│   │   │                            选择、设定值控制
│   │   ├── OledDisplay.tsx          沙盒选项卡：OLED 状态屏幕预览
│   │   ├── SpecsAndBomViewer.tsx    沙盒选项卡：BOM/引脚定义浏览器
│   │   ├── ThermalCameraViewer.tsx  沙盒选项卡：模拟的 MLX90640 画面——
│   │   │                            100% Math.random(),完全没有 CAN
│   │   │                            流量（见上方“什么是真实的,什么是
│   │   │                            沙盒”）
│   │   ├── HardwarePanel.tsx        沙盒跳线/LED/扩展板控制面板,在
│   │   │                            控制和 OLED 选项卡内使用
│   │   ├── CanBusAnalyzer.tsx       真实选项卡：原始 CAN 帧日志、自定义
│   │   │                            帧注入器、预设指令触发器
│   │   ├── FlasherStudio.tsx        真实选项卡：CAN-OTA 界面（主板 +
│   │   │                            扩展从属）以及 SWD/JTAG 能力说明
│   │   ├── TesterStudio.tsx         真实选项卡：逐工具实时控制/遥测,
│   │   │                            由下方的 tester/ 文件夹构建
│   │   └── tester/
│   │       ├── ToolPanels.tsx       每种工具配置文件一个面板——真实指令
│   │       │                        字节、真实遥测解码、逐工具看门狗
│   │       │                        保活
│   │       ├── GlobalPanels.tsx     全局控制、扩展板、F-RAM、自检、
│   │       │                        原始总线监视器、自定义帧注入器
│   │       └── shared.tsx           共享的 UI 基础组件（Section、
│   │                                Field、按钮/输入框样式、safeInt）
│   ├── data/
│   │   └── toolsData.ts             25 个 TOOL_PROFILES——名称、默认值、
│   │                                沙盒选项卡的图标
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Web Serial + SLCAN 传输——连接/断开、
│   │   │                            帧收发、带有限接收缓冲区和 500 帧
│   │   │                            队列上限的逐 ID waitForFrame
│   │   ├── useFlasher.ts            CAN-OTA 状态机（主板 + 扩展从属）,
│   │   │                            镜像 flasher_protocol.py
│   │   └── useKeepalive.ts          固定间隔重发钩子,支撑每个工具的
│   │                                活动复选框看门狗保活
│   ├── lib/
│   │   ├── flasher.ts               OTA 协议常量、已提交的 HMAC-SHA256
│   │   │                            签名密钥、CRC32/HMAC 辅助函数、
│   │   │                            清单解析
│   │   └── canIds.ts                Tester Studio 的 CAN ID 常量——逐字节
│   │                                 镜像 tester_config.py
│   └── locales/                     界面字符串——en.json、es.json、
│                                     de.json、fr.json、it.json、
│                                     zh.json、ja.json
├── scripts/
│   └── bump-version.mjs             无依赖的版本递增脚本,在每次真正的
│                                     构建前自动运行（见上方“版本管理”）
├── public/
│   └── firmware/                    主应用程序、主引导程序、扩展从属
│                                     应用程序,以及扩展从属引导程序的
│                                     打包 .bin/.elf/.hex 文件
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   完整的 Logo 横幅（显示在本 README
│   │                                顶部）
│   ├── URTC_APP_ICON_NEW.svg        应用图标
│   ├── urtc_custom_icon.svg         应用图标,相同的图稿
│   └── urtc_icon.ico                网站图标
├── index.html                       Vite 入口 HTML
├── metadata.json                    应用名称/描述 + 请求的“serial”权限
│                                     （由托管平台使用）
├── vite.config.ts                   Vite + Tailwind 插件配置
├── tsconfig.json                    TypeScript 配置
├── .env.example                     VITE_APP_TITLE
├── dev.bat / dev.sh                 安装依赖 + 启动 Vite 开发服务器
├── build.bat / build.sh             安装依赖 + 生成静态 dist/ 构建
├── tools/
│   └── ci_validate.py               CI 使用的 manifest/CHANGELOG/docs 校验
├── bump_manifest_version.py         将 hydra-umc.project.json 的版本与原生版本同步（--sync）
├── package.json
├── CHANGELOG.md                     版本历史与过往工作摘要
├── LICENSE
├── README.md                        本文件
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- 翻译
```

## 📜 许可证

URTC Web Studio 版权所有 (c) 2026 JuanenRac（Electro Hobby 3D）。分发本项目
或其衍生作品时必须包含此声明。

本项目由源代码及其自身的文档组成,两者依据不同的许可证提供——各自适合
其实际所涵盖的内容：

1. 源代码（`src/` 下的一切,加上构建它的 Vite/TypeScript 配置）依据
   **GNU 通用公共许可证 v3.0（GPL-3.0）** 提供。完整文本见
   https://www.gnu.org/licenses/gpl-3.0.html。

2. 文档（本 README 及其自身的翻译版本——`README_spa.md`、`README_ita.md`、
   `README_fra.md`、`README_deu.md`、`README_zho.md`、`README_jpn.md`）
   依据 **知识共享 署名-相同方式共享 4.0 国际许可协议（CC BY-SA 4.0）**
   提供。完整文本见 https://creativecommons.org/licenses/by-sa/4.0/。

本工具是 [URTC（Universal Robot Tool Controller）](https://github.com/JuanenRac/URTC)
项目的浏览器端配套工具——本工具所对接的板卡固件、硬件设计和完整协议
文档见该项目自身的仓库。URTC 自身的固件为 GPL-3.0,其硬件设计为
CERN-OHL-S v2;本工具自身的许可证并不延伸至那个独立的项目,反之亦然。
两款覆盖相同功能范围的桌面原生替代方案也存在：
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) 和
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER)。

如果你基于本项目进行开发,请留意这种许可证划分：代码更改应保持
GPL-3.0,文档衍生品应保持 CC BY-SA——每一项都需附带指向本项目及其
作者的署名。

## 🔗 相关项目

本项目是同一作者(JuanenRac / Electro Hobby 3D)打造的 HYDRA-UMC 机器人生态系统的一部分。值得了解,因为某个请求实际上可能是关于这些项目之一,而非本仓库本身。

**父项目**
- **[URTC](https://github.com/JuanenRac/URTC)** — 面向实体 Universal Robot Tool Controller 板卡的固件,通过 CAN 总线支持 25 种以上工具配置;本仓库是其自身 CAN 总线工具家族中一个具体工具所属的父项目。

**兄弟项目** —— URTC 自身 CAN 总线工具家族中的其他工具
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — 面向 URTC 板卡的桌面图形烧录工具，支持 CAN-OTA 以及全芯片 SWD/JTAG —— 与本浏览器应用采用相同的 SLCAN/CAN 协议,本应用即是其免安装替代方案。
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — 面向 URTC 板卡的桌面实时 CAN 总线诊断工具，每种工具配置对应一个面板 —— 与本浏览器应用采用相同的 SLCAN/CAN 协议,本应用即是其免安装替代方案。

**直接相关**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — 具备真实、稳定退出码契约的车队 CLI，是 HYDRA-UMC-SERVER 自身 API 的真实在线客户端 —— 本浏览器工具的终端/命令行替代方案。

**生态系统中的其他项目**

*核心硬件与平台*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — 机器人手臂的真实主板——CM5 主机 + 双核 STM32H745，通过 CAN-OTA/SPI-OTA 协调最多 8 条工具臂。
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — 面向 CM5 的可复现 Raspberry Pi OS 产品层——只读代理、经过验证的配置/配置文件、WiFi 首次配网。
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — 每个桥接都据此校验自身指令的共享 JSON-Schema 契约与安全门限边界。

*核心后端与客户端*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — 每个控制客户端真正通信的真实无头后端(REST/WebSocket)。
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — 具有实时多机器人 3D 可视化的网页控制面板。
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — 面向多台服务器的桌面(PySide6)集群指挥中心，打包为独立可执行文件。
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — 具有生物识别登录和配对 Wear OS 伴侣应用的原生 Android 控制应用。
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — 具有实时 WebSocket 同步的 iOS/iPadOS 控制应用(Flutter)。
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — 面向机载 7 英寸 DSI 触摸屏的原生触控界面，直接嵌入 CM5 本体。
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — 将完成的模型推送到 STUDIO 自身目录的桌面版图形化 URDF 创建/编辑工具。
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — 通过真实的 VDA 5050 MQTT 发布者为 AGV/AMR 车队提供的协调边界。
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — 具备真实 GRBL 状态/控制字节访问能力的高层 CNC 单元协调器。
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — 面向足式/人形机器人的协调边界，具备真实的 Boston Dynamics Spot 指令发送器。
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — 读取 3 项真实钥匙/外壳/联锁 GPIO 安全信号的激光单元安全协调器。
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — 面向 OpenPnP 贴片机板级流程的安全高层协调器。
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — 面向 Moonraker/Klipper 3D 打印机的安全协调边界，具备真实的受控作业指令。
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — 具备真实的惰性导入 rclpy ROS 2 传输层的安全协调器。
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — 面向搭载摄像头的无人机的协调边界，具备真实的 MAVLink 指令发送器。

*视觉 AI 节点(Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — 面向 Hailo-8 视觉流水线的集成中枢，具备逐阶段的真实硬件就绪检测。
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — 具备 Hailo 架构/校验和安全加载验证的真实编译模型注册表。
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — 具备真实 HailoRT 集成边界的真实 GStreamer 流水线 + MediaMTX 配置生成器。
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — 具备真实 Position-Based Visual Servoing 修正律，并依据上游区域状态进行安全门控。
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — 具备校准新鲜度强制检查的真实区域入侵检测与 E-STOP 请求。

*认知 AI 节点(Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — 面向 Hailo-10 认知流水线(LLM/VLA/语音编排)的集成中枢。
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — 面向 Vision-Language-Action 模型的真实动作 token 编解码与轨迹生成。
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — 具备受限、需确认的 Watch 中继的真实语音前端(VAD + 意图解析)。
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — 基于真实规则的任务分解，以及针对 MCU 错误码的语义化错误恢复。
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — 面向本生态系统自身 Markdown 文档的真实纯标准库 TF-IDF 文档检索。

*编排与集群*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — 具备真实 gRPC/Protobuf 健康报告契约与任务状态机的集成中枢。
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — 基于真实 HTTP API 的真实优先级任务队列，支持去重。
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — 具备重试/退避与身份不匹配检测的真实基于 gRPC 的车队健康看门狗。
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — 具备真实障碍物/工作空间碰撞校验的真实基于 RRT 的三维路径规划器。
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — 经过多单元收敛属性测试的真实 CRDT LWW-Element-Map 状态同步。

*数字孪生与仿真*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — 面向数字孪生引擎的集成中枢，具备真实的版本兼容性同步契约。
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — 在仿真与真实硬件之间路由指令的真实硬件在环安全联锁。
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — 面向真实 URDF 子集的真实正向运动学与关节限位校验。
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — 具备 YOLO/COCO 标注导出功能的真实程序化 2D 场景生成器。

*数据与分析*
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — 具备真实数据摄入/查询 HTTP API 的真实 sqlite3 时序数据存储。
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — 具备漂移监测能力的真实 FFT + 统计基线异常检测器。
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — 基于 DATALAKE 历史数据的真实 OEE/可用率计算，支持可复现的 CSV 导出。
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — 面向 DATALAKE 的真实 CAN/WebSocket 数据摄入管道，支持序列去重。

*工业网关*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — 中继至工业协议的集成中枢，具备真实的指令白名单/背压控制层。
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — 经真实二进制协议客户端会话验证的真实 OPC-UA 地址空间。
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — 具备可选按客户端认证与主题 ACL 的真实 MQTT 代理。
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — 具备降级模式输出的真实 MTConnect `/probe` 与 `/current` XML 端点。

*辅助工具与生态系统运维*
- **[HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)** — 基于 DATALAKE/ANOMALY-DETECTOR 的智能摘要与异常高亮面板，具备诚实的统计回退机制。
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — 具备真实触觉提醒与配对手机语音中继功能的 WearOS 伴侣应用。
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — 面向板卡安装机架的固件，具备真实的工具 ID 解码与 Smart Idle 预热逻辑。
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — 面向热成像/RGB 检测工具头的固件及真实 Python 视觉伴侣程序。
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — 发现、克隆并更新本生态系统中每个仓库的管理类桌面工具。

---

## 📚 文档与社区

- **[CONTRIBUTING.md](CONTRIBUTING.md)** —— 提交 Pull Request 所需的技术栈和编码规范。
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** —— 本社区所期望的行为准则。
- **[SECURITY.md](SECURITY.md)** —— 如何报告漏洞，以及本项目真实的安全关注重点。
- **[SUPPORT.md](SUPPORT.md)** —— 在哪里提问和报告缺陷。
- **[LICENSE.md](LICENSE.md)** —— 本项目自身的许可证。

## 👤 作者

**JuanenRac**（Electro Hobby 3D）
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
