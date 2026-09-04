<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

<p align="center">
  <a href="README.md">🇺🇸 English</a> |
  🇪🇸 <b>Español</b> |
  <a href="README_fra.md">🇫🇷 Français</a> |
  <a href="README_ita.md">🇮🇹 Italiano</a> |
  <a href="README_deu.md">🇩🇪 Deutsch</a> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  <a href="README_jpn.md">🇯🇵 日本語</a>
</p>


<p align="left">
  <img src="https://img.shields.io/badge/Licencia-GPL%203.0-blue.svg" alt="GPL 3.0">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>


Un compañero basado en navegador para el **Universal Robot Tool Controller (URTC)** -
una app de una sola página en React/Vite que habla con hardware URTC real a través de
un adaptador USB-CAN mediante la [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
usando el mismo framing SLCAN y el mismo protocolo CAN que las dos herramientas
compañeras de escritorio, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) y
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). El objetivo es la paridad de
funcionalidades con esas dos herramientas dentro de una sola pestaña del navegador, no
una demo simplificada de ellas - las pestañas Flasher Studio y Tester Studio envían y
reciben las tramas CAN reales descritas en `docs/CANBUS.TXT` del
[repositorio de firmware de URTC](https://github.com/JuanenRac/URTC).

---

## 🧭 Qué es real y qué es una sandbox

Esta app tiene dos tipos de pestañas:

- **Pestañas reales, dependientes de hardware** - Flasher Studio, Tester Studio, y el
  CAN Bus Protocol Analyzer. Estas solo hacen algo una vez que has conectado un
  adaptador USB-CAN real (botón de la cabecera arriba a la derecha); cada comando que
  envían y cada lectura que muestran proviene del bus CAN real. Esto incluye la
  **lectura real de la cámara térmica** - el panel "Thermal Inspection" de Tester
  Studio (`0x250`/`0x251`/`0x254`/`0x255`) consulta el array IR MLX90640 real del
  cabezal de herramienta por CAN.
- **Pestañas sandbox sin conexión** - Control (catálogo de herramientas), OLED,
  Specs/BOM, y Thermal IR Inspection. Estas te permiten explorar el catálogo de 25
  herramientas, previsualizar las pantallas de estado OLED, navegar el BOM/pinouts, y
  ver una alimentación de cámara térmica simulada, todo sin ningún hardware conectado.
  El interruptor "FW v0.0 / v0.1" de la cabecera solo afecta a estas pestañas sandbox
  (qué perfiles de herramienta desbloquearía un build de firmware dado) - no tiene
  ninguna relación con lo que reporta una placa real conectada.
  - **No confundas las dos vistas térmicas**: la pestaña independiente "Thermal IR
    Inspection" (`ThermalCameraViewer.tsx`) es ruido `Math.random()` 100% del lado
    del cliente, sin ningún tráfico CAN en absoluto - es una maqueta de interfaz, no
    una lectura de sensor. Los datos reales de MLX9064x solo aparecen dentro del
    panel "Thermal Inspection" de Tester Studio, y solo una vez que hay hardware
    conectado.

## 🔌 Hardware que necesitas

- Un adaptador USB-CAN ejecutando firmware **SLCAN** (p. ej. un CANable ejecutando
  `candlelight`/`slcan`, o cualquier adaptador que hable el protocolo serie SLCAN
  `lawicel` estándar) - la misma clase de adaptador que soportan ambas herramientas de
  escritorio a través de su propio transporte Serial.
- El bus configurado a **500 kbit/s** (esta app no autodetecta el bitrate de la forma
  en que lo hace el flag `--auto-detect` de las herramientas de escritorio; siempre
  abre a 500k).
- Un navegador con soporte de Web Serial - **Chrome o Edge**. Firefox y Safari no
  implementan Web Serial y no podrán conectar en absoluto.
- Web Serial requiere un contexto seguro (HTTPS) o `localhost` - y no se puede usar
  desde dentro de un iframe. Si estás previsualizando esta app dentro de un frame
  incrustado, ábrela primero en su propia pestaña.

## 🛡️ Validación de tramas CAN

Ambas direcciones del enlace SLCAN se validan antes de que nada llegue a la
UI o al cable (`src/hooks/useSerialCanBus.ts`):

- **Saliente** - `sendFrame()` se niega a serializar un comando cuyo
  identificador quede fuera del rango CAN estándar de 11 bits
  (`0x000`-`0x7FF`), cuyo payload supere los 8 bytes, o cuyo payload
  contenga un byte fuera de `0x00`-`0xFF`. La UI muestra "Refusing malformed
  CAN frame: ..." en vez de escribir texto inválido al puerto serie.
- **Entrante** - `processBuffer()` exige una coincidencia real
  `t<3 hex ID><1 hex DLC 0-8><payload hex>` antes de convertir una línea
  SLCAN recibida en un `CanFrame`; un DLC fuera de `0`-`8` o un payload más
  corto que su propia longitud declarada se registra en consola y se
  descarta en vez de entregarse a un panel de herramienta como un byte
  `NaN`. Una marca de tiempo opcional del adaptador al final sigue
  aceptándose después de un payload válido.

## ⚡ Flasher Studio - cobertura real de funcionalidades

Portado desde el propio `flasher_protocol.py` de `URTC-FLASHER`, contra los mismos
CAN ID:

- **Actualización CAN-OTA de la placa principal** (`0x7F0`-`0x7F7`): disparador de
  entrada al bootloader, firma HMAC-SHA256, transferencia paginada con control de
  flujo por ACK de página y reintento/backoff, CRC32 + END_UPDATE con versión
  declarada, y manejo de estado terminal (incluida la recuperación de una trama de
  confirmación perdida de la misma forma que la herramienta de escritorio - vuelve a
  consultar la versión en vez de reportar un fallo falso).
- **Actualización CAN-OTA del esclavo de expansión** (`0x210`-`0x219`, relevada a
  través del propio puente I2C de la placa principal) - mismo esquema de
  firma/CRC, sin ACK de página ni heartbeat en esta ruta (coincide con el protocolo
  real; el progreso se sondea, no se empuja).
- **Autorización de downgrade** (`0x7FD`) - una casilla protegida por confirmación
  que autoriza al intento actual a saltarse la comprobación anti-rollback del
  bootloader, para un revert deliberado a una versión más antigua.
- **Borrado de F-RAM antes de flashear** (`0x192`), opcional, solo placa principal.
- **Consulta del contador de errores CAN** (`0x7FB`/`0x7FC`, TEC/REC leídos
  directamente de los propios registros de error del controlador CAN) - distingue un
  problema genuino de bus de uno del lado de la aplicación/bootloader.
- **Relectura/respaldo de firmware por CAN** (`0x7FE`/`0x7FF`) - lee el contenido
  actual del slot principal antes de que lo sobrescribas, a un ritmo de 2KB/página
  con ACKs del host, y lo guarda como una descarga `.bin`.
- **Consulta de versión de placa en vivo** (`0x7F8`/`0x7F9`/`0x7FA`) - muestra el
  respondedor real (app o bootloader), HardwareID, y versión, no un interruptor
  simulado.
- **Soporte de sidecar `<file>.manifest.json`** - al flashear un archivo que vino del
  listado de firmware de GitHub (o de la carpeta local `public/firmware/`), la
  versión declarada de un manifest coincidente tiene prioridad al reportar qué se
  está instalando, y su `sha256` (si está presente) se comprueba como una advertencia
  de cordura temprana y no bloqueante - mismo comportamiento que el
  `_check_manifest` de la herramienta de escritorio.
- **Configuración de placa**: tipo de placa de expansión / variante de sensor
  MLX9064x / configuración de herramienta libre (pines ID `11111`) / información de
  periféricos y número de serie - `0x1A0`-`0x1A7`.

### SWD/JTAG - no disponible desde un navegador, por diseño

No existe ninguna API web capaz de manejar una sonda de depuración SWD/JTAG - Web
Serial solo habla con dispositivos de framing serie (como un adaptador USB-CAN), no
con el protocolo propio de una sonda, y STM32CubeProgrammer/pyOCD son subprocesos
nativos que la herramienta de escritorio invoca. Esto es una limitación estructural
de ejecutarse en una sandbox de navegador, no una funcionalidad que falte aquí. La
pestaña SWD/JTAG de Flasher Studio explica los comandos exactos que la herramienta
de escritorio `URTC Flasher` ejecutaría localmente, como referencia - usa esa
herramienta directamente para programación de chip completo, comprobaciones de
option-byte/RDP, o un respaldo de flash completo antes de un borrado masivo.

## 🧰 Tester Studio - cobertura real de funcionalidades

Portado desde los propios `tester_tool_panels.py` /
`tester_common_panels.py` de `URTC-TESTER`, contra los mismos CAN ID:

- Un panel por herramienta (soldador + alimentador de hilo, herramientas de
  movimiento de motor paso a paso compartidas, recogida por vacío, taladro, AOI,
  láser, calentador/movimiento/ventiladores de impresora 3D, sonda de escaneo,
  electroimán, soldador de punto/ultrasonidos, sonda voladora incl. la ruta
  avanzada ADS1115, curado UV, retrabajo con aire caliente, engarzado, inspección
  térmica, dispensado de pasta), cada uno enviando los bytes de comando reales de
  la herramienta y decodificando su telemetría real.
- **Casilla activa + keepalive** para toda herramienta con un watchdog de
  comunicación del lado del firmware (soldador, láser, curado UV, retrabajo con
  aire caliente, boquilla de impresora 3D - reenvío cada 150ms bajo un watchdog de
  250ms; ventilador de capa de impresora 3D - reenvío cada 400ms bajo su propio
  watchdog de 1000ms), coincidiendo exactamente con el timing propio de la
  herramienta de escritorio.
- **Global Controls** (`0x100`), passthrough SPI de **Expansion Board** + consulta
  TMC DIAG0 (`0x180`-`0x183`), consulta/borrado de **F-RAM** (`0x190`-`0x192`),
  **Self-Test** (comprobaciones seguras, en reposo, por herramienta), un
  **Raw Bus Monitor** con exportación de traza `.trc`/`.asc`, y un inyector de
  **Custom Frame** con un intervalo de repetición opcional - validado de la misma
  forma que el propio inyector de tramas del CAN Bus Protocol Analyzer: el ID se
  enmascara al rango estándar CAN de 11 bits, y los tokens de datos se filtran a
  bytes hexadecimales válidos antes de limitarse al máximo de 8 bytes del payload
  CAN.
- **Detect Hardware** consulta la herramienta activa real (`0x110`/`0x111`) y la
  versión de placa (`0x7F8`/`0x7F9`), y un error crítico declarado (`0x111` byte 1)
  aparece como un banner de fallo en vivo.

## 🔐 Nota de seguridad: la clave de firma OTA

Al igual que el `URTC Flasher` de escritorio, esta app se distribuye con la clave de
firma HMAC-SHA256 por defecto del proyecto commiteada en el código fuente
(`src/lib/flasher.ts`) - la propia clave anti-manipulación del bootloader que
determina si se acepta una actualización CAN-OTA. Esto es una coincidencia
intencional con la propia convención de la herramienta de escritorio (el `HMAC_KEY`
de `flasher_config.py`, a su vez sobreescribible mediante una configuración local no
commiteada), no un descuido. Viene con una advertencia específica de ejecutarse como
**app web**: a diferencia de un ejecutable de escritorio descargado, cualquiera que
cargue esta página puede leer la clave directamente del bundle JS distribuido - no
hay forma de que una app estática del lado del cliente mantenga un secreto de firma
privado frente a sus propios visitantes. Si rotas la clave de firma real para un
despliegue de producción, despliega esta app solo en algún sitio cuyo acceso
controles (una red interna, VPN, o host con acceso restringido), o trátalo de la
misma forma en que tratarías la entrega de la propia herramienta Flasher de
escritorio - a técnicos autorizados, no a la internet pública.

## 🚀 Primeros pasos

### Requisitos previos
- Node.js (v18+)
- npm

### Instalación

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### Modo desarrollo

Ejecuta la app con el servidor de desarrollo de Vite y recarga en vivo:
- **Windows:** doble clic en `dev.bat` o ejecuta `npm run dev`
- **Linux/Mac:** ejecuta `./dev.sh` o `npm run dev`

Luego abre `http://localhost:3000` en Chrome o Edge.

### Build de producción

Compila en un bundle estático y optimizado en `dist/`:
- **Windows:** doble clic en `build.bat` o ejecuta `npm run build`
- **Linux/Mac:** ejecuta `./build.sh` o `npm run build`

Este es un sitio estático plano - no hay ningún componente de servidor incluido (a
diferencia del propio `server.ts` de `HYDRA-UMC STUDIO`). Previsualiza la carpeta
`dist/` compilada localmente con:

```bash
npm run preview
```

o sirve `dist/` con cualquier host de archivos estáticos de tu elección. `npm run
lint` ejecuta el compilador de TypeScript en modo de solo comprobación.

### Versionado

El `version` de `package.json` (y el `version` correspondiente en
`hydra-umc.project.json`) sube automáticamente en cada `build.bat`/
`build.sh` real - `bump_manifest_version.py` corre como paso 1, antes de
`npm install && npm run build`, lee la versión actual directamente de
`package.json`, la incrementa, la reescribe, sincroniza el manifest, y añade
una entrada mínima al CHANGELOG si esa versión todavía no tiene una. `npm
run build` (`vite build`) por sí solo es deliberadamente solo-compilación y
nunca toca la versión - `scripts/bump-version.mjs` hacía este trabajo en un
diseño anterior con un hook `prebuild`, pero ese script hoy es legado, se
mantiene solo como referencia (ver su propio comentario de cabecera);
`npm run dev`/`lint`/`preview` tampoco tocan la versión nunca. Esto no es
Semantic Versioning: es un cuentakilómetros en base 10. El dígito de patch
sube en 1; cuando pasaría de 9, se resetea a 0 y el dígito de minor sube en
su lugar (`0.1.9` -> `0.2.0`, nunca `0.1.10`); el mismo acarreo se propaga de
minor a major. Ver `CHANGELOG.md` para el historial de versiones y un
resumen del trabajo anterior en este proyecto.

## 📖 Más documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — cómo la UI, la
  configuración persistida y la autoridad del transporte externo se
  mantienen separadas, y por qué las pestañas sandbox deben exponer
  estados offline/no disponible en vez de presentar datos simulados como
  reales.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — el camino de
  validación no mutante `build-test.bat`/`.sh` (TypeScript + tests, sin
  cambios de versión ni CHANGELOG), `dev.bat`/`.sh` para desarrollo local,
  y por qué el material de firma OTA nunca pertenece a la configuración
  del navegador.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — qué debe
  hacer este cliente ante un esquema desconocido, una identidad de destino
  ausente o un resultado de API malformado, y por qué la autoridad real de
  flasheo se mantiene en el servidor o en las herramientas de escritorio
  dedicadas.

## 🛠️ Stack tecnológico
- **Lenguaje:** TypeScript
- **Framework de frontend:** React 18
- **Herramienta de build:** Vite
- **Estilos:** Tailwind CSS
- **Iconos:** Lucide React
- **CRC32:** `crc-32` - comprobación de integridad de la imagen de firmware, refleja
  el propio cálculo de CRC32 del bootloader
- **Transporte de hardware:** Web Serial API + framing SLCAN (sin dependencias
  nativas, sin servidor backend compañero)

## 📂 Estructura del repositorio

```
/
├── src/
│   ├── App.tsx                     Componente raiz - estado de pestanas, estado
│   │                                de hardware, registro de tramas CAN, y los
│   │                                manejadores conectados a cada pestana de abajo
│   │                                (incluyendo el inicio/relectura de CAN OTA y
│   │                                el propio inyector de tramas del CAN Bus
│   │                                Analyzer)
│   ├── main.tsx                    Punto de entrada de Vite/React
│   ├── i18n.ts                     Configuracion de i18next - en/es/de/fr/it/zh/ja,
│   │                                persistido en localStorage
│   ├── index.css                   Punto de entrada de Tailwind
│   ├── types.ts                    Tipos TypeScript compartidos (CanFrame,
│   │                                HardwareState, FlasherState,
│   │                                ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Declaraciones de tipos ambientales propias de
│   │                                Vite
│   ├── components/
│   │   ├── Header.tsx               Barra superior: boton conectar/desconectar,
│   │   │                            nombre de herramienta activa, interruptor
│   │   │                            sandbox FW v0.0/v0.1
│   │   ├── Sidebar.tsx              Navegacion izquierda - las 7 pestanas
│   │   │                            descritas en este README
│   │   ├── ToolCatalog.tsx          Pestana sandbox: el catalogo de 25
│   │   │                            herramientas, seleccion de herramienta,
│   │   │                            control de setpoint
│   │   ├── OledDisplay.tsx          Pestana sandbox: previsualizacion de
│   │   │                            pantallas de estado OLED
│   │   ├── SpecsAndBomViewer.tsx    Pestana sandbox: navegador de BOM/pinouts
│   │   ├── ThermalCameraViewer.tsx  Pestana sandbox: feed simulado de MLX90640 -
│   │   │                            100% Math.random(), sin ningun trafico CAN
│   │   │                            (ver "Que es real y que es una sandbox"
│   │   │                            arriba)
│   │   ├── HardwarePanel.tsx        Panel sandbox de control de jumpers/LED/placa
│   │   │                            de expansion, usado dentro de las pestanas
│   │   │                            Control y OLED
│   │   ├── CanBusAnalyzer.tsx       Pestana real: registro de tramas CAN en
│   │   │                            bruto, inyector de trama personalizada,
│   │   │                            disparadores de comando predefinidos
│   │   ├── FlasherStudio.tsx        Pestana real: interfaz CAN-OTA (principal +
│   │   │                            esclavo de expansion) y el explicador de
│   │   │                            capacidad SWD/JTAG
│   │   ├── TesterStudio.tsx         Pestana real: control/telemetria en vivo por
│   │   │                            herramienta, construida desde la carpeta
│   │   │                            tester/ de abajo
│   │   └── tester/
│   │       ├── ToolPanels.tsx       Un panel por perfil de herramienta - bytes de
│   │       │                        comando reales, decodificacion de telemetria
│   │       │                        real, keepalive de watchdog por herramienta
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor, inyector de
│   │       │                        Custom Frame
│   │       └── shared.tsx           Primitivas de UI compartidas (Section,
│   │                                Field, clases de boton/input, safeInt)
│   ├── data/
│   │   └── toolsData.ts             Los 25 TOOL_PROFILES - nombres, valores por
│   │                                defecto, iconos para las pestanas sandbox
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Transporte Web Serial + SLCAN -
│   │   │                            conectar/desconectar, TX/RX de tramas,
│   │   │                            waitForFrame por ID con un buffer rx
│   │   │                            acotado y un limite de cola de 500 tramas
│   │   ├── useFlasher.ts            Maquina de estados de CAN-OTA (placa
│   │   │                            principal + esclavo de expansion), refleja
│   │   │                            flasher_protocol.py
│   │   └── useKeepalive.ts          Hook de reenvio a intervalo fijo que
│   │                                respalda el keepalive de watchdog de la
│   │                                casilla activa de cada herramienta
│   ├── lib/
│   │   ├── flasher.ts               Constantes del protocolo OTA, la clave de
│   │   │                            firma HMAC-SHA256 commiteada, helpers de
│   │   │                            CRC32/HMAC, parseo de manifest
│   │   └── canIds.ts                Constantes de CAN ID para Tester Studio -
│   │                                 refleja tester_config.py byte a byte
│   └── locales/                     Cadenas de UI - en.json, es.json, de.json,
│                                     fr.json, it.json, ja.json, zh.json
├── scripts/
│   └── bump-version.mjs             Script de subida de version sin dependencias;
│                                     hoy es legado, se mantiene solo como referencia
│                                     - reemplazado por bump_manifest_version.py (ver "Versionado")
├── public/
│   └── firmware/                    .bin/.elf/.hex incluidos para la aplicacion
│                                     principal, el bootloader principal, la
│                                     aplicacion del esclavo de expansion, y el
│                                     bootloader del esclavo de expansion
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   Banner de logo completo (mostrado arriba en
│                                     este README)
│   ├── URTC_APP_ICON_NEW.svg        Icono de la app
│   ├── urtc_custom_icon.svg         Icono de la app, mismo artwork
│   └── urtc_icon.ico                Favicon
├── index.html                       HTML de entrada de Vite
├── metadata.json                    Nombre/descripcion de la app + permiso
│                                     "serial" solicitado (usado por la
│                                     plataforma de hosting)
├── vite.config.ts                   Configuracion de Vite + plugin de Tailwind
├── tsconfig.json                    Configuracion de TypeScript
├── .env.example                     VITE_APP_TITLE
├── dev.bat / dev.sh                 Instala dependencias + inicia el servidor de
│                                     desarrollo de Vite
├── build.bat / build.sh             Instala dependencias + produce el build
│                                     estatico de dist/
├── tools/
│   └── ci_validate.py               Validación de manifest/CHANGELOG/docs usada por la CI
├── bump_manifest_version.py         Subida de versión real en cada build (package.json + manifest, ver "Versionado"); el modo `--sync` también existe para aceptar un incremento nativo previo
├── package.json
├── CHANGELOG.md                     Historial de versiones y resumen del trabajo pasado
├── LICENSE
├── README.md                        Este archivo
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- traducciones
```

## 📜 LICENCIA

URTC Web Studio es (c) 2026 JuanenRac (Electro Hobby 3D). Este aviso debe incluirse
en cualquier distribución de este proyecto o trabajos derivados.

Este proyecto consiste en código fuente y su propia documentación, disponibles bajo
licencias distintas - cada una adecuada a lo que realmente cubre:

1. El código fuente (todo lo que está bajo `src/`, más la configuración de
   Vite/TypeScript que lo compila) está disponible bajo la **GNU General Public
   License v3.0 (GPL-3.0)**. Texto completo en
   https://www.gnu.org/licenses/gpl-3.0.html.

2. La documentación (este README y sus propias traducciones - `README_spa.md`,
   `README_ita.md`, `README_fra.md`, `README_deu.md`, `README_zho.md`,
   `README_jpn.md`) está disponible bajo
   **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
   Texto completo en https://creativecommons.org/licenses/by-sa/4.0/.

Esta herramienta es el compañero basado en navegador del proyecto
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC) - ver el
propio repositorio de ese proyecto para el firmware de la placa, los diseños de
hardware, y la documentación completa del protocolo contra la que trabaja esta
herramienta. El propio firmware de URTC es GPL-3.0 y sus diseños de hardware son
CERN-OHL-S v2; la propia licencia de esta herramienta aquí no se extiende a ese
proyecto separado, y viceversa. También existen 2 alternativas nativas de
escritorio que cubren el mismo terreno:
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) y
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Si construyes sobre este proyecto, ten en cuenta la separación de licencias: los
cambios de código deberían mantenerse GPL-3.0, los derivados de documentación
deberían mantenerse CC BY-SA - cada uno con atribución de vuelta a este proyecto y
su autor.

## 🔗 Proyectos Relacionados

Este proyecto es parte del ecosistema de robótica HYDRA-UMC del mismo autor (JuanenRac / Electro Hobby 3D). Vale la pena conocerlo, ya que una petición podría en realidad ser sobre alguno de estos en vez de sobre este repositorio.

**Proyecto Padre**
- **[URTC](https://github.com/JuanenRac/URTC)** — firmware para la placa física del Universal Robot Tool Controller, más de 25 perfiles de herramienta por bus CAN; el padre del que este repositorio es una herramienta específica, dentro de su propia familia de herramientas CAN-bus.

**Proyectos Hermanos** — las demás herramientas de la propia familia de herramientas CAN-bus de URTC
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — herramienta de escritorio con GUI para flashear placas URTC, CAN-OTA más SWD/JTAG de chip completo — mismo protocolo SLCAN/CAN que esta app basada en navegador, que es la alternativa sin instalación a esta herramienta.
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — herramienta de escritorio de diagnóstico CAN-bus en vivo para placas URTC, un panel por perfil de herramienta — mismo protocolo SLCAN/CAN que esta app basada en navegador, que es la alternativa sin instalación a esta herramienta.

**Directamente Relacionados**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — CLI de flota con un contrato real y estable de códigos de salida, cliente real y en vivo de la propia API de HYDRA-UMC-SERVER — una alternativa de terminal/línea de comandos a esta herramienta basada en navegador.

**También Forma Parte del Ecosistema**

*Hardware y Plataforma Base*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — la placa madre física del brazo robótico: host CM5 + coprocesador STM32H745 de doble núcleo, coordinando hasta 8 brazos herramienta por CAN-OTA/SPI-OTA.
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — capa de producto reproducible sobre Raspberry Pi OS para el CM5: agente de solo lectura, config/perfiles validados, aprovisionamiento WiFi de primer contacto.
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — el contrato JSON-Schema compartido y la barrera de seguridad contra la que cada bridge valida sus comandos.

*Backend Central y Clientes*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — el backend headless real (REST/WebSocket) con el que habla de verdad cada cliente de control.
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — panel de control web con visualización 3D multi-robot en tiempo real.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — centro de mando de enjambre de escritorio (PySide6) para varios servidores a la vez, empaquetado como ejecutable independiente.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — app nativa de control para Android con inicio de sesión biométrico y un compañero Wear OS emparejado.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — app de control para iOS/iPadOS (Flutter) con sincronización en tiempo real por WebSocket.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — interfaz táctil nativa para la pantalla táctil DSI de 7" a bordo, embebida en el propio CM5.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — creador/editor gráfico de URDF de escritorio que envía los modelos terminados al propio catálogo de STUDIO.
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — barrera de coordinación para flotas AGV/AMR mediante un publicador MQTT VDA 5050 real.
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — coordinador de alto nivel para celdas CNC con acceso real a estado/bytes de control GRBL.
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — barrera de coordinación para droides con patas/humanoides, con un emisor de comandos real para Boston Dynamics Spot.
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — coordinador de seguridad para celdas láser que lee 3 salvaguardas GPIO reales de llave/carcasa/enclavamiento.
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — coordinador de alto nivel seguro para el flujo de placas de pick-and-place OpenPnP.
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — barrera de coordinación segura para impresoras 3D Moonraker/Klipper, con comandos de trabajo reales y controlados.
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — coordinador de seguridad con un transporte ROS 2 rclpy real, importado de forma perezosa.
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — barrera de coordinación para UAV equipados con cámara, con un emisor de comandos MAVLink real.

*Nodo IA de Visión (Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — nodo de integración para el pipeline de visión Hailo-8, con una comprobación real de disponibilidad de hardware por etapa.
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — registro real de modelos compilados con verificación de carga segura por arquitectura Hailo/checksum.
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — generador real de pipeline GStreamer + config MediaMTX, con una frontera de integración HailoRT real.
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — ley de corrección real de Position-Based Visual Servoing, con puerta de seguridad según el estado de zona previo.
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — comprobación real de invasión de zona y solicitud de E-STOP, con exigencia de vigencia de calibración.

*Nodo IA Cognitivo (Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — nodo de integración para el pipeline cognitivo Hailo-10 (orquestación de LLM/VLA/voz).
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — codificación/decodificación real de tokens de acción y generación de trayectoria para un modelo Vision-Language-Action.
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — front-end de voz real (VAD + analizador de intención) con un relé a Watch acotado y con confirmación.
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — descomposición real de tareas basada en reglas y recuperación semántica de errores sobre códigos de error del MCU.
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — búsqueda real de documentos TF-IDF (solo librería estándar) sobre los propios documentos Markdown de este ecosistema.

*Orquestación y Enjambre*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — nodo de integración con un contrato real de informe de salud gRPC/Protobuf y una máquina de estados de misión.
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — cola de trabajos real basada en prioridad con deduplicación, sobre una API HTTP real.
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — watchdog de salud de flota real basado en gRPC, con reintento/backoff y detección de discrepancia de identidad.
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — planificador de rutas 3D real basado en RRT, con validación real de colisión de obstáculos/espacio de trabajo.
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — sincronización de estado real mediante CRDT LWW-Element-Map, con pruebas de propiedades para convergencia multi-celda.

*Gemelo Digital y Simulación*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — nodo de integración para el motor de gemelo digital, con un contrato real de sincronización por compatibilidad de versión.
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — enclavamiento de seguridad real hardware-in-the-loop que enruta comandos entre simulación y hardware real.
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — cinemática directa real y validación de límites articulares sobre un subconjunto real de URDF.
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — generador real de escenas 2D procedurales con exportación de anotaciones YOLO/COCO.

*Datos y Analítica*
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — almacén de series temporales real respaldado por sqlite3, con una API HTTP real de ingesta/consulta.
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — detector de anomalías real basado en FFT + línea base estadística, con monitorización de deriva.
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — cálculo real de OEE/disponibilidad sobre el histórico de DATALAKE, con exportación CSV reproducible.
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — pipeline real de ingesta CAN/WebSocket hacia DATALAKE, con deduplicación por secuencia.

*Pasarela Industrial*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — nodo de integración que retransmite a protocolos industriales, con una capa real de lista blanca de comandos/contrapresión.
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — espacio de direcciones OPC-UA real, verificado con una sesión de cliente real del protocolo binario.
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — broker MQTT real con autenticación por cliente opcional y ACL de tópicos.
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — endpoints XML reales `/probe` y `/current` de MTConnect, con salida en modo degradado.

*Herramientas Complementarias y Operaciones del Ecosistema*
- **[HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)** — paneles de Resúmenes Inteligentes y Resaltado de Anomalías sobre DATALAKE/ANOMALY-DETECTOR, con un respaldo estadístico honesto.
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — app compañera de WearOS con alertas hápticas reales y un relé de voz al teléfono emparejado.
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — firmware para un rack de montaje de placas con decodificación real de ID de herramienta y lógica de precalentamiento Smart Idle.
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — firmware más un compañero de visión real en Python para un cabezal de inspección térmica/RGB.
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — herramienta administrativa de escritorio que descubre, clona y actualiza cada repositorio de este ecosistema.
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** — herramienta de escritorio Windows/Linux que construye una imagen de la CM5 lista para grabar, precargada con las versiones más actuales del ecosistema, con configuración de primer arranque de Wi-Fi/usuario/SSH al estilo de Raspberry Pi Imager.

---

## 📚 Documentación y Comunidad

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — stack tecnológico y pautas de codificación para un pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — los estándares de comportamiento esperados en esta comunidad.
- **[SECURITY.md](SECURITY.md)** — cómo reportar una vulnerabilidad, y las áreas reales de enfoque en seguridad de este proyecto.
- **[SUPPORT.md](SUPPORT.md)** — dónde hacer preguntas y reportar errores.
- **[LICENSE.md](LICENSE.md)** — la licencia propia de este proyecto.

## 👤 AUTOR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
