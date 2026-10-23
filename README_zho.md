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


<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
  <img src="https://img.shields.io/badge/Tool-Vite-646CFF.svg" alt="Vite">
</p>


一个基于浏览器的**通用机器人工具控制器（URTC）**配套工具——一个 React/Vite
单页应用，通过 [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)，
经由 USB-CAN 适配器与真实的 URTC 硬件通信（但从未在真实硬件上运行过），使用与两款桌面配套工具
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) 和
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER) 相同的 SLCAN 帧格式和
CAN 协议。目标是把这两款工具的主要工作流集中到单个浏览器标签页内，而非它们的简化演示版；尚未达到完全对等（见下文“尚未覆盖”）——Flasher Studio 和 Tester Studio 选项卡发送和接收的正是
[URTC 固件仓库](https://github.com/JuanenRac/URTC) `docs/CANBUS.TXT` 中所描述
的真实 CAN 帧。

**诚实检查——今天真正能运行的部分：** `npm test`（Vitest）覆盖纯逻辑：SLCAN 解析、请求与应答的匹配、固件镜像和清单检查、工具限值、确认对话框、将模拟器与真实总线隔离的规则、追踪导出以及八种界面语言。界面和 Web Serial 传输本身没有自动化测试，而且在本环境中这些都没有对真实的 URTC 板子运行过（这里没有可用于测试的 USB-CAN 适配器）：Flasher Studio、Tester Studio 和 CAN 总线协议分析器是真实代码，仅由这些测试、类型检查（`npm run lint`）和代码审查验证。Control/OLED/Specs-BOM/Thermal IR Inspection 是明确标注的沙盒选项卡，没有任何 CAN 流量。迄今已交付的确切内容请参阅 `CHANGELOG.md`。

---

> **安全与安防现状:**本生态系统不是经认证的安全系统,目前也不存在已组装的 URTC 电路板。引导程序使用 CRC32 和共享密钥的 HMAC-SHA256 校验固件映像,而非非对称签名(计划中);已发布的应用映像使用公开的开发密钥签名(`signing_key_kind: dev`),因此任何人都可以生成引导程序接受的映像;尚未向任何真实电路板发送过任何内容。在依赖此处任何说法来保障人身安全之前,请先阅读[安全基线](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md)和[威胁模型](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md)。

## 📋 速览

| | |
|---|---|
| 版本 | `0.3.6` |
| 成熟度 | 可用 |
| 技术栈 | Web Serial API / TypeScript |
| 目标 | 使用者电脑上的网页浏览器 |
| 真实硬件 | 仅模拟：使用模拟器、替身或仿真测试；此版本没有在真实硬件上运行的记录 |

## 🧭 什么是真实的，什么是沙盒

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

## 🔌 你需要的硬件

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

## 🛡️ CAN 帧验证

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

## ⚡ Flasher Studio ——真实功能覆盖

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

### 模拟器隔离与确认（软件检查，并非安全功能）

- 沙盒选项卡（Control、OLED、Thermal IR）不会发送任何内容。它们的帧带有 SIM 标记，并且在已连接板子时不会产生模拟应答。协议分析器的预定义消息中，只有简单查询会发送给已连接的板子；其余仍为模拟。
- Tester Studio 仅为板子自己上报（`0x111`）的工具显示工具面板，在板子应答之前不显示任何面板。
- 激光器、钻头、UV 固化、焊接、加热器、运动、焊膏喷射、写入板子存储器以及有风险的手动输入帧，都会先要求确认。
- 页眉中的 **全部停止**（连接时显示）会关闭此页面正在保持运行的所有执行器；关闭页面和断开连接时也会执行同样的操作。它是软件命令，不是紧急停止。
- 烧录使用公开开发密钥签名的镜像之前会先要求确认，因为该密钥无法证明镜像由谁制作。
- 当电路板报告严重错误时，如果电路板给出了原因，横幅还会显示热失控保护的原因。
- **回放已录制的跟踪**（CAN Bus Protocol Analyzer）：`.trc` 或 `.asc` 文件（例如 Raw Bus Monitor 导出的文件）中接收到的帧，可在没有开发板的情况下回放到日志和各面板，速度 0.25x 至 10x，也可循环。这些帧标记为 REPLAY，不会发送任何内容，录制内容绝不会应答请求，也绝不会被导出为开发板所说的内容，并且只要连接了开发板，回放就会暂停。

### 尚未覆盖

- 热成像检测的错误计数器（`0x1AA`/`0x1AB`）。
- 仅监听模式和手动选择比特率：无法接入没有任何板子应答的总线。
- 读取热成像图像时不会先检查传感器是否就绪，也不会重试丢失的数据块。
- 在浏览器中直接从 GitHub 发布版本下载固件文件：GitHub 从不带 CORS 头的主机提供发布版本的文件，因此下载可能被阻止（内置镜像，或从磁盘选择的文件连同其 `.manifest.json`，始终可用）。

## 🔐 安全说明：本应用不包含签名密钥

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

构建出的页面声明了内容安全策略（脚本只来自页面本身；连接只指向页面本身和 GitHub），并在首次打开每个标签页时才加载它。尚未在真实浏览器中试用过。

### GitHub Pages（台架工具）

本仓库可以把构建好的站点发布到 GitHub Pages（工作流 `.github/workflows/pages.yml`：`npm ci`、类型检查、测试、使用项目基础路径的 `npm run build`，然后是 `upload-pages-artifact` 和 `deploy-pages`）。它作为**台架工具**提供：其中包含的固件镜像使用公开的开发密钥签名，任何人都可以使用该密钥，因此发布的页面会显示相应提示，不能作为运行中设备的可信固件来源。要启用它，仓库所有者打开 Settings > Pages，把 Source 设为 "GitHub Actions"；在此之前，工作流会结束而不部署。Web Serial 需要基于 Chromium 的浏览器和 https，Pages 提供 https。

### 版本管理

`package.json` 的 `version`（以及 `urtc.project.json` 中对应的 `version`）只会由显式步骤 `python bump.py` 递增（它运行 `bump_manifest_version.py`，从 `package.json` 读取当前版本，递增后写回，同步清单文件，并在该版本尚无 CHANGELOG 条目时补充一条简要条目）。`build.bat`/`build.sh` 只做编译，绝不触碰版本号。`npm run build`
（`vite build`）本身刻意只做编译，绝不触碰版本号——`scripts/bump-version.mjs`
在早期采用 `prebuild` 钩子的设计中承担过这项工作，但如今已是遗留脚本，
仅作参考保留（见其自身文件头注释）；`npm run dev`/`lint`/`preview` 同样
绝不会触碰版本号。这不是语义化版本控制：它是一个十进制里程表。补丁位
加一；一旦它会超过 9，就重置为 0，并改为将次版本位加一
（`0.1.9` -> `0.2.0`，绝不会是 `0.1.10`）；同样的进位会从次版本级联到
主版本。版本历史以及本项目过往工作的摘要见 `CHANGELOG.md`。
## 📖 更多文档

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
│   ├── i18n.ts                     i18next 配置——en/es/de/fr/it/zh/ja/pt,
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
│   │   ├── TraceReplayPanel.tsx     加载 .trc/.asc 跟踪并回放到日志
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
│   │   ├── useTraceReplay.ts        把已录制的跟踪回放到日志和各面板
│   │   └── useKeepalive.ts          固定间隔重发钩子,支撑每个工具的
│   │                                活动复选框看门狗保活
│   ├── lib/
│   │   ├── flasher.ts               OTA 协议常量、CRC32/HMAC 辅助函数、
│   │   │                            清单解析（不含签名密钥）
│   │   ├── traceReplay.ts           读取 .trc/.asc 跟踪；带速度和暂停的播放器
│   │   ├── boardVersion.ts          版本查询：0x7F9/0x7FA/0x7E9 以及从属板的 0x217/0x218
│   │   ├── githubRelease.ts         最新 GitHub 发布版本的镜像及其下载
│   │   ├── firmwareImage.ts         镜像检查、清单目标与版本（含补丁号）
│   │   ├── firmwareSignature.ts     选择要发送的签名：已发布的签名，或为单次
│   │   │                            刷写输入的密钥；sha256 检查
│   │   ├── quickState.ts            0x111 解码（热故障、复位原因）
│   │   ├── bundledFirmware.ts       由 scripts/sync-firmware.mjs 生成
│   │   └── canIds.ts                Tester Studio 的 CAN ID 常量——逐字节
│   │                                 镜像 tester_config.py
│   └── locales/                     界面字符串——en.json、es.json、
│                                     de.json、fr.json、it.json、
│                                     zh.json、ja.json、pt.json
├── scripts/
│   ├── bump-version.mjs             无依赖的版本递增脚本;如今已是
│   │                                 遗留脚本,仅作参考 - 已由 bump_manifest_version.py
│   │                                 取代（见上方“版本管理”）
│   └── sync-firmware.mjs            将 URTC 发布版本文件（或本地文件夹）复制到
│   │                                 public/firmware/，校验摘要 - npm run sync-firmware
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
├── vite.config.ts                   Vite + Tailwind 插件配置
├── tsconfig.json                    TypeScript 配置
├── .env.example                     应用不读取任何环境变量
├── dev.bat / dev.sh                 安装依赖 + 启动 Vite 开发服务器
├── build.bat / build.sh             安装依赖 + 生成静态 dist/ 构建
├── tools/
│   └── ci_validate.py               CI 使用的 manifest/CHANGELOG/docs 校验
├── bump.py                          显式的版本递增命令（编译从不递增）
├── bump_manifest_version.py         仅由 `bump.py` 触发的版本递增（package.json + 清单，见“版本管理”）；也存在 `--sync` 模式用于接受一次先前的原生递增
├── package.json
├── CHANGELOG.md                     版本历史与过往工作摘要
├── LICENSE
├── NOTICE                      版权声明和文档许可证
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

**加热器 PID（在“可选功能”标签页中；新增，仅用模拟验证）:** Tester Studio 读取固件加热器 PID 的状态（`0x1B9` / `0x1BA`: 当前生效的增益、状态和上一个控制周期的输出），保存增益（0 到 600），并启动或取消继电器式自整定；自整定会在烙铁当前设定温度（100 到 445 C）附近加热烙铁头，并保存找到的增益。保存增益和启动自整定需要确认，取消则不需要；不是 0 到 600 之间数字的增益会在发送任何内容之前被拒绝。须先在可选功能中打开该功能；以上内容都没有在真实电路板上试过。

## 🔗 相关项目

本项目是同一作者(JuanenRac / Electro Hobby 3D)打造的 HYDRA-UMC 机器人生态系统的一部分。值得了解,因为某个请求实际上可能是关于这些项目之一,而非本仓库本身。

**父项目**
- **[URTC](https://github.com/JuanenRac/URTC)** — 面向实体 Universal Robot Tool Controller 板卡的固件,通过 CAN 总线支持 25 种以上工具配置;本仓库是其自身 CAN 总线工具家族中一个具体工具所属的父项目。

**兄弟项目** —— URTC 自身 CAN 总线工具家族中的其他工具
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — 面向 URTC 板卡的桌面图形烧录工具，支持 CAN-OTA 以及全芯片 SWD/JTAG —— 与本浏览器应用采用相同的 SLCAN/CAN 协议,本应用即是其免安装替代方案。
- **[URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY)** — 位于 CAN 总线前的网关，只放行列表中的标识符，限制其速率，并要求会话密钥。
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — 面向 URTC 板卡的桌面实时 CAN 总线诊断工具，每种工具配置对应一个面板 —— 与本浏览器应用采用相同的 SLCAN/CAN 协议,本应用即是其免安装替代方案。

**直接相关**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — 具备真实、稳定退出码契约的车队 CLI，是 HYDRA-UMC-SERVER 自身 API 的真实在线客户端 —— 本浏览器工具的终端/命令行替代方案。

**生态系统中的其他项目**

*核心硬件与平台*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — 机器人手臂主板设计——CM5 主机 + 双核 STM32H745,目标是通过 CAN-OTA/SPI-OTA 协调最多 8 条工具臂(固件处于早期阶段,尚无已组装的电路板)。
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — 面向 CM5 的可复现 Raspberry Pi OS 产品层——只读代理、经过验证的配置/配置文件、WiFi 首次配网。
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — 每个桥接都据此校验自身指令的共享 JSON-Schema 契约与软件作业门限边界(并非经认证的安全功能)。
- **[HYDRA-UMC-CONNECTOR-HUB](https://github.com/JuanenRac/HYDRA-UMC-CONNECTOR-HUB)** — 面向外部机器连接器的声明式适配器清单注册与校验工具；把 SDK 自身的契约理念扩展到外部机器，而不取代工业网关类项目。

*核心后端与客户端*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — 每个控制客户端真正通信的真实无头后端(REST/WebSocket)。
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — 具有实时多机器人 3D 可视化的网页控制面板。
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — 面向多台服务器的桌面(PySide6)集群指挥中心，打包为独立可执行文件。
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — 具有生物识别登录和配对 Wear OS 伴侣应用的原生 Android 控制应用。
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — 具有实时 WebSocket 同步的 iOS/iPadOS 控制应用(Flutter)。
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — 面向机载 7 英寸 DSI 触摸屏的原生触控界面，直接嵌入 CM5 本体。
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — 将完成的模型推送到 STUDIO 自身目录的桌面版图形化 URDF 创建/编辑工具。
- **[HYDRA-UMC-EDITOR-STL](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-STL)** — 桌面 STL 模型编辑器，在 HYDRA-UMC-EDITOR-URDF 编辑的同一模型目录中变换/替换/移除/添加真实部件。
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — 通过 VDA 5050 MQTT 发布者为 AGV/AMR 车队提供的协调边界(仅针对仿真车队测试)。
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — 具备 GRBL 状态/控制字节访问能力的高层 CNC 单元协调器(仅针对模拟器测试)。
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — 面向足式/人形机器人的协调边界,带有 Boston Dynamics Spot 指令发送器(仅针对模拟器测试)。
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — 读取 3 路钥匙/外壳/联锁 GPIO 信号的激光单元协调器(仅针对模拟芯片测试;无法使激光器上膛或发射)。
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — 面向 OpenPnP 贴片机板级流程的安全高层协调器。
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — 面向 Moonraker/Klipper 3D 打印机的安全协调边界，具备真实的受控作业指令。
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — 带有惰性导入 rclpy ROS 2 传输层的协调器(尚未在 ROS 2 环境中运行)。
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — 面向搭载摄像头的无人机的协调边界,带有 MAVLink 指令发送器(仅针对模拟器测试)。

*视觉 AI 节点(Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — 面向 Hailo-8 视觉流水线的集成中枢，具备逐阶段的真实硬件就绪检测。
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — 具备 Hailo 架构/校验和安全加载验证的真实编译模型注册表。
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — 具备真实 HailoRT 集成边界的真实 GStreamer 流水线 + MediaMTX 配置生成器。
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — 以区域状态为授权条件的 Position-Based Visual Servoing 修正律;尚无摄像头位姿估计。
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — 从文件读取物体位置的 v0 区域入侵、校准新鲜度与 E-STOP 请求逻辑;没有检测器为其供数,也尚未连接任何物理 E-STOP。

*认知 AI 节点(Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — 面向 Hailo-10 认知流水线(LLM/VLA/语音编排)的集成中枢。
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — 面向 Vision-Language-Action 模型的真实动作 token 编解码与轨迹生成。
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — 具备受限、需确认的 Watch 中继的真实语音前端(VAD + 意图解析)。
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — 基于真实规则的任务分解，以及针对 MCU 错误码的语义化错误恢复。
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — 面向本生态系统自身 Markdown 文档的真实纯标准库 TF-IDF 文档检索。
- **[HYDRA-UMC-LOCAL-TECHNICIAN](https://github.com/JuanenRac/HYDRA-UMC-LOCAL-TECHNICIAN)** — 面向生态系统自身的本地、按策略门控的 AI 维护技师——观察、诊断并提出修复建议;两个最高风险等级目前特意尚未实现。

*编排与集群*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — 具备真实 gRPC/Protobuf 健康报告契约与任务状态机的集成中枢。
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — 基于真实 HTTP API 的真实优先级任务队列，支持去重。
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — 具备重试/退避与身份不匹配检测的真实基于 gRPC 的车队健康看门狗。
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — 具备真实障碍物/工作空间碰撞校验的真实基于 RRT 的三维路径规划器。
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — 经过多单元收敛属性测试的真实 CRDT LWW-Element-Map 状态同步。

*数字孪生与仿真*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — 面向数字孪生引擎的集成中枢，具备真实的版本兼容性同步契约。
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — 在仿真与真实硬件之间带有软件碰撞联锁的硬件在环路由器(未在真实硬件上测试)。
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
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — 带有触觉提醒模式与配对手机语音中继的 WearOS 伴侣应用(尚未在实体手表上运行)。
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — 面向板卡安装机架的固件，具备真实的工具 ID 解码与 Smart Idle 预热逻辑。
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — 面向热成像/RGB 检测工具头的固件及真实 Python 视觉伴侣程序。
- **[URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER)** — 桌面工具，用于检测、安装和更新 URTC 系列的仓库，每次只执行一项明确的操作。
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — 发现、克隆并更新本生态系统中每个仓库的管理类桌面工具。
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** —— 构建即刻可烧录、预装生态系统最新版本的 CM5 镜像的 Windows/Linux 桌面工具,具备类似 Raspberry Pi Imager 风格的首次启动 Wi-Fi/用户/SSH 配置。
- **[HYDRA-UMC-OPS-AGENT](https://github.com/JuanenRac/HYDRA-UMC-OPS-AGENT)** — 维护事件协调器：一个低权限的边缘角色采集经过脱敏的库存/健康快照，一个控制面角色以只读方式渲染它，并请求某个 AI 提供方给出诊断建议——从不应用补丁，也从不部署任何内容。
- **[HYDRA-UMC-DEV-SERVER](https://github.com/JuanenRac/HYDRA-UMC-DEV-SERVER)** — 可复现的开发主机（Raspberry Pi 5 / CM5），保存整个生态系统的源代码，并在持久队列下运行有界的构建/测试任务；这是专用的开发角色，明确区别于运行中的 CM5。

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
