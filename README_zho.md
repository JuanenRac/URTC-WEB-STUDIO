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
  <a href="README_jpn.md">🇯🇵 日本語</a> |
  <a href="README_por.md">🇵🇹 Português</a>
</p>

### URTC 刷写器和测试器的主要工作流程，放进浏览器标签页，通过 USB-CAN 适配器和 Web Serial 使用

<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Tests-577-2ea44f.svg" alt="Tests">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
  <img src="https://img.shields.io/badge/Tool-Vite-646CFF.svg" alt="Vite">
</p>

---

**诚实检查——今天真正能运行的部分：** `npm test`（Vitest）覆盖纯逻辑：SLCAN 解析、请求与应答的匹配、固件镜像和清单检查、工具限值、确认对话框、将模拟器与真实总线隔离的规则、追踪导出以及八种界面语言。界面和 Web Serial 传输本身没有单元测试（本段末尾的端到端检查会针对建模的板子驱动它们），而且在本环境中这些都没有对真实的 URTC 板子运行过（这里没有可用于测试的 USB-CAN 适配器）：Flasher Studio、Tester Studio 和 CAN 总线协议分析器是真实代码，仅由这些测试、类型检查（`npm run lint`）和代码审查验证。Control/OLED/Specs-BOM/Thermal IR Inspection 是明确标注的沙盒选项卡，没有任何 CAN 流量。迄今已交付的确切内容请参阅 `CHANGELOG.md`。 `npm run test:e2e` 还会在真实浏览器（Playwright）中打开构建好的页面，并对接建模的板子：离线副本、热计数历史和已保存的会话都以此方式检查。

---

> **安全与安防现状:**本生态系统不是经认证的安全系统,目前也不存在已组装的 URTC 电路板。引导程序使用 CRC32 和共享密钥的 HMAC-SHA256 校验固件映像,而非非对称签名(计划中);已发布的应用映像使用公开的开发密钥签名(`signing_key_kind: dev`),因此任何人都可以生成引导程序接受的映像;尚未向任何真实电路板发送过任何内容。在依赖此处任何说法来保障人身安全之前,请先阅读[安全基线](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md)和[威胁模型](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md)。

## 📋 速览

| | |
|---|---|
| 版本 | `0.3.8` |
| 成熟度 | 可用 |
| 测试 | 577 (`npm test`) |
| 技术栈 | Web Serial API / TypeScript |
| 目标 | 使用者电脑上的网页浏览器 |
| 真实硬件 | 仅模拟：使用模拟器、替身或仿真测试；此版本没有在真实硬件上运行的记录 |

**跳转到：** [概述](#-概述) · [架构](#-架构) · [功能](#-功能) · [安全](#-安全与防护) · [接口](#-接口) · [快速开始](#-快速开始) · [测试](#-测试) · [结构](#-仓库结构) · [相关项目](#-相关项目)

<!-- urtc-section:status_web_studio -->
## 🚦 项目状态

🟢 已完成并已验证 · 🟡 可用，但有已知限制 · 🟠 做了一半或未验证 · 🔴 未完成或不能用。从未在真实硬件上运行过的内容不会是绿色。

| 部分 | 状态 | 仓库能够证明的内容 |
| --- | :---: | --- |
| 软件 | 🟡 | 可在电脑上和模拟器上运行；从未在真实板子上运行过。 |
| 界面 | 🟡 | 窗口可运行，并用模拟板子检查；未用真实适配器试过。 |
| 测试 | 🟢 | 每次推送时测试套件都会在 CI 中通过。 |
| 真实硬件 | 🟠 | 尚未在真实板子上运行：台架测试仍待进行。 |
| 文档 | 🟡 | 提供八种语言的 README 和参考文档；翻译未经母语者审阅。 |

<!-- /urtc-section:status_web_studio -->

## 🎯 概述

一个基于浏览器的**通用机器人工具控制器（URTC）**配套工具——一个 React/Vite
单页应用，通过 [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)，
经由 USB-CAN 适配器与真实的 URTC 硬件通信（但从未在真实硬件上运行过），使用与两款桌面配套工具
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) 和
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER) 相同的 SLCAN 帧格式和
CAN 协议。目标是把这两款工具的主要工作流集中到单个浏览器标签页内，而非它们的简化演示版；尚未达到完全对等（见下文“尚未覆盖”）——Flasher Studio 和 Tester Studio 选项卡发送和接收的正是
[URTC 固件仓库](https://github.com/JuanenRac/URTC) `docs/CANBUS.TXT` 中所描述
的真实 CAN 帧。

### 什么是真实的，什么是沙盒

本应用有两类选项卡：

- **真实的、由硬件驱动的选项卡** —— Flasher Studio、Tester Studio，以及 CAN
  总线协议分析器。这些只有在你连接了一个真实的 USB-CAN 适配器（顶部标题栏
  右侧的按钮）之后才会有任何作用；它们发送的每一条指令、显示的每一个读数
  都来自 CAN 总线（该路径从未在真实适配器或板卡上运行过）。这也包括真实的**热成像相机读数**——Tester Studio
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

## 🧩 在 URTC 中的角色

URTC-WEB-STUDIO 是 URTC 两个桌面程序 URTC-FLASHER 和 URTC-TESTER 的浏览器版本：一个 React 页面，通过 USB-CAN 适配器和 Web Serial 与 URTC 板通信，使用相同的 SLCAN 帧格式和相同的 CAN 协议（其表格和向量由 URTC-COMMON 生成）。它把二者的主要工作流程带进浏览器标签页，无需安装任何东西，并把浏览器无法驱动的 SWD/JTAG 留给桌面刷写器。它还有沙盒标签页，可离线浏览 25 种工具，不发送任何数据。

## 🏛️ 架构

<p align="center">
  <img src="images/architecture.svg" alt="URTC-WEB-STUDIO 的架构：谁在使用、包含什么、依赖什么" width="100%">
</p>

本仓库各部分如何协作：谁在使用它、它包含什么、它依赖什么。图片由 `docs/architecture.json` 绘制，并与代码核对。

### 技术栈

- **语言：** TypeScript
- **前端框架：** React 18
- **构建工具：** Vite
- **样式：** Tailwind CSS
- **图标：** Lucide React
- **CRC32：** `crc-32`——固件镜像完整性检查,镜像引导程序自身的 CRC32 计算
- **硬件传输：** Web Serial API + SLCAN 帧格式（无原生依赖,无配套后端
  服务器）

## 🖼️ 屏幕截图

<!-- urtc-shots -->
在测试台上以 1920×1080 截取，使用示例数据，背后没有真实的安装。

<table>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/control.png" alt="工具矩阵与控制：固件的 25 个工具配置及其跳线，以及所选工具的控件（模拟器标签页：不会向总线发送任何内容）。" width="100%"><br><sub>工具矩阵与控制：固件的 25 个工具配置及其跳线，以及所选工具的控件（模拟器标签页：不会向总线发送任何内容）。</sub></td>
<td width="50%" valign="top"><img src="images/screenshots/oled.png" alt="OLED 与硬件监视器：工具的状态屏幕、五个识别跳线、状态 LED 和 8 灯环（模拟器标签页）。" width="100%"><br><sub>OLED 与硬件监视器：工具的状态屏幕、五个识别跳线、状态 LED 和 8 灯环（模拟器标签页）。</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/flasher.png" alt="刷写器：电路板的闪存映射、准备发送的映像及其清单，以及 CAN-OTA 更新的选项（模拟电路板，不发送任何内容）。" width="100%"><br><sub>刷写器：电路板的闪存映射、准备发送的映像及其清单，以及 CAN-OTA 更新的选项（模拟电路板，不发送任何内容）。</sub></td>
<td width="50%" valign="top"><img src="images/screenshots/thermal.png" alt="热成像检查：32×24 红外阵列的伪彩色图像，带有一个模拟的热点（模拟器标签页）。" width="100%"><br><sub>热成像检查：32×24 红外阵列的伪彩色图像，带有一个模拟的热点（模拟器标签页）。</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/tester.png" alt="测试器诊断：黑匣子和随时间变化的热计数器，读取自模拟电路板。" width="100%"><br><sub>测试器诊断：黑匣子和随时间变化的热计数器，读取自模拟电路板。</sub></td>
<td width="50%"></td>
</tr>
</table>
<!-- /urtc-shots -->

## ✨ 功能

### Flasher Studio ——真实功能覆盖

从 `URTC-FLASHER` 自身的 `flasher_protocol.py` 移植而来,针对相同的
CAN ID：

- **主板的 CAN-OTA 更新**（`0x7F0`-`0x7F7`）：进入引导程序触发指令、
  共享密钥的 HMAC-SHA256（仅针对模拟器测试过）、带页面 ACK 流量控制和重试/退避的分页传输、CRC32 +
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
- **实时板卡版本查询**（`0x7F8`/`0x7F9`/`0x7FA`/`0x7E9`）——显示真实的应答方
  （应用或引导程序）、HardwareID 和版本,而非一个模拟的开关。
- **已发布的签名和摘要**——URTC 构建生成的每个镜像都附带
  `<file>.manifest.json`（版本、`sha256` 以及引导程序期望的 `hmac_sha256` 值，是共享密钥的 HMAC-SHA256 而非非对称签名）和 `<file>.sha256`。应用发送该已发布的签名；如果清单中的 `sha256`
  与文件不符，将**阻止**刷写；向引导程序报告的是清单中的版本。从磁盘选择的
  文件没有清单：只能使用为该次刷写输入的签名密钥来刷写（测试板），除非同时
  选择了它的 `.manifest.json`。
- **固件补丁号**（`0x7E9`，以及从属板扩展的 `0x218`）——已安装的固件和所选镜像
  以 主版本.次版本.补丁 显示。只有双方都带有补丁号时它才参与比较；早于此功能的
  板卡（不发送 `0x7E9`）继续按 主版本.次版本 工作；补丁号只会发给已声明支持它
  的引导程序，写入 END_UPDATE。日志会说明镜像比板卡报告的版本更旧、相同还是更新。
- **来自最新 GitHub 发布版本的固件**——二进制文件是每个 URTC 版本发布版本的
  附件，而不是 git 中的文件。列表来自 `JuanenRac/URTC` 的发布版本 API（只列出
  所选板卡的应用镜像，每个都带有其 `.sha256` 和 `.manifest.json`）；下载的镜像
  必须与发布版本公布的摘要一致，镜像、清单和签名检查依然保留。GitHub 从不发送
  CORS 头的主机提供这些文件，因此浏览器可能无法下载：日志会说明，此时可使用
  内置文件夹中的镜像，或从发布页面下载后通过“浏览”连同其 `.manifest.json`
  一起选择。
- **板卡配置**：扩展板类型 / MLX9064x 传感器变体 / 自由工具配置（ID
  引脚 `11111`）/ 外设信息与序列号——`0x1A0`-`0x1A7`。

#### SWD/JTAG ——按设计,无法从浏览器中使用

没有任何 Web API 可以驱动一个 SWD/JTAG 调试探针——Web Serial 只能与
串行帧设备（如 USB-CAN 适配器）通信,而不能与探针自身的协议通信,
STM32CubeProgrammer/pyOCD 是桌面工具所调用的原生子进程。这是在浏览器
沙盒中运行的一项结构性限制,而非这里缺失的功能。Flasher Studio 中的
SWD/JTAG 选项卡说明了桌面版 `URTC Flasher` 工具在本地会运行的确切指令,
仅供参考——请直接使用该工具进行完整芯片编程、选项字节/RDP 检查,或在
批量擦除之前进行完整闪存备份。

### Tester Studio ——真实功能覆盖

从 `URTC-TESTER` 自身的 Qt Quick 面板
(`assets/qml/TesterDeck.qml`) 移植而来,针对相同的 CAN ID：

- 每个工具一个面板（电烙铁 + 送丝器、共享的纯步进运动工具、真空拾取、
  钻头、AOI、激光器、3D 打印机加热器/运动/风扇、扫描探针、电磁铁、
  点焊/超声波焊接机、包含 ADS1115 高级路径的飞针探测、UV 固化、热风
  返修、压接、热成像检测、焊膏喷射）,每一个都发送该工具的真实指令
  字节并解码其真实遥测数据。
- 为每一个在固件端具有通信看门狗的工具（电烙铁、激光器、UV 固化、
  热风返修、3D 打印机喷嘴——在 250ms 看门狗下每 150ms 重发；3D 打印机
  层冷却风扇——在其自身 1000ms 看门狗下每 400ms 重发）提供**活动复选框
  + 保活**，重发间隔与桌面工具相同。取消勾选、切换面板或选项卡、断开连接
  或关闭页面时，都会发送该工具的关闭命令。
- **全局控制**（`0x100`）、**扩展板** SPI 透传 + TMC DIAG0 查询
  （`0x180`-`0x183`）、**F-RAM** 查询/擦除（`0x190`-`0x192`）、**自检**
  （每种工具的安全静止状态检查）、带 `.trc`/`.asc` 追踪导出的**原始
  总线监视器**，以及带可选重复间隔的**自定义帧**注入器——验证方式与
  CAN 总线协议分析器自身的帧注入器相同：超出 `0`-`7FF` 的标识符、无效的
  数据字节或超过 8 字节的数据都会被拒绝并给出提示，绝不会被屏蔽、丢弃
  或截断。仅由板子发送的标识符会被拒绝，写入板子存储器、引导程序命令
  和执行器命令都会先要求确认。
- **检测硬件**查询真实的当前工具（`0x110`/`0x111`）和板卡版本
  （`0x7F8`/`0x7F9`）,声明的严重错误（`0x111` 字节 1）会以一条实时
  故障横幅显示出来。

<!-- urtc-section:heads -->
### 一条总线上的多个工具头

固件可以让多个工具头共用一条 CAN 总线（多节点扩展）。它**默认关闭**，只有一个工具头的总线与以前完全一样地工作。**工具头**窗口会查找工具头，列出每个工具头的地址、工具和序列号，并显示其状态：就绪、已选择、地址冲突、故障已锁定、处于引导程序或已丢失。您选择一个后，程序会先请您确认，之后才向该工具头发送任何内容；只要总线上有多个工具头，在选中一个并得到它的确认之前，命令都会被拒绝。如果所选工具头丢失，所有工具头都会进入安全状态（窗口中的复选框可关闭此行为）。目前只针对总线模型测试过，没有在电路板上试过。参见 URTC-COMMON 中的 `docs/MULTINODE.md`。
<!-- /urtc-section:heads -->

## 🔒 安全与防护

| 威胁 | 防御 |
|---|---|
| 格式错误的帧到达总线或屏幕 | SLCAN 链路的两个方向都会校验：超出 `0x000`-`0x7FF` 的标识符、超过 8 字节的载荷或超出 `0x00`-`0xFF` 的字节会在写出前被拒绝，收到的不是真正 SLCAN 帧的行会被丢弃 |
| 页面里带着机密 | 应用不含任何签名密钥：Flasher Studio 只发送 URTC 构建在每个镜像旁发布的签名，所以页面可以公开托管 |
| 错误或被篡改的固件镜像 | 清单的 `sha256` 与文件不符会阻止刷写；正式发布版的每个镜像都带有 Ed25519 发布签名，页面在发送镜像前于浏览器中核对 |
| 把模拟的应答当成真实的 | 沙盒标签页不发送任何数据，连接板子时也不做任何应答；它们的帧标为 SIM，回放的轨迹标为 REPLAY |
| 误对板子执行操作 | 激光、钻头、紫外固化、焊接、加热器、运动、锡膏喷射、写入板子存储器、有风险的手输帧以及用公开开发密钥签名的镜像，都会先要求确认 |
| 执行器一直在运转 | 每个带固件看门狗的工具靠重发保持存活，并在面板被替换、切换标签页、断开板子或关闭页面时关闭；STOP ALL 会关闭页面保持存活的一切 |
| 页面从别处加载代码 | 内容安全策略：脚本只来自页面本身，连接只到自身和 GitHub |

STOP ALL 是软件命令，不是紧急停止，以上检查都不是安全功能。

### 模拟器隔离与确认（软件检查，并非安全功能）

- 沙盒选项卡（Control、OLED、Thermal IR）不会发送任何内容。它们的帧带有 SIM 标记，并且在已连接板子时不会产生模拟应答。协议分析器的预定义消息中，只有简单查询会发送给已连接的板子；其余仍为模拟。
- Tester Studio 仅为板子自己上报（`0x111`）的工具显示工具面板，在板子应答之前不显示任何面板。
- 激光器、钻头、UV 固化、焊接、加热器、运动、焊膏喷射、写入板子存储器以及有风险的手动输入帧，都会先要求确认。
- 页眉中的 **全部停止**（连接时显示）会关闭此页面正在保持运行的所有执行器；关闭页面和断开连接时也会执行同样的操作。它是软件命令，不是紧急停止。
- 烧录使用公开开发密钥签名的镜像之前会先要求确认，因为该密钥无法证明镜像由谁制作。
- 当电路板报告严重错误时，如果电路板给出了原因，横幅还会显示热失控保护的原因。
- **回放已录制的跟踪**（CAN Bus Protocol Analyzer）：`.trc` 或 `.asc` 文件（例如 Raw Bus Monitor 导出的文件）中接收到的帧，可在没有开发板的情况下回放到日志和各面板，速度 0.25x 至 10x，也可循环。这些帧标记为 REPLAY，不会发送任何内容，录制内容绝不会应答请求，也绝不会被导出为开发板所说的内容，并且只要连接了开发板，回放就会暂停。

### 安全说明：本应用不包含签名密钥

自 0.2.3 起，本应用**不**包含任何 HMAC-SHA256 签名密钥。URTC 构建会自行为
每个应用镜像签名（仅发布版本使用私钥；已发布的镜像使用公开的开发密钥），并把签名发布在镜像旁边；Flasher
Studio 只负责传送该签名——与桌面版 `URTC Flasher` 相同的模式。JS 包中没有
任何机密，因此页面可以公开托管。

唯一的例外是没有清单的自建镜像（用于测试板）：此时应用会要求输入签名密钥，
仅在该次刷写期间保存在内存中，从不存储。使用公开开发密钥签名的镜像（清单中
`signing_key_kind: "dev"`）只能安装到以相同方式构建引导程序的板卡上——日志
会给出提示。参见 URTC 的 `docs/FIRMWARE_SIGNING.TXT`。

该文件夹**不在 git 中**：由 `npm run sync-firmware` 创建（CI 和 Pages 构建会在测试和构建之前运行它）。在没有正式发布版本期间，GitHub 的 “latest” 会返回 404，由 `firmware-release.json` 指定改用的发布版本（目前是台架预发布版）；发布正式版本后，请删除该文件或修改其标签。**页面的安全性**：脚本、样式、字体和图片都来自页面本身（字体随应用打包，不会向字体服务器发出请求），内联只允许 React 写入的样式属性，页面只能访问自己的源以及提供发布文件的 GitHub 主机（构建出的 `index.html` 中的 Content-Security-Policy）。能够发送响应头的主机使用 `public/_headers`（相同的策略、`Permissions-Policy: serial=(self)`，没有其他强大的权限）；GitHub Pages 无法发送响应头，因此在那里只有页面内的策略生效。

`public/firmware/` 中正是 URTC 发布的文件（相同名称、相同字节，并附带附属
文件）。URTC 的二进制文件不在 git 中：它们是每个版本 GitHub 发布版本的附件。
`npm run sync-firmware` 会下载最新的发布版本（指定版本用
`npm run sync-firmware -- --tag v0.3.5`），或把本地文件夹作为参数
（台架构建用 `npm run sync-firmware -- ../URTC/firmware`）。两种方式都会在改动
`public/firmware/` 之前检查每个摘要和签名字段，并重新生成
`src/lib/bundledFirmware.ts`；测试会对照清单校验该文件包。

正式发布的每个文件都有发布签名（`<文件>.sig`，Ed25519）：同步时若签名存在会进行验证并拒绝错误的签名；没有签名的文件集（试验台预发布版或本地构建）需要 `--allow-unsigned`。页面在把内置镜像或 GitHub 发布的镜像发送到板子之前，会在浏览器中（Web Crypto）验证同一个签名，签名无效则停止。

## 🔌 接口

- 一个运行 **SLCAN** 固件的 USB-CAN 适配器（例如运行
  `candlelight`/`slcan` 的 CANable,或任何支持标准 `lawicel` SLCAN 串口
  协议的适配器）——这与两款桌面工具通过各自的串口传输方式所支持的适配器
  类型相同。
- 总线设置为 **500 kbit/s**。连接时，应用会依次尝试 500、250、125 kbit/s 及其他标准速率，并保留第一个有板子应答版本查询的速率；目前还不能手动选择速率，也不能在没有板子应答时仅作监听。
- 一款支持 Web Serial 的浏览器——**Chrome 或 Edge**。Firefox 和 Safari
  未实现 Web Serial,将完全无法连接。
- Web Serial 需要安全上下文（HTTPS）或 `localhost`——并且不能在 iframe
  内使用。如果你正在一个嵌入式框架内预览本应用,请先在其自身的标签页中
  打开它。

### CAN 帧验证

SLCAN 链路的两个方向都会在任何数据到达 UI 或总线之前被验证
（`src/hooks/useSerialCanBus.ts`）：

- **发送方向** - 如果命令的标识符超出 11 位标准 CAN 范围
  （`0x000`-`0x7FF`）、负载超过 8 字节，或负载中有字节超出
  `0x00`-`0xFF`，`sendFrame()` 就拒绝将其序列化。UI 会显示
  “Refusing malformed CAN frame: ...”，而不会将无效文本写入串口。
- **接收方向** - `processBuffer()` 要求收到的 SLCAN 行必须真实匹配
  `t<3 位十六进制 ID><1 位十六进制 DLC 0-8><十六进制负载>`
  才会转换为 `CanFrame`；DLC 超出 `0`-`8` 范围，或负载长度短于
  其声明长度时，会记录到控制台并被丢弃，而不会以 `NaN`
  字节的形式交给工具面板。有效负载之后可选的适配器时间戳
  仍然会被接受。

## 🚀 快速开始

### 前置条件

- Node.js 20 LTS+
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

开发服务器只监听 `localhost`：Web Serial 只能在 https 或 localhost 下工作，向网络开放没有任何好处。

### 静态构建

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

构建出的页面声明了内容安全策略（脚本只来自页面本身；连接只指向页面本身和 GitHub），并在首次打开每个标签页时才加载它。`npm run test:e2e` 会在真实的 Chromium 中针对建模的板子驱动它；尚未配合真实适配器试用过。

<!-- urtc-section:compatibility -->
### 要求与兼容性

哪些版本的 URTC 程序可以配合使用、各自使用哪个协议版本，列在 URTC-COMMON 生成的兼容性表中：[docs/COMPATIBILITY.md](https://github.com/JuanenRac/URTC/blob/main/docs/COMPATIBILITY.md)。
<!-- /urtc-section:compatibility -->

## 🧪 测试

`npm test`（Vitest）运行 577 个纯逻辑测试：SLCAN 解析、请求与应答的匹配、固件镜像和清单检查、发布签名、工具限值、确认、把模拟器与真实总线分开的规则、轨迹的导出和回放、节点选择器、机架模拟器、保存的会话记录、离线副本、固件同步以及八种界面语言。`npm run lint` 检查源码类型，`npm run test:e2e` 在真实的 Chromium 中针对建模的适配器和板子运行 19 个端到端检查（`npm run test:coverage` 增加覆盖率下限）。界面和 Web Serial 传输没有自己的单元测试，由端到端检查来驱动它们。这一切都没有针对真实的适配器或板子运行过。

## 🏗️ 构建与发布

### GitHub Pages（所有者启用前保持关闭）

本仓库可以把构建好的站点发布到 GitHub Pages（工作流 `.github/workflows/pages.yml`：`npm ci`、类型检查、测试、带项目基础路径的 `npm run build`，然后是 `upload-pages-artifact` 和 `deploy-pages`）。**该工作流目前处于关闭状态**：只有当仓库变量 `URTC_PAGES_ENABLED` 为 `true`（Settings > Secrets and variables > Actions > Variables）时，两个作业才会运行，所有者在 URTC 的第一个已签名正式发布之后设置它。此时构建会执行 `npm run sync-firmware -- --require-official`：只取最新正式发布的固件（绝不使用预发布版本，也不使用 `firmware-release.json` 的备用标签），拒绝任何没有有效发布签名的文件，以及任何用公开开发密钥构建的应用镜像，因此发布的页面不可能带有开发密钥的镜像。Pages 本身也需要启用一次（Settings > Pages > Source: GitHub Actions）；变量未设置时工作流会被跳过。Web Serial 需要基于 Chromium 的浏览器和 https，Pages 提供 https。

`package.json` 的 `version` 与 `urtc.project.json` 的 `version` 只会通过明确的步骤（`python bump.py`，它让两者保持一致并写入变更日志条目）改变；`build.bat` / `build.sh`、`npm run build`、`npm run dev`、`npm run lint` 和 `npm run preview` 从不改变版本。

## 📂 仓库结构

<p align="center">
  <img src="images/repository-structure.svg" alt="URTC-WEB-STUDIO 的仓库结构" width="100%">
</p>

<details>
<summary>目录树的文本版</summary>

```text
URTC-WEB-STUDIO/
├── src/                                           应用：组件、hooks、CAN、SLCAN 和固件逻辑、八个语言文件和生成的表格
├── docs/                                          架构、构建与运行、集成约定
├── e2e/                                           端到端检查和板子的模型
├── public/                                        内置固件、响应头、Web 清单
├── scripts/                                       固件同步和 service worker
├── tools/                                         构建检查和共用工具
├── images/                                        横幅和本 README 的图片
├── .github/                                       CI 工作流以及 Issue 和 Pull Request 模板
├── build.sh build.bat                             构建脚本
├── build-test.sh build-test.bat                   构建并测试的脚本，不会修改仓库内容
├── test.sh test.bat                               运行测试
├── urtc.project.json                              清单：版本、角色、成熟度和构建命令
├── CHANGELOG.md                                   每个版本的变更
├── SECURITY.md SUPPORT.md LICENSE                 安全政策、支持和许可证
├── CONTRIBUTING.md CODE_OF_CONDUCT.md             如何参与贡献和行为准则
├── .gitattributes .gitignore                      Git 设置
├── dev.sh dev.bat                                 安装并启动开发服务器
├── bump.py bump_manifest_version.py               提升版本号的脚本
├── index.html                                     Vite 入口页
├── package.json package-lock.json tsconfig.json   软件包、锁定的版本、TypeScript 和 Vite
├── playwright.config.ts vite.config.ts            端到端检查的设置
├── playwright.screenshots.config.ts               README 屏幕截图使用的 Playwright 设置
├── urtc_i18n.lock.json                            生成语言文件的锁文件
└── NOTICE LICENSE.md                              版权声明和文档许可证
```

</details>

每个源文件的带注释清单（每个文件一行）见 [docs/SOURCE_MAP.md](docs/SOURCE_MAP.md)。

## 🗺️ 路线图与已知限制

- 仅监听模式和手动选择比特率：无法接入没有任何板子应答的总线。
- 读取热成像图像时不会先检查传感器是否就绪，也不会重试丢失的数据块。
- 在浏览器中直接从 GitHub 发布版本下载固件文件：GitHub 从不带 CORS 头的主机提供发布版本的文件，因此下载可能被阻止（内置镜像，或从磁盘选择的文件连同其 `.manifest.json`，始终可用）。

## 🌍 语言

README 和文本提供英语、西班牙语、法语、意大利语、德语、汉语、日语和欧洲葡萄牙语版本。

## 🔗 相关项目

URTC 由相互独立的仓库组成，每个仓库都有自己的版本、测试和 README。以下是按组划分的家族：

* **URTC Tool Platform:**
  * [URTC](https://github.com/JuanenRac/URTC) - 工具头电路板的固件(25 个工具配置、CAN 引导程序)以及 CAN 协议参考。
  * [URTC-COMMON](https://github.com/JuanenRac/URTC-COMMON) - 只写一次的 CAN 协议数据(规范、生成的表格、一致性向量)以及各程序共享的代码。
  * [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER) - 通过 CAN 或 SWD/JTAG 更新电路板固件的桌面工具。
  * [URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY) - 位于 CAN 总线前的网关:只放行列表中的标识符,限制其速率,并要求会话密钥。
  * [URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK) - 用于带预热和生命周期跟踪的工具架的、与硬件无关的 C 逻辑和命令协议。
  * [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER) - 桌面实时 CAN 总线测试器,显示电路板所报告工具配置的控件和遥测。
  * [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL) - C 语言的传感器帧协议,以及用于检测工具头的 Python 热成像/RGB 配套程序。
  * **URTC-WEB-STUDIO** (本仓库) - 通过 Web Serial 和 SLCAN 烧录并测试电路板的浏览器应用,无需安装。
* **Ecosystem Operations:**
  * [URTC-DEVTOOLS](https://github.com/JuanenRac/URTC-DEVTOOLS) - 家族共用的仓库工具，作为带版本的整套工具，并用锁文件区分被改动的副本和已过时的副本。
  * [URTC-DOCS](https://github.com/JuanenRac/URTC-DOCS) - 生态系统的架构、接口、安全基线和生成的目录,以及比较所有仓库的工具。
  * [URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER) - 检测、安装并更新 URTC 家族仓库的桌面工具,每次只执行一个明确的操作。

**姊妹项目（相互独立，共用同一基础和工具）：**

* **[HYDRA-UMC-DOCS](https://github.com/JuanenRac/HYDRA-UMC-DOCS)** - 姊妹项目：HYDRA-UMC 的文档中心，一个独立的生态，与本生态共用基础和工具
* **[ARMOR-DOCS](https://github.com/JuanenRac/ARMOR-DOCS)** - 姊妹项目：A.R.M.O.R. 安全生态的文档中心，同样独立，建立在同一基础上
* **[JuanenRac](https://github.com/JuanenRac/JuanenRac)** - 所有生态的个人主页和状态面板

## 📚 文档

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) —— UI、持久化设置与外部传输权威
  如何保持分离，以及为什么沙盒标签页必须展示离线/不可用状态，
  而不能将模拟数据当作真实数据展示。
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) —— 非破坏性验证路径
  `build-test.bat`/`.sh`（TypeScript + 测试，不会修改版本或 CHANGELOG）、
  用于本地开发的 `dev.bat`/`.sh`，以及为什么 OTA 签名材料
  绝不属于浏览器配置。
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) —— 本客户端遇到
  未知模式、缺失目标身份或格式错误的 API 结果时应如何处理，
  以及为什么真实的烧录权限保留在服务器端或专用桌面工具中。

- **[CONTRIBUTING.md](CONTRIBUTING.md)** —— 提交 Pull Request 所需的技术栈和编码规范。
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** —— 本社区所期望的行为准则。
- **[SECURITY.md](SECURITY.md)** —— 如何报告漏洞，以及本项目真实的安全关注重点。
- **[SUPPORT.md](SUPPORT.md)** —— 在哪里提问和报告缺陷。
- **[LICENSE.md](LICENSE.md)** —— 本项目自身的许可证。

## 🤝 参与贡献与社区

* 提交 Pull Request 之前请运行 `URTC_CI=1 python tools/ci_validate.py`：必须通过。参见 [CONTRIBUTING.md](CONTRIBUTING.md) 和[行为准则](CODE_OF_CONDUCT.md)。
* README 有八种语言：修改文字时要同步修改全部八个文件，与其他仓库共用的章节由 URTC-COMMON 的 `tools/readme_sections.py` 写入。
* 对 CAN 协议的修改从 URTC-COMMON（`spec/can_protocol.json`）开始，并通过经过核对的副本进入本仓库。
* 不要把仅仅构建过的东西描述为已在板子上运行。
* 请私下报告漏洞：[SECURITY.md](SECURITY.md)。问题、想法和报告：electrohobby3d@gmail.com（[SUPPORT.md](SUPPORT.md)）。

## 👤 作者

**JuanenRac**（Electro Hobby 3D）
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

## 📜 许可证

URTC Web Studio 版权所有 (c) 2026 JuanenRac（Electro Hobby 3D）。分发本项目
或其衍生作品时必须包含此声明。

本项目由源代码及其自身的文档组成,两者依据不同的许可证提供——各自适合
其实际所涵盖的内容：

1. 源代码（`src/` 下的一切,加上构建它的 Vite/TypeScript 配置）依据
   **GNU 通用公共许可证 v3.0（GPL-3.0-or-later）** 提供。完整文本见
   https://www.gnu.org/licenses/gpl-3.0.html。

2. 文档（本 README 及其自身的翻译版本——`README_spa.md`、`README_ita.md`、
   `README_fra.md`、`README_deu.md`、`README_zho.md`、`README_jpn.md`）
   依据 **知识共享 署名-相同方式共享 4.0 国际许可协议（CC BY-SA 4.0）**
   提供。完整文本见 https://creativecommons.org/licenses/by-sa/4.0/。

本工具是 [URTC（Universal Robot Tool Controller）](https://github.com/JuanenRac/URTC)
项目的浏览器端配套工具——本工具所对接的板卡固件、硬件设计和完整协议
文档见该项目自身的仓库。URTC 自身的固件为 GPL-3.0-or-later,其硬件设计为
CERN-OHL-S v2;本工具自身的许可证并不延伸至那个独立的项目,反之亦然。
两款覆盖相同功能范围的桌面原生替代方案也存在：
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) 和
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER)。

如果你基于本项目进行开发,请留意这种许可证划分：代码更改应保持
GPL-3.0-or-later,文档衍生品应保持 CC BY-SA——每一项都需附带指向本项目及其
作者的署名。

**黑匣子、可选功能、机架试验台和热像标签页(新增,仅用模拟对象检查):** Tester Studio 读取故障记录器(`0x1A8` / `0x1A9`)并下载为 CSV 或 JSON,该选项开启时,板卡每报告一次错误就自动读取一次;可在确认后切换固件的可选功能(`0x1AE` / `0x1AF`,默认关闭,下次上电后生效);在页面中模拟工具机架,并带有每个工具头的身份(类型和序列号);并以伪彩色绘制热检测图像(模拟图像会明确标注)。工具目录现在来自 URTC-COMMON 的共享工具配置。这些都没有在真实板卡上试过。

**黑匣子查看器（新增，仅用测试验证）：** Black Box 选项卡会绘制错误发生前所记录那几秒的测量温度和设定值，并在错误标志首次出现的位置画一条线；无需连接开发板即可打开之前保存的记录（该选项卡自己写出的 JSON 或 CSV 文件）；不是记录、含有超出范围的值或超过 67 个采样的文件会被拒绝并给出原因。

**离线副本与安装（新增，仅用测试和浏览器验证）：** 构建时会写出 service worker（`sw.js`）和 Web 应用清单；首次通过 https（或在 localhost）访问后，浏览器会保存页面、其脚本和随附的固件，页眉显示 **可离线使用**，Studio 无需网络即可打开（此时页眉显示 **离线**）；浏览器支持时，**安装** 按钮可将 Studio 安装为应用。页面和固件清单总是先向网络请求，因此在线时会得到最新的；`version.json` 从不由副本回答；新版本会等到已打开的标签页关闭后才接管。GitHub API 不会被保存：没有网络时无法查询最新发布，只使用随附的镜像。

**热计数随时间变化（新增，仅用测试和建模的板子验证）：** 在黑匣子标签页中，累计热计数（`0x1AA` / `0x1AB`）可每 10 秒、30 秒、1 分钟或 5 分钟重新读取；每次读取都会加入保存在浏览器中的历史，绘出加热器小时数和故障随时间的变化，可下载为 CSV 并清除；计数下降（换了另一块板）时历史会重新开始。

**已保存的会话（新增，仅用测试和建模的板子验证）：** 总线监视器将帧保存为日志，以及按 SHA-256 和大小标识该日志的记录，格式与桌面版测试器相同；**校验已保存的会话** 读取记录及其日志，并说明二者是否匹配。它证明日志未被编辑。如果浏览器能够生成 Ed25519 签名，记录还会带有用此浏览器的密钥（首次使用时生成并保存在浏览器中）作出的签名：它表明记录在签名后未被编辑，但不说明谁持有该密钥。 监视器还可以只显示您输入的 ID，或只显示数据发生变化的帧（速率和负载仍统计每一帧）。

**版本提示（新增，仅用测试验证）：** 构建时会在页面旁写出 `version.json`；已构建的页面在打开时仅比较一次，且只在同源范围内与自身版本对比，若所提供的版本更高，就会提示并给出“刷新”按钮。页面不会自动刷新，版本相同或更旧时不提示，文件缺失或没有网络时也保持静默。

**加热器 PID（在“可选功能”标签页中；新增，仅用模拟验证）:** Tester Studio 读取固件加热器 PID 的状态（`0x1B9` / `0x1BA`: 当前生效的增益、状态和上一个控制周期的输出），保存增益（0 到 600），并启动或取消继电器式自整定；自整定会在烙铁当前设定温度（100 到 445 C）附近加热烙铁头，并保存找到的增益。保存增益和启动自整定需要确认，取消则不需要；不是 0 到 600 之间数字的增益会在发送任何内容之前被拒绝。须先在可选功能中打开该功能；以上内容都没有在真实电路板上试过。
