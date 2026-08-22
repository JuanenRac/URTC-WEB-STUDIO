<p align="center">
  <img src="images/URTC_LOGO_WEB_STUDIO.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

Ein browserbasierter Begleiter für den **Universal Robot Tool Controller (URTC)** -
eine React/Vite-Single-Page-App, die mit echter URTC-Hardware über einen
USB-CAN-Adapter via der [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
spricht, wobei dasselbe SLCAN-Framing und CAN-Protokoll wie bei den beiden
Desktop-Begleit-Tools verwendet wird, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) und
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). Das Ziel ist
Funktionsparität mit diesen beiden Tools innerhalb eines einzigen Browser-Tabs,
keine vereinfachte Demo davon - die Tabs Flasher Studio und Tester Studio senden
und empfangen die echten CAN-Frames, die in `docs/CANBUS.TXT` des
[URTC-Firmware-Repositorys](https://github.com/JuanenRac/URTC) beschrieben sind.

---

## 🧭 Was echt ist vs. was eine Sandbox ist

Diese App hat zwei Arten von Tabs:

- **Echte, hardwaregesteuerte Tabs** - Flasher Studio, Tester Studio, und der CAN
  Bus Protocol Analyzer. Diese tun erst etwas, sobald Sie einen echten
  USB-CAN-Adapter angeschlossen haben (Schaltfläche oben rechts in der
  Kopfzeile); jeder Befehl, den sie senden, und jede Anzeige, die sie zeigen,
  kommt vom tatsächlichen CAN-Bus. Dies schließt die **echte
  Wärmebildkamera-Ablesung** ein - das Panel „Thermal Inspection" von Tester
  Studio (`0x250`/`0x251`/`0x254`/`0x255`) fragt das tatsächliche MLX90640-IR-Array
  des Werkzeugkopfs über CAN ab.
- **Offline-Sandbox-Tabs** - Control (Werkzeugkatalog), OLED, Specs/BOM, und
  Thermal IR Inspection. Diese lassen Sie den Katalog von 25 Werkzeugen
  erkunden, die OLED-Statusbildschirme in der Vorschau ansehen, das
  BOM/Pinouts durchsuchen, und einen simulierten Wärmebildkamera-Feed
  betrachten, alles ohne angeschlossene Hardware. Der Umschalter „FW v1.0 /
  v1.1" in der Kopfzeile beeinflusst nur diese Sandbox-Tabs (welche
  Werkzeugprofile ein gegebener Firmware-Build freischalten würde) - er hat
  keinen Bezug zu dem, was eine echte, angeschlossene Platine meldet.
  - **Verwechseln Sie nicht die beiden thermischen Ansichten**: der
    eigenständige Tab „Thermal IR Inspection" (`ThermalCameraViewer.tsx`) ist
    zu 100% clientseitiges `Math.random()`-Rauschen ohne jeglichen
    CAN-Verkehr - es ist ein UI-Mockup, keine Sensorablesung. Die echten
    MLX9064x-Daten erscheinen nur innerhalb des Panels „Thermal Inspection"
    von Tester Studio, und nur sobald Hardware angeschlossen ist.

## 🔌 Benötigte Hardware

- Ein USB-CAN-Adapter mit **SLCAN**-Firmware (z. B. ein CANable mit
  `candlelight`/`slcan`, oder jeder Adapter, der das standardmäßige serielle
  SLCAN-Protokoll `lawicel` spricht) - dieselbe Adapterklasse, die beide
  Desktop-Tools über ihren eigenen seriellen Transport unterstützen.
- Der Bus auf **500 kbit/s** eingestellt (diese App erkennt die Bitrate nicht
  automatisch, so wie es das Flag `--auto-detect` der Desktop-Tools tut; sie
  öffnet immer mit 500k).
- Ein Browser mit Web-Serial-Unterstützung - **Chrome oder Edge**. Firefox und
  Safari implementieren Web Serial nicht und können sich überhaupt nicht
  verbinden.
- Web Serial erfordert entweder einen sicheren Kontext (HTTPS) oder
  `localhost` - und kann nicht aus einem iframe heraus verwendet werden. Wenn
  Sie diese App innerhalb eines eingebetteten Frames in der Vorschau
  betrachten, öffnen Sie sie zuerst in ihrem eigenen Tab.

## ⚡ Flasher Studio - echte Funktionsabdeckung

Portiert aus dem eigenen `flasher_protocol.py` von `URTC-FLASHER`, gegen
dieselben CAN-IDs:

- **CAN-OTA-Update der Hauptplatine** (`0x7F0`-`0x7F7`): Bootloader-Eintritts-
  Trigger, HMAC-SHA256-Signierung, seitenweise Übertragung mit
  Seiten-ACK-Flusssteuerung und Retry/Backoff, CRC32 + END_UPDATE mit
  deklarierter Version, und Behandlung des Endstatus (einschließlich der
  Wiederherstellung von einem verlorenen Bestätigungs-Frame auf dieselbe
  Weise wie das Desktop-Tool - es fragt die Version erneut ab, statt einen
  falschen Fehlschlag zu melden).
- **CAN-OTA-Update des Erweiterungs-Slaves** (`0x210`-`0x219`, weitergeleitet
  über die eigene I2C-Bridge der Hauptplatine) - dasselbe Signier-/CRC-Schema,
  kein Seiten-ACK oder Heartbeat auf diesem Pfad (entspricht dem echten
  Protokoll; der Fortschritt wird abgefragt, nicht gepusht).
- **Downgrade-Autorisierung** (`0x7FD`) - eine bestätigungsgeschützte
  Checkbox, die den aktuellen Versuch autorisiert, die
  Anti-Rollback-Prüfung des Bootloaders zu umgehen, für eine gezielte
  Rückkehr zu einer älteren Version.
- **F-RAM-Löschung vor dem Flashen** (`0x192`), optional, nur Hauptplatine.
- **CAN-Fehlerzähler-Abfrage** (`0x7FB`/`0x7FC`, TEC/REC direkt aus den
  eigenen Fehlerregistern des CAN-Controllers gelesen) - unterscheidet ein
  echtes Busproblem von einem Problem auf Anwendungs-/Bootloader-Seite.
- **Firmware-Rücklesung/Backup über CAN** (`0x7FE`/`0x7FF`) - liest den
  aktuellen Inhalt des Hauptslots zurück, bevor Sie ihn überschreiben, im
  Takt von 2KB/Seite mit Host-ACKs, und speichert ihn als `.bin`-Download.
- **Live-Abfrage der Platinenversion** (`0x7F8`/`0x7F9`/`0x7FA`) - zeigt den
  echten Antwortenden (Anwendung oder Bootloader), die HardwareID, und die
  Version, kein simulierter Umschalter.
- **`<file>.manifest.json`-Sidecar-Unterstützung** - beim Flashen einer
  Datei, die aus der GitHub-Firmware-Liste (oder dem lokalen Ordner
  `public/firmware/`) stammt, hat die deklarierte Version eines passenden
  Manifests Priorität bei der Meldung dessen, was installiert wird, und ihr
  `sha256` (falls vorhanden) wird als frühe, nicht blockierende
  Plausibilitätswarnung geprüft - dasselbe Verhalten wie das
  `_check_manifest` des Desktop-Tools.
- **Platinenkonfiguration**: Erweiterungsplatinentyp / MLX9064x-Sensorvariante
  / freie Werkzeugkonfiguration (ID-Pins `11111`) / Peripherie-Infos &
  Seriennummer - `0x1A0`-`0x1A7`.

### SWD/JTAG - von einem Browser aus per Design nicht verfügbar

Es gibt keine Web-API, die eine SWD/JTAG-Debug-Sonde steuern kann - Web
Serial spricht nur mit seriell geframten Geräten (wie einem
USB-CAN-Adapter), nicht mit dem eigenen Protokoll einer Sonde, und
STM32CubeProgrammer/pyOCD sind native Subprozesse, die das Desktop-Tool
aufruft. Dies ist eine strukturelle Einschränkung der Ausführung in einer
Browser-Sandbox, keine hier fehlende Funktion. Der SWD/JTAG-Tab in Flasher
Studio erklärt die genauen Befehle, die das Desktop-Tool `URTC Flasher`
lokal ausführen würde, zur Referenz - verwenden Sie dieses Tool direkt für
die Programmierung des kompletten Chips, Option-Byte/RDP-Prüfungen, oder
ein vollständiges Flash-Backup vor einer Massenlöschung.

## 🧰 Tester Studio - echte Funktionsabdeckung

Portiert aus den eigenen `tester_tool_panels.py` /
`tester_common_panels.py` von `URTC-TESTER`, gegen dieselben CAN-IDs:

- Ein Panel pro Werkzeug (Lötkolben + Drahtzuführung, gemeinsame
  einfache Schrittmotor-Bewegungswerkzeuge, Vakuum-Pickup, Bohrer, AOI,
  Laser, 3D-Drucker-Heizung/Bewegung/Lüfter, Scan-Sonde, Elektromagnet,
  Punkt-/Ultraschallschweißgerät, fliegende Sonde inkl. des erweiterten
  ADS1115-Pfads, UV-Härtung, Heißluft-Rework, Crimpen, thermische Inspektion,
  Pastendosierung), jedes sendet die echten Befehlsbytes des Werkzeugs und
  dekodiert seine echte Telemetrie.
- **Aktiv-Checkbox + Keepalive** für jedes Werkzeug mit einem
  firmwareseitigen Kommunikations-Watchdog (Lötkolben, Laser, UV-Härtung,
  Heißluft-Rework, 3D-Drucker-Düse - erneutes Senden alle 150ms unter einem
  250ms-Watchdog; 3D-Drucker-Schichtlüfter - erneutes Senden alle 400ms
  unter seinem eigenen 1000ms-Watchdog), was genau dem eigenen Timing des
  Desktop-Tools entspricht.
- **Global Controls** (`0x100`), SPI-Durchleitung von **Expansion Board** +
  TMC-DIAG0-Abfrage (`0x180`-`0x183`), **F-RAM**-Abfrage/Löschung
  (`0x190`-`0x192`), **Self-Test** (sichere Prüfungen im Ruhezustand pro
  Werkzeug), ein **Raw Bus Monitor** mit `.trc`/`.asc`-Trace-Export, und ein
  **Custom Frame**-Injektor mit optionalem Wiederholungsintervall -
  validiert auf dieselbe Weise wie der eigene Frame-Injektor des CAN Bus
  Protocol Analyzer: die ID wird auf den 11-Bit-CAN-Standardbereich
  maskiert, und Datentoken werden auf gültige Hex-Bytes gefiltert, bevor
  sie auf das 8-Byte-CAN-Payload-Limit begrenzt werden.
- **Detect Hardware** fragt das echte aktive Werkzeug (`0x110`/`0x111`) und
  die Platinenversion (`0x7F8`/`0x7F9`) ab, und ein deklarierter kritischer
  Fehler (`0x111` Byte 1) erscheint als Live-Fehlerbanner.

## 🔐 Sicherheitshinweis: der OTA-Signierschlüssel

Wie der Desktop-`URTC Flasher` wird diese App mit dem im Quellcode
committeten Standard-HMAC-SHA256-Signierschlüssel des Projekts ausgeliefert
(`src/lib/flasher.ts`) - dem eigenen Anti-Manipulations-Schlüssel des
Bootloaders, der bestimmt, ob ein CAN-OTA-Update akzeptiert wird. Das ist
eine beabsichtigte Übereinstimmung mit der eigenen Konvention des
Desktop-Tools (dem `HMAC_KEY` von `flasher_config.py`, selbst über eine
lokale, nicht committete Konfiguration überschreibbar), kein Versehen. Es
kommt mit einem Vorbehalt, der spezifisch für die Ausführung als **Web-App**
ist: anders als bei einer heruntergeladenen Desktop-ausführbaren Datei kann
jeder, der diese Seite lädt, den Schlüssel direkt aus dem ausgelieferten
JS-Bundle lesen - es gibt für eine statische clientseitige App keine
Möglichkeit, ein Signiergeheimnis vor ihren eigenen Besuchern privat zu
halten. Wenn Sie den echten Signierschlüssel für ein
Produktions-Deployment rotieren, stellen Sie diese App nur irgendwo bereit,
wo Sie den Zugriff kontrollieren (ein internes Netzwerk, VPN, oder ein Host
mit zugangsbeschränktem Zugriff), oder behandeln Sie es genauso, wie Sie
die Weitergabe des Desktop-Flasher-Tools selbst behandeln würden - an
autorisierte Techniker, nicht an das öffentliche Internet.

## 🚀 Erste Schritte

### Voraussetzungen
- Node.js (v18+)
- npm

### Installation

```bash
git clone https://github.com/JuanenRac/URTC-Web-Studio.git
cd URTC-Web-Studio
npm install
```

### Entwicklungsmodus

Führt die App mit dem Dev-Server von Vite und Live-Reloading aus:
- **Windows:** Doppelklick auf `dev.bat` oder `npm run dev` ausführen
- **Linux/Mac:** `./dev.sh` oder `npm run dev` ausführen

Öffnen Sie dann `http://localhost:3000` in Chrome oder Edge.

### Produktions-Build

Kompiliert zu einem statischen, optimierten Bundle in `dist/`:
- **Windows:** Doppelklick auf `build.bat` oder `npm run build` ausführen
- **Linux/Mac:** `./build.sh` oder `npm run build` ausführen

Dies ist eine reine statische Website - es gibt keine gebündelte
Serverkomponente (anders als das eigene `server.ts` von
`HYDRA-UMC STUDIO`). Sehen Sie sich den erstellten `dist/`-Ordner lokal in
der Vorschau an mit:

```bash
npm run preview
```

oder bedienen Sie `dist/` mit einem beliebigen statischen Datei-Host Ihrer
Wahl. `npm run lint` führt den TypeScript-Compiler im reinen
Prüfmodus aus.

### Versionierung

`package.json`s `version` wird bei jedem echten `npm run build` automatisch
erhöht (eingebunden als `prebuild`-Skript, das `scripts/bump-version.mjs`
ausführt) - `npm run dev`/`lint`/`preview` fassen sie nie an. Das ist keine
Semantic Versioning: Es ist ein Kilometerzähler auf Basis 10. Die Patch-
Ziffer erhöht sich um 1; würde sie 9 überschreiten, wird sie auf 0
zurückgesetzt und stattdessen die Minor-Ziffer erhöht (`1.1.9` -> `1.2.0`,
nie `1.1.10`); derselbe Übertrag pflanzt sich von Minor zu Major fort. Siehe
`CHANGELOG.md` für die Versionshistorie und eine Zusammenfassung der
bisherigen Arbeit an diesem Projekt.

## 🛠️ Technologie-Stack
- **Sprache:** TypeScript
- **Frontend-Framework:** React 18
- **Build-Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **CRC32:** `crc-32` - Integritätsprüfung des Firmware-Images, spiegelt die
  eigene CRC32-Berechnung des Bootloaders
- **Hardware-Transport:** Web Serial API + SLCAN-Framing (keine nativen
  Abhängigkeiten, kein begleitender Backend-Server)

## 📂 Repository-Struktur

```
/
├── src/
│   ├── App.tsx                     Wurzelkomponente - Tab-Zustand,
│   │                                Hardware-Zustand, CAN-Frame-Protokollierung,
│   │                                und die Handler, die in jeden Tab unten
│   │                                verdrahtet sind (einschließlich CAN-OTA-
│   │                                Start/Ruecklesung und dem eigenen
│   │                                Frame-Injektor des CAN Bus Analyzer)
│   ├── main.tsx                    Vite/React-Einstiegspunkt
│   ├── i18n.ts                     i18next-Setup - en/es/de/fr/it, in
│   │                                localStorage persistiert
│   ├── index.css                   Tailwind-Einstiegspunkt
│   ├── types.ts                    Gemeinsame TypeScript-Typen (CanFrame,
│   │                                HardwareState, FlasherState,
│   │                                ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Vites eigene ambiente Typdeklarationen
│   ├── components/
│   │   ├── Header.tsx               Obere Leiste: Verbinden/Trennen-Button,
│   │   │                            Name des aktiven Werkzeugs, Sandbox-
│   │   │                            Umschalter FW v1.0/v1.1
│   │   ├── Sidebar.tsx              Linke Navigation - die 7 in diesem
│   │   │                            README beschriebenen Tabs
│   │   ├── ToolCatalog.tsx          Sandbox-Tab: der 25-Werkzeug-Katalog,
│   │   │                            Werkzeugauswahl, Sollwertsteuerung
│   │   ├── OledDisplay.tsx          Sandbox-Tab: Vorschau der
│   │   │                            OLED-Statusbildschirme
│   │   ├── SpecsAndBomViewer.tsx    Sandbox-Tab: BOM/Pinout-Browser
│   │   ├── ThermalCameraViewer.tsx  Sandbox-Tab: simulierter
│   │   │                            MLX90640-Feed - 100% Math.random(),
│   │   │                            uberhaupt kein CAN-Verkehr (siehe „Was
│   │   │                            echt ist vs. was eine Sandbox ist" oben)
│   │   ├── HardwarePanel.tsx        Sandbox-Steuerpanel fuer
│   │   │                            Jumper/LED/Erweiterungsplatine, verwendet
│   │   │                            innerhalb der Tabs Control und OLED
│   │   ├── CanBusAnalyzer.tsx       Echter Tab: rohes CAN-Frame-Protokoll,
│   │   │                            benutzerdefinierter Frame-Injektor,
│   │   │                            voreingestellte Befehlsausloeser
│   │   ├── FlasherStudio.tsx        Echter Tab: CAN-OTA-UI (Haupt- +
│   │   │                            Erweiterungs-Slave) und der
│   │   │                            SWD/JTAG-Faehigkeits-Erklaerer
│   │   ├── TesterStudio.tsx         Echter Tab: Live-Steuerung/Telemetrie
│   │   │                            pro Werkzeug, aufgebaut aus dem
│   │   │                            tester/-Ordner unten
│   │   └── tester/
│   │       ├── ToolPanels.tsx       Ein Panel pro Werkzeugprofil - echte
│   │       │                        Befehlsbytes, echte
│   │       │                        Telemetrie-Dekodierung, Watchdog-
│   │       │                        Keepalive pro Werkzeug
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor,
│   │       │                        Custom-Frame-Injektor
│   │       └── shared.tsx           Gemeinsame UI-Primitive (Section, Field,
│   │                                Button-/Input-Klassen, safeInt)
│   ├── data/
│   │   └── toolsData.ts             Die 25 TOOL_PROFILES - Namen,
│   │                                Standardwerte, Icons fuer die
│   │                                Sandbox-Tabs
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Web Serial + SLCAN-Transport -
│   │   │                            Verbinden/Trennen, Frame-TX/RX,
│   │   │                            waitForFrame pro ID mit einem
│   │   │                            begrenzten Rx-Puffer und einer
│   │   │                            500-Frame-Warteschlangenbegrenzung
│   │   ├── useFlasher.ts            CAN-OTA-Zustandsmaschine (Hauptplatine
│   │   │                            + Erweiterungs-Slave), spiegelt
│   │   │                            flasher_protocol.py
│   │   └── useKeepalive.ts          Hook fuer erneutes Senden mit festem
│   │                                Intervall, der den Watchdog-Keepalive
│   │                                der Aktiv-Checkbox jedes Werkzeugs
│   │                                stuetzt
│   ├── lib/
│   │   ├── flasher.ts               OTA-Protokollkonstanten, der
│   │   │                            committete HMAC-SHA256-Signierschluessel,
│   │   │                            CRC32/HMAC-Hilfsfunktionen,
│   │   │                            Manifest-Parsing
│   │   └── canIds.ts                CAN-ID-Konstanten fuer Tester Studio -
│   │                                 spiegelt tester_config.py byte-fuer-byte
│   └── locales/                     UI-Zeichenketten - en.json, es.json,
│                                     de.json, fr.json, it.json
├── scripts/
│   └── bump-version.mjs             Abhaengigkeitsfreies Versions-Skript, automatisch
│                                     vor jedem echten Build ausgefuehrt (siehe
│                                     "Versionierung" oben)
├── public/
│   └── firmware/                    Gebuendelte .bin/.elf/.hex fuer die
│                                     Hauptanwendung, den Haupt-Bootloader,
│                                     die Erweiterungs-Slave-Anwendung, und
│                                     den Erweiterungs-Slave-Bootloader
├── images/
│   ├── URTC_LOGO_WEB_STUDIO.svg     Vollstaendiges Logo-Banner (oben in
│                                     diesem README gezeigt)
│   ├── URTC_APP_ICON_NEW.svg        App-Icon
│   ├── urtc_custom_icon.svg         App-Icon, gleiche Grafik
│   └── urtc_icon.ico                Favicon
├── index.html                       Vite-Einstiegs-HTML
├── metadata.json                    App-Name/-Beschreibung + angeforderte
│                                     „serial"-Berechtigung (verwendet von
│                                     der Hosting-Plattform)
├── vite.config.ts                   Vite + Tailwind-Plugin-Konfiguration
├── tsconfig.json                    TypeScript-Konfiguration
├── .env.example                     VITE_APP_TITLE
├── dev.bat / dev.sh                 Installiert Abhaengigkeiten + startet
│                                     den Vite-Dev-Server
├── build.bat / build.sh             Installiert Abhaengigkeiten + erzeugt
│                                     den statischen dist/-Build
├── package.json
├── CHANGELOG.md                     Versionshistorie und Zusammenfassung bisheriger Arbeit
├── LICENSE
├── README.md                        Diese Datei
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md  <- Übersetzungen
```

## 📜 Lizenz und Urheberrechtshinweise

URTC Web Studio ist (c) 2026 JuanenRac (Electro Hobby 3D). Dieser Hinweis
muss in allen Verbreitungen dieses Projekts oder abgeleiteten Werken
enthalten sein.

Dieses Projekt besteht aus Quellcode und seiner eigenen Dokumentation, die
unter verschiedenen Lizenzen verfügbar gemacht werden - jede passend zu
dem, was sie tatsächlich abdeckt:

1. Der Quellcode (alles unter `src/`, plus die Vite/TypeScript-Konfiguration,
   die ihn baut) ist unter der **GNU General Public License v3.0
   (GPL-3.0)** verfügbar. Vollständiger Text unter
   https://www.gnu.org/licenses/gpl-3.0.html.

2. Die Dokumentation (dieses README und seine eigenen Übersetzungen -
   `README_spa.md`, `README_ita.md`, `README_fra.md`, `README_deu.md`) ist
   unter **Creative Commons Attribution-ShareAlike 4.0 International
   (CC BY-SA 4.0)** verfügbar. Vollständiger Text unter
   https://creativecommons.org/licenses/by-sa/4.0/.

Dieses Tool ist der browserbasierte Begleiter des Projekts
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC)
- siehe das eigene Repository dieses Projekts für die
Platinen-Firmware, Hardware-Designs, und vollständige
Protokolldokumentation, gegen die dieses Tool implementiert. Die eigene
Firmware von URTC ist GPL-3.0 und ihre Hardware-Designs sind CERN-OHL-S
v2; die eigene Lizenz dieses Tools hier erstreckt sich nicht auf dieses
separate Projekt, und umgekehrt. Es existieren auch 2 native
Desktop-Alternativen, die denselben Bereich abdecken:
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) und
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Wenn Sie auf diesem Projekt aufbauen, denken Sie an die Lizenztrennung:
Code-Änderungen sollten GPL-3.0 bleiben, Dokumentationsableitungen sollten
CC BY-SA bleiben - jeweils mit Zuschreibung zurück zu diesem Projekt und
seinem Autor.

## 🔗 Verwandte Projekte

Dieses Projekt ist Teil eines größeren Robotik-Ökosystems desselben Autors
(JuanenRac / Electro Hobby 3D). Es lohnt sich, davon zu wissen, da eine
Anfrage sich tatsächlich auf eines dieser Projekte statt auf dieses
Repository beziehen könnte:

**HYDRA-UMC-Plattform** — die Multi-Roboter-Mikrofabrikzelle
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — die
  Hauptplatine selbst: Raspberry-Pi-CM5-Host + Dual-Core-STM32H745-Echtzeit-
  Co-Prozessor, der bis zu 8 verteilte Roboterarme über CAN-OTA/SPI-OTA
  orchestriert. Eigene Hardware + Firmware, GPL-3.0/CERN-OHL-S v2/CC BY-SA
  4.0.
- **[HYDRA-UMC STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** —
  webbasiertes Steuerungs-Dashboard für HYDRA-UMC: Multi-Roboter-3D-
  Visualisierung, Kinematik-/Trajektorienaufzeichnung, CAN-OTA-Flashen und
  -Testen für die gesamte Plattform. React + Vite + Three.js.
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — das
  Headless-Backend (Node/Express/WebSocket), das früher im eigenen Prozess von
  HYDRA-UMC STUDIO gebündelt war. Verantwortlich für die Roboter-Steuerungs-
  REST/WS-API, settings.json-Persistenz, JWT-Authentifizierung und
  mDNS-Erkennung; HYDRA-UMC STUDIO ist jetzt ein reiner statischer
  Frontend-Client, der über das Netzwerk mit ihm kommuniziert.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — Android-Steuerungs-App für HYDRA-UMC über Wi-Fi/Bluetooth.
  Echte, funktionierende App - vollständiger Funktionsumfang zur
  Fernsteuerung, JWT-Authentifizierung, verschlüsselte
  Anmeldedatenspeicherung.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — iOS/iPadOS-Steuerungs-App für HYDRA-UMC über Wi-Fi, gebaut in Flutter
  (plattformübergreifend, unter Windows ohne Mac verifizierbar; die
  endgültige `.ipa`-Paketierung benötigt noch Xcode). Echte,
  funktionierende App - derselbe Funktionsumfang wie die Android-App.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** —
  Desktop-Schwarmkommandozentrale (Python/PySide6): Multi-Controller-
  Netzwerkerkennung, live bidirektionale Synchronisation, echtes
  3D-Roboter-Viewport, andockbarer Arbeitsbereich im Photoshop-Stil. Echt
  und funktionierend, kein Platzhalter.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — grafischer Desktop-URDF-Ersteller/-Editor (Python/PySide6) für den
  eigenen Modellkatalog dieses Projekts: zieht Quelldateien von GitHub oder
  einem lokalen Ordner, validiert die DOF-Machbarkeit, bearbeitet
  Farbe/Skalierung/Kinematik mit einer Live-3D-Vorschau, und übermittelt
  das fertige Ergebnis an einen laufenden STUDIO-Server. Echt und
  funktionierend, kein Platzhalter.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — native
  Flutter-Touch-UI für HYDRA-UMCs eigenen 5"/7"-DSI-Touchscreen (1280×720, gleiche Auflösung bei beiden Größen - korrigierter Wert, nicht 1280×800) am
  Compute Module 5, die denselben Server direkt von der Platine aus steuert.
  Echtes, funktionierendes Grundgerüst mit allen 6 Katalogbildschirmen (Dashboard, manuelle Steuerung, Kamera, vereinfachte 3D-Ansicht, Systemmetriken, Login), angebunden an den Live-Server; der echte Linux-Build wurde bisher noch nicht auf echter Hardware ausgeführt (bislang nur Windows-Arbeitsumgebung - siehe das eigene README dieses Projekts).

**URTC-Plattform** — der Werkzeug-Controller, den jeder HYDRA-UMC-Roboterarm
trägt
- **[URTC](https://github.com/JuanenRac/URTC)** — Universal Robot Tool
  Controller: STM32F303-basierter CAN-Bus-Werkzeugkopf-Controller, 25
  vollständig implementierte Werkzeugprofile, CAN-OTA-Firmware-Update.
- **[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER)** —
  Desktop-CAN-OTA- + Komplettchip-SWD/JTAG-Flash-Tool für URTC-Platinen
  (Windows/Linux).
- **[URTC Tester](https://github.com/JuanenRac/URTC-TESTER)** —
  Desktop-Live-CAN-Bus-Diagnosetool für URTC-Platinen, ein Panel pro
  Werkzeugprofil (Windows/Linux).
- **URTC Web Studio** *(dieses Repository)* — browserbasierte Alternative zu
  den 2 obigen Desktop-Tools (Web Serial API + SLCAN), keine lokale
  Installation nötig.

## 👤 Autor

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
