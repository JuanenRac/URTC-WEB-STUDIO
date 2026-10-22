<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

<p align="center">
  <a href="README.md">🇺🇸 English</a> |
  <a href="README_spa.md">🇪🇸 Español</a> |
  <a href="README_fra.md">🇫🇷 Français</a> |
  <a href="README_ita.md">🇮🇹 Italiano</a> |
  🇩🇪 <b>Deutsch</b> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  <a href="README_jpn.md">🇯🇵 日本語</a> |
  <a href="README_por.md">🇵🇹 Português</a>
</p>


<p align="center">
  <img src="https://img.shields.io/badge/Lizenz-GPL%203.0-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>


Ein browserbasierter Begleiter für den **Universal Robot Tool Controller (URTC)** -
eine React/Vite-Single-Page-App, die mit echter URTC-Hardware (bisher nie mit solcher betrieben) über einen
USB-CAN-Adapter via der [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
spricht, wobei dasselbe SLCAN-Framing und CAN-Protokoll wie bei den beiden
Desktop-Begleit-Tools verwendet wird, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) und
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). Das Ziel ist, die wichtigsten Abläufe dieser beiden Tools in einem einzigen Browser-Tab bereitzustellen, keine vereinfachte Demo davon; volle Funktionsparität ist noch nicht erreicht (siehe „Noch nicht abgedeckt“ weiter unten) - die Tabs Flasher Studio und Tester Studio senden
und empfangen die echten CAN-Frames, die in `docs/CANBUS.TXT` des
[URTC](https://github.com/JuanenRac/URTC)-Repository beschrieben sind.

**Ehrlichkeitscheck - was heute wirklich funktioniert:** `npm test` (Vitest) deckt die reine Logik ab: SLCAN-Parsing, Zuordnung von Anfrage und Antwort, Prüfungen von Firmware-Images und Manifesten, Werkzeuggrenzen, Bestätigungen, die Regeln, die den Simulator vom echten Bus trennen, den Trace-Export und die acht Oberflächensprachen. Die Oberflächen und der Web-Serial-Transport selbst haben keine automatisierten Tests, und nichts davon ist in dieser Umgebung gegen eine echte URTC-Platine gelaufen (hier gibt es keinen USB-CAN-Adapter zum Testen): Flasher Studio, Tester Studio und der CAN-Bus-Protokollanalysator sind echter Code, der nur durch diese Tests, die Typprüfung (`npm run lint`) und Code-Durchsicht verifiziert ist. Control/OLED/Specs-BOM/Thermal IR Inspection sind offen als Sandbox-Tabs gekennzeichnet, ohne jeglichen CAN-Verkehr. Siehe `CHANGELOG.md` für das, was bisher genau ausgeliefert wurde.

---

> **Stand von Sicherheit (Safety) und Security:** Dieses Ökosystem ist kein zertifiziertes Sicherheitssystem, und es existiert noch keine bestückte URTC-Platine. Die Bootloader prüfen Firmware-Images mit CRC32 und einem HMAC-SHA256 mit gemeinsamem Schlüssel, nicht mit einer asymmetrischen Signatur (geplant); die veröffentlichten Anwendungs-Images sind mit dem öffentlichen Entwicklungsschlüssel signiert (`signing_key_kind: dev`), sodass jeder ein vom Bootloader akzeptiertes Image erzeugen kann; an eine echte Platine wurde noch nichts gesendet. Lesen Sie die [Sicherheitsbasis](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) und das [Bedrohungsmodell](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md), bevor Sie sich für die Sicherheit einer Person auf eine Aussage hier verlassen.

## 📋 Auf einen Blick

| | |
|---|---|
| Version | `0.3.3` |
| Reifegrad | Funktionsfähig |
| Technik | Web Serial API / TypeScript |
| Ziel | Ein Webbrowser auf dem PC des Benutzers |
| Auf echter Hardware | Nur simuliert: gegen Emulatoren, Attrappen oder Simulatoren getestet; für diese Version ist kein Lauf auf echter Hardware vermerkt |

## 🧭 Was echt ist vs. was eine Sandbox ist

Diese App hat zwei Arten von Tabs:

- **Echte, hardwaregesteuerte Tabs** - Flasher Studio, Tester Studio, und der CAN
  Bus Protocol Analyzer. Diese tun erst etwas, sobald Sie einen echten
  USB-CAN-Adapter angeschlossen haben (Schaltfläche oben rechts in der
  Kopfzeile); jeder Befehl, den sie senden, und jede Anzeige, die sie zeigen,
  kommt vom CAN-Bus (dieser Weg wurde nie mit einem echten Adapter oder einer echten Platine betrieben). Dies schließt die **echte
  Wärmebildkamera-Ablesung** ein - das Panel „Thermal Inspection" von Tester
  Studio (`0x250`/`0x251`/`0x254`/`0x255`) fragt das tatsächliche MLX90640-IR-Array
  des Werkzeugkopfs über CAN ab.
- **Offline-Sandbox-Tabs** - Control (Werkzeugkatalog), OLED, Specs/BOM, und
  Thermal IR Inspection. Diese lassen Sie den Katalog von 25 Werkzeugen
  erkunden, die OLED-Statusbildschirme in der Vorschau ansehen, das
  BOM/Pinouts durchsuchen, und einen simulierten Wärmebildkamera-Feed
  betrachten, alles ohne angeschlossene Hardware. Der Umschalter „FW v0.0 /
  v0.1" in der Kopfzeile beeinflusst nur diese Sandbox-Tabs (welche
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
- Der Bus auf **500 kbit/s** eingestellt. Beim Verbinden probiert die App nacheinander 500, 250, 125 kbit/s und die übrigen Standardraten und behält die erste, bei der eine Platine auf eine Versionsabfrage antwortet; die Rate lässt sich noch nicht von Hand wählen, und ohne antwortende Platine kann man nicht nur mithören.
- Ein Browser mit Web-Serial-Unterstützung - **Chrome oder Edge**. Firefox und
  Safari implementieren Web Serial nicht und können sich überhaupt nicht
  verbinden.
- Web Serial erfordert entweder einen sicheren Kontext (HTTPS) oder
  `localhost` - und kann nicht aus einem iframe heraus verwendet werden. Wenn
  Sie diese App innerhalb eines eingebetteten Frames in der Vorschau
  betrachten, öffnen Sie sie zuerst in ihrem eigenen Tab.

## 🛡️ CAN-Frame-Validierung

Beide Richtungen der SLCAN-Verbindung werden validiert, bevor irgendetwas
die UI oder die Leitung erreicht (`src/hooks/useSerialCanBus.ts`):

- **Ausgehend** - `sendFrame()` verweigert die Serialisierung eines
  Befehls, dessen Kennung außerhalb des 11-Bit-Standard-CAN-Bereichs
  (`0x000`-`0x7FF`) liegt, dessen Nutzlast 8 Byte überschreitet, oder deren
  Nutzlast ein Byte außerhalb von `0x00`-`0xFF` enthält. Die UI zeigt
  "Refusing malformed CAN frame: ..." an, statt ungültigen Text an den
  seriellen Port zu schreiben.
- **Eingehend** - `processBuffer()` verlangt eine echte Übereinstimmung
  mit `t<3-stellige Hex-ID><1-stelliges Hex-DLC 0-8><Hex-Nutzlast>`, bevor
  eine empfangene SLCAN-Zeile in einen `CanFrame` umgewandelt wird; ein DLC
  außerhalb von `0`-`8` oder eine Nutzlast, die kürzer als ihre eigene
  angegebene Länge ist, wird in der Konsole protokolliert und verworfen,
  statt einem Werkzeug-Panel als `NaN`-Byte übergeben zu werden. Ein
  optionaler abschließender Adapter-Zeitstempel wird nach einer gültigen
  Nutzlast weiterhin akzeptiert.

## ⚡ Flasher Studio - echte Funktionsabdeckung

Portiert aus dem eigenen `flasher_protocol.py` von `URTC-FLASHER`, gegen
dieselben CAN-IDs:

- **CAN-OTA-Update der Hauptplatine** (`0x7F0`-`0x7F7`): Bootloader-Eintritts-
  Trigger, HMAC-SHA256 mit gemeinsamem Schlüssel (nur gegen einen Simulator getestet), seitenweise Übertragung mit
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
- **Live-Abfrage der Platinenversion** (`0x7F8`/`0x7F9`/`0x7FA`/`0x7E9`) - zeigt den
  echten Antwortenden (Anwendung oder Bootloader), die HardwareID, und die
  Version, kein simulierter Umschalter.
- **Veröffentlichte Signatur und Prüfsumme** - jedes Image aus dem
  URTC-Build kommt mit `<file>.manifest.json` (Version, `sha256` und der `hmac_sha256`-Wert, den der Bootloader erwartet, ein HMAC-SHA256 mit gemeinsamem Schlüssel und keine asymmetrische Signatur) und `<file>.sha256`.
  Die App sendet diese veröffentlichte Signatur, ein `sha256` im Manifest,
  das nicht zur Datei passt, **blockiert** das Flashen, und die Version aus
  dem Manifest wird dem Bootloader gemeldet. Eine von der Festplatte gewählte
  Datei hat kein Manifest: sie lässt sich nur mit einem für dieses eine
  Flashen eingegebenen Signierschlüssel flashen (Testplatinen), außer ihre
  `.manifest.json` wird zusammen mit ihr gewählt.
- **Patch-Nummer der Firmware** (`0x7E9`, und das erweiterte `0x218` des
  Slaves) - die installierte Firmware und das gewählte Image werden als
  Major.Minor.Patch angezeigt. Der Patch geht nur in den Vergleich ein, wenn
  beide Seiten einen tragen, eine ältere Platine (sie sendet kein `0x7E9`)
  funktioniert weiter mit Major.Minor, und der Patch gelangt nur zu einem
  Bootloader in END_UPDATE, der ihn angekündigt hat. Das Protokoll sagt, ob
  das Image älter, gleich oder neuer ist als das, was die Platine gemeldet hat.
- **Firmware aus dem neuesten GitHub-Release** - die Binärdateien sind Anhänge
  des Releases jeder URTC-Version, keine Dateien in git. Die Liste stammt aus
  der Releases-API von `JuanenRac/URTC` (nur die Anwendungs-Images der
  gewählten Platine, jeweils mit ihrer `.sha256` und `.manifest.json`); ein
  heruntergeladenes Image muss zu den vom Release veröffentlichten Prüfsummen
  passen, und die Prüfungen von Image, Manifest und Signatur bleiben. GitHub
  liefert die Dateien von einem Host ohne CORS-Header aus, ein Browser kann sie
  daher eventuell nicht herunterladen: das Protokoll sagt es dann, und das
  Image kann aus dem mitgelieferten Ordner genommen oder von der Release-Seite
  heruntergeladen und mit Durchsuchen zusammen mit seiner `.manifest.json`
  gewählt werden.
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
  unter seinem eigenen 1000ms-Watchdog), mit denselben Sendeintervallen wie
  das Desktop-Tool. Beim Abwählen, beim Wechsel von Panel oder Tab, beim
  Trennen oder beim Schließen der Seite wird der Aus-Befehl des Werkzeugs gesendet.
- **Global Controls** (`0x100`), SPI-Durchleitung von **Expansion Board** +
  TMC-DIAG0-Abfrage (`0x180`-`0x183`), **F-RAM**-Abfrage/Löschung
  (`0x190`-`0x192`), **Self-Test** (sichere Prüfungen im Ruhezustand pro
  Werkzeug), ein **Raw Bus Monitor** mit `.trc`/`.asc`-Trace-Export, und ein
  **Custom Frame**-Injektor mit optionalem Wiederholungsintervall -
  validiert wie der eigene Frame-Injektor des CAN Bus Protocol Analyzer: ein
  Identifier außerhalb von `0`-`7FF`, ein ungültiges Datenbyte oder mehr als
  8 Bytes wird mit einer Meldung abgelehnt, nie maskiert, verworfen oder
  gekürzt. Identifier, die nur die Platine sendet, werden abgelehnt, und
  Schreibzugriffe auf den Platinenspeicher, Bootloader-Befehle und
  Aktor-Befehle werden vorher bestätigt.
- **Detect Hardware** fragt das echte aktive Werkzeug (`0x110`/`0x111`) und
  die Platinenversion (`0x7F8`/`0x7F9`) ab, und ein deklarierter kritischer
  Fehler (`0x111` Byte 1) erscheint als Live-Fehlerbanner.

### Trennung vom Simulator und Bestätigungen (Software-Prüfungen, keine Sicherheitsfunktionen)

- Die Sandbox-Tabs (Control, OLED, Thermal IR) übertragen nichts. Ihre Frames sind mit SIM markiert, und solange eine Platine verbunden ist, erzeugen sie keine simulierte Antwort. Von den vordefinierten Nachrichten des Protokollanalysators werden an eine verbundene Platine nur einfache Abfragen gesendet; der Rest bleibt simuliert.
- Tester Studio zeigt ein Werkzeugpanel nur für das Werkzeug, das die Platine selbst gemeldet hat (`0x111`), und keines, bevor die Platine geantwortet hat.
- Laser, Bohrer, UV-Härtung, Schweißen, Heizungen, Bewegung, Pastendosierung, Schreibzugriffe auf den Platinenspeicher und riskante von Hand getippte Frames verlangen vorher eine Bestätigung.
- **ALLES STOPPEN** in der Kopfzeile (sichtbar bei bestehender Verbindung) schaltet jeden Aktor ab, den diese Seite am Leben hält; das Schließen der Seite und das Trennen tun dasselbe. Es ist ein Software-Befehl, kein Not-Halt.
- Das Flashen eines mit dem öffentlichen Entwicklungsschlüssel signierten Images verlangt vorher eine Bestätigung, weil dieser Schlüssel nichts darüber aussagt, wer das Image erstellt hat.
- Meldet die Platine einen kritischen Fehler, nennt das Banner auch den Grund des Schutzes gegen thermisches Durchgehen, sofern die Platine ihn meldet.

### Noch nicht abgedeckt

- Die Fehlerzähler der Wärmebildinspektion (`0x1AA`/`0x1AB`).
- Ein reiner Mithörmodus und die manuelle Wahl der Bitrate: Ein Bus, auf dem keine Platine antwortet, lässt sich nicht aufschalten.
- Das Auslesen des Wärmebilds prüft nicht vorab, ob der Sensor bereit ist, und wiederholt keinen verlorenen Block.
- Eine Firmware-Datei direkt aus dem GitHub-Release im Browser herunterladen: GitHub liefert Release-Dateien von einem Host ohne CORS-Header aus, der Download kann daher blockiert sein (das mitgelieferte Image oder eine von der Festplatte gewählte Datei mit ihrer `.manifest.json` funktionieren immer).

## 🔐 Sicherheitshinweis: kein Signierschlüssel in dieser App

Seit 0.2.3 enthält diese App **keinen** HMAC-SHA256-Signierschlüssel. Der
URTC-Build signiert jedes Anwendungs-Image selbst (bei Release-Builds mit einem privaten Schlüssel; die veröffentlichten Images verwenden den öffentlichen Entwicklungsschlüssel) und veröffentlicht die Signatur daneben; Flasher
Studio transportiert nur diese Signatur - dasselbe Modell wie der
Desktop-`URTC Flasher`. Im JS-Bundle steckt nichts Geheimes, die Seite kann
also öffentlich gehostet werden.

Einzige Ausnahme ist ein selbst gebautes Image ohne Manifest für eine
Testplatine: dann fragt die App nach dem Signierschlüssel, hält ihn nur für
dieses eine Flashen im Speicher und speichert ihn nie. Images, die mit dem
ÖFFENTLICHEN Entwicklungsschlüssel signiert sind (`signing_key_kind: "dev"`
im Manifest), lassen sich nur auf Platinen installieren, deren Bootloader
genauso gebaut wurde - das Log weist darauf hin. Siehe
`docs/FIRMWARE_SIGNING.TXT` in URTC.

`public/firmware/` enthält genau die Dateien, die URTC veröffentlicht hat
(gleiche Namen, gleiche Bytes, mit ihren Begleitdateien). Die URTC-Binärdateien
liegen nicht in git: sie sind Anhänge des GitHub-Releases jeder Version.
`npm run sync-firmware` lädt das neueste Release herunter
(`npm run sync-firmware -- --tag v0.3.5` für ein bestimmtes) oder nimmt einen
lokalen Ordner als Argument (`npm run sync-firmware -- ../URTC/firmware` für
einen Bench-Build). In beiden Fällen kontrolliert es jede Prüfsumme und die
Signaturfelder, bevor es `public/firmware/` anfasst, und erzeugt
`src/lib/bundledFirmware.ts` neu; ein Test prüft das Paket gegen seine
Manifeste.

Jede Datei eines offiziellen Releases hat eine Release-Signatur (`<Datei>.sig`, Ed25519): Die Synchronisierung prüft sie, wenn sie vorhanden ist, und lehnt eine falsche ab; ein Satz ohne Signaturen (eine Bench-Vorabversion oder ein lokaler Build) braucht `--allow-unsigned`. Die Seite prüft dieselbe Signatur im Browser (Web Crypto), bevor sie ein mitgeliefertes Image oder ein Image aus einem GitHub-Release an eine Platine sendet, und bricht ab, wenn sie ungültig ist.

## 🚀 Erste Schritte

### Voraussetzungen
- Node.js 20 LTS+
- npm

### Installation

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### Entwicklungsmodus

Führt die App mit dem Dev-Server von Vite und Live-Reloading aus:
- **Windows:** Doppelklick auf `dev.bat` oder `npm run dev` ausführen
- **Linux/Mac:** `./dev.sh` oder `npm run dev` ausführen

Öffnen Sie dann `http://localhost:3000` in Chrome oder Edge.

Der Entwicklungsserver lauscht nur auf `localhost`: Web Serial funktioniert über https oder auf localhost, ihn im Netzwerk zu öffnen brächte also nichts.

### Statischer Build

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

Die gebaute Seite deklariert eine Content-Security-Policy (Skripte nur von der Seite selbst; Verbindungen nur zu ihr selbst und zu GitHub) und lädt jeden Tab beim ersten Öffnen. Sie wurde noch nicht in einem echten Browser ausprobiert.

### GitHub Pages (Werkbank-Werkzeug)

Das Repository kann die gebaute Seite auf GitHub Pages veröffentlichen (Workflow `.github/workflows/pages.yml`: `npm ci`, Typprüfung, Tests, `npm run build` mit dem Basispfad des Projekts, danach `upload-pages-artifact` und `deploy-pages`). Es wird als **Werkbank-Werkzeug** angeboten: Die enthaltenen Firmware-Images sind mit dem öffentlichen Entwicklungsschlüssel signiert, den jeder verwenden kann; die veröffentlichte Seite zeigt deshalb einen Hinweis und ist keine vertrauenswürdige Firmware-Quelle für eine Maschine im Einsatz. Zum Aktivieren öffnet der Repository-Eigentümer Settings > Pages und stellt Source auf "GitHub Actions"; bis dahin endet der Workflow ohne Veröffentlichung. Web Serial braucht einen Chromium-basierten Browser und https, was Pages bietet.

### Versionierung

`package.json`s `version` (und der passende `version`-Wert in `urtc.project.json`) wird nur vom ausdrücklichen Schritt `python bump.py` erhöht (er führt `bump_manifest_version.py` aus, das die aktuelle Version aus `package.json` liest, erhöht, zurückschreibt, das Manifest synchronisiert und einen knappen CHANGELOG-Eintrag hinzufügt, falls diese Version noch keinen hat). `build.bat`/`build.sh` kompilieren nur und rühren die Version nie an. `npm run build` (`vite build`) allein ist bewusst rein
kompilierend und rührt die Version nie an - `scripts/bump-version.mjs`
erledigte diese Aufgabe in einem früheren Design mit `prebuild`-Hook, ist
heute aber legacy und wird nur noch als Referenz aufbewahrt (siehe dessen
eigenen Kopfkommentar); `npm run dev`/`lint`/`preview` fassen die Version
ebenfalls nie an. Das ist keine Semantic Versioning: Es ist ein
Kilometerzähler auf Basis 10. Die Patch-Ziffer erhöht sich um 1; würde sie 9
überschreiten, wird sie auf 0 zurückgesetzt und stattdessen die
Minor-Ziffer erhöht (`0.1.9` -> `0.2.0`, nie `0.1.10`); derselbe Übertrag
pflanzt sich von Minor zu Major fort. Siehe `CHANGELOG.md` für die
Versionshistorie und eine Zusammenfassung der bisherigen Arbeit an diesem
Projekt.

## 📖 Weitere Dokumentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — wie UI, gespeicherte
  Einstellungen und die Hoheit über den externen Transport getrennt
  bleiben, und warum die Sandbox-Tabs Offline-/Nicht-verfügbar-Zustände
  zeigen müssen, statt simulierte Daten als live darzustellen.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — der nicht-mutierende
  Prüfpfad `build-test.bat`/`.sh` (TypeScript + Tests, ohne Versions- oder
  CHANGELOG-Änderung), `dev.bat`/`.sh` für die lokale Entwicklung, und
  warum OTA-Signiermaterial nie in die Browser-Konfiguration gehört.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — was
  dieser Client bei einem unbekannten Schema, fehlender Zielidentität oder
  einem fehlerhaften API-Ergebnis tun muss, und warum die echte
  Flash-Hoheit serverseitig oder in den dedizierten Desktop-Tools bleibt.

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
│   ├── i18n.ts                     i18next-Setup - en/es/de/fr/it/zh/ja/pt, in
│   │                                localStorage persistiert
│   ├── index.css                   Tailwind-Einstiegspunkt
│   ├── types.ts                    Gemeinsame TypeScript-Typen (CanFrame,
│   │                                HardwareState, FlasherState,
│   │                                ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Vites eigene ambiente Typdeklarationen
│   ├── components/
│   │   ├── Header.tsx               Obere Leiste: Verbinden/Trennen-Button,
│   │   │                            Name des aktiven Werkzeugs, Sandbox-
│   │   │                            Umschalter FW v0.0/v0.1
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
│   │   ├── flasher.ts               OTA-Protokollkonstanten, CRC32/HMAC-Helfer,
│   │   │                            Manifest-Auswertung (kein Signierschlüssel)
│   │   ├── boardVersion.ts          Versionsabfragen: 0x7F9/0x7FA/0x7E9 und 0x217/0x218 des Slaves
│   │   ├── githubRelease.ts         Images des neuesten GitHub-Releases und ihr Download
│   │   ├── firmwareImage.ts         Image-Prüfungen, Manifest-Ziel und Version (mit Patch)
│   │   ├── firmwareSignature.ts     Wählt die zu sendende Signatur: die veröffent-
│   │   │                            lichte oder einen einmalig eingegebenen Schlüssel
│   │   ├── quickState.ts            0x111-Auswertung (Thermikfehler, Reset-Ursache)
│   │   ├── bundledFirmware.ts       Erzeugt von scripts/sync-firmware.mjs
│   │   └── canIds.ts                CAN-ID-Konstanten fuer Tester Studio -
│   │                                 spiegelt tester_config.py byte-fuer-byte
│   └── locales/                     UI-Zeichenketten - en.json, es.json,
│                                     de.json, fr.json, it.json, ja.json, zh.json, pt.json
├── scripts/
│   ├── bump-version.mjs             Abhaengigkeitsfreies Versions-Skript; heute legacy,
│   │                                 nur als Referenz erhalten - abgeloest durch
│   │                                 bump_manifest_version.py (siehe "Versionierung")
│   └── sync-firmware.mjs            Kopiert die URTC-Release-Dateien (oder einen
│                                     lokalen Ordner) nach public/firmware/,
│                                     Prüfsummen geprüft - npm run sync-firmware
├── public/
│   └── firmware/                    Gebuendelte .bin/.elf/.hex fuer die
│                                     Hauptanwendung, den Haupt-Bootloader,
│                                     die Erweiterungs-Slave-Anwendung, und
│                                     den Erweiterungs-Slave-Bootloader
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   Vollstaendiges Logo-Banner (oben in
│                                     diesem README gezeigt)
│   ├── URTC_APP_ICON_NEW.svg        App-Icon
│   ├── urtc_custom_icon.svg         App-Icon, gleiche Grafik
│   └── urtc_icon.ico                Favicon
├── index.html                       Vite-Einstiegs-HTML
├── vite.config.ts                   Vite + Tailwind-Plugin-Konfiguration
├── tsconfig.json                    TypeScript-Konfiguration
├── .env.example                     Die App liest keine Variablen
├── dev.bat / dev.sh                 Installiert Abhaengigkeiten + startet
│                                     den Vite-Dev-Server
├── build.bat / build.sh             Installiert Abhaengigkeiten + erzeugt
│                                     den statischen dist/-Build
├── tools/
│   └── ci_validate.py               Manifest-/CHANGELOG-/Doku-Validierung, von der CI genutzt
├── bump.py                          Ausdrücklicher Befehl zum Erhöhen der Version (Kompilieren erhöht nie)
├── bump_manifest_version.py         Versionserhöhung, nur vom ausdrücklichen `bump.py` ausgelöst (package.json + Manifest, siehe "Versionierung"); der Modus `--sync` existiert ebenfalls, um eine vorherige native Erhöhung zu übernehmen
├── package.json
├── CHANGELOG.md                     Versionshistorie und Zusammenfassung bisheriger Arbeit
├── LICENSE
├── NOTICE                      Copyright-Hinweis und Lizenz der Dokumentation
├── README.md                        Diese Datei
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- Übersetzungen
```

## 📜 LIZENZ

URTC Web Studio ist (c) 2026 JuanenRac (Electro Hobby 3D). Dieser Hinweis
muss in allen Verbreitungen dieses Projekts oder abgeleiteten Werken
enthalten sein.

Dieses Projekt besteht aus Quellcode und seiner eigenen Dokumentation, die
unter verschiedenen Lizenzen verfügbar gemacht werden - jede passend zu
dem, was sie tatsächlich abdeckt:

1. Der Quellcode (alles unter `src/`, plus die Vite/TypeScript-Konfiguration,
   die ihn baut) ist unter der **GNU General Public License v3.0
   (GPL-3.0-or-later)** verfügbar. Vollständiger Text unter
   https://www.gnu.org/licenses/gpl-3.0.html.

2. Die Dokumentation (dieses README und seine eigenen Übersetzungen -
   `README_spa.md`, `README_ita.md`, `README_fra.md`, `README_deu.md`,
   `README_zho.md`, `README_jpn.md`) ist
   unter **Creative Commons Attribution-ShareAlike 4.0 International
   (CC BY-SA 4.0)** verfügbar. Vollständiger Text unter
   https://creativecommons.org/licenses/by-sa/4.0/.

Dieses Tool ist der browserbasierte Begleiter des Projekts
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC)
- siehe das eigene Repository dieses Projekts für die
Platinen-Firmware, Hardware-Designs, und vollständige
Protokolldokumentation, gegen die dieses Tool implementiert. Die eigene
Firmware von URTC ist GPL-3.0-or-later und ihre Hardware-Designs sind CERN-OHL-S
v2; die eigene Lizenz dieses Tools hier erstreckt sich nicht auf dieses
separate Projekt, und umgekehrt. Es existieren auch 2 native
Desktop-Alternativen, die denselben Bereich abdecken:
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) und
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Wenn Sie auf diesem Projekt aufbauen, denken Sie an die Lizenztrennung:
Code-Änderungen sollten GPL-3.0-or-later bleiben, Dokumentationsableitungen sollten
CC BY-SA bleiben - jeweils mit Zuschreibung zurück zu diesem Projekt und
seinem Autor.

## 🔗 Verwandte Projekte

Dieses Projekt ist Teil des HYDRA-UMC-Robotik-Ökosystems desselben Autors (JuanenRac / Electro Hobby 3D). Gut zu wissen, da eine Anfrage eigentlich eines dieser Projekte betreffen könnte statt dieses Repositorys.

**Übergeordnetes Projekt**
- **[URTC](https://github.com/JuanenRac/URTC)** — Firmware für die physische Universal-Robot-Tool-Controller-Platine, 25+ Werkzeugprofile über CAN-Bus; das übergeordnete Projekt, dessen spezifisches Werkzeug dieses Repository innerhalb seiner eigenen CAN-Bus-Tooling-Familie ist.

**Geschwisterprojekte** — die übrigen Werkzeuge der eigenen CAN-Bus-Tooling-Familie von URTC
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — Desktop-GUI-Flash-Tool für URTC-Platinen, CAN-OTA plus Full-Chip-SWD/JTAG — dasselbe SLCAN-/CAN-Protokoll wie diese browserbasierte App, die die installationsfreie Alternative dazu ist.
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — Desktop-Live-CAN-Bus-Diagnosetool für URTC-Platinen, ein Panel pro Werkzeugprofil — dasselbe SLCAN-/CAN-Protokoll wie diese browserbasierte App, die die installationsfreie Alternative dazu ist.

**Direkt verwandt**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — Flotten-CLI mit einem echten, stabilen Exit-Code-Vertrag, ein echter Live-Client der eigenen API von HYDRA-UMC-SERVER — eine Terminal-/Kommandozeilen-Alternative zu diesem browserbasierten Tool.

**Ebenfalls Teil des Ökosystems**

*Kern-Hardware & Plattform*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — der Entwurf des Motherboards des Roboterarms: CM5-Host + Dual-Core-STM32H745, gedacht zur Koordination von bis zu 8 Werkzeugarmen über CAN-OTA/SPI-OTA (Firmware in einer frühen Phase; noch keine bestückte Platine).
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — reproduzierbare Raspberry-Pi-OS-Produktschicht für den CM5: schreibgeschützter Agent, validierte Konfiguration/Profile, WiFi-Ersteinrichtung.
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — der gemeinsame JSON-Schema-Vertrag und die Software-Auftragsschranke, gegen die jede Bridge ihre Befehle validiert (keine zertifizierte Sicherheitsfunktion).
- **[HYDRA-UMC-CONNECTOR-HUB](https://github.com/JuanenRac/HYDRA-UMC-CONNECTOR-HUB)** — deklaratives Adapter-Manifest-Register und Validator für Konnektoren externer Maschinen; erweitert die eigene Vertragsidee des SDK auf externe Maschinen, ohne die Industrie-Gateway-Projekte zu ersetzen.

*Kern-Backend & Clients*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — das reale Headless-Backend (REST/WebSocket), mit dem jeder Steuerungsclient tatsächlich spricht.
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — Web-Steuerungs-Dashboard mit Echtzeit-3D-Visualisierung mehrerer Roboter.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — Desktop-Schwarmleitstand (PySide6) für mehrere Server gleichzeitig, verpackt als eigenständige ausführbare Datei.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — native Android-Steuerungs-App mit biometrischem Login und einer gekoppelten Wear-OS-Begleit-App.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — iOS/iPadOS-Steuerungs-App (Flutter) mit Echtzeit-WebSocket-Synchronisierung.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — native Touch-UI für das eingebaute 7"-DSI-Touchscreen, direkt auf dem CM5 eingebettet.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — grafischer Desktop-URDF-Ersteller/-Editor, der fertige Modelle in STUDIOs eigenen Katalog überträgt.
- **[HYDRA-UMC-EDITOR-STL](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-STL)** — Desktop-STL-Modelleditor, der echte Teile im selben Modellkatalog transformiert/ersetzt/entfernt/hinzufügt, den auch HYDRA-UMC-EDITOR-URDF bearbeitet.
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — Koordinationsschranke für AGV-/AMR-Flotten über einen VDA-5050-MQTT-Publisher (nur gegen eine emulierte Flotte getestet).
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — High-Level-Koordinator für CNC-Zellen mit GRBL-Status-/Steuerbyte-Zugriff (nur gegen einen Emulator getestet).
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — Koordinationsschranke für laufende/humanoide Droiden, mit einem Boston-Dynamics-Spot-Befehlssender (nur gegen einen Emulator getestet).
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — Koordinator für Laserzellen, liest 3 Schlüssel-/Gehäuse-/Verriegelungs-GPIO-Signale (nur gegen einen simulierten Chip getestet; kann keinen Laser scharfschalten oder auslösen).
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — sicherer High-Level-Koordinator für den Leiterplattenfluss von OpenPnP Pick-and-Place.
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — sichere Koordinationsschranke für Moonraker/Klipper-3D-Drucker, mit echten gesicherten Job-Befehlen.
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — Koordinator mit einem träge importierten rclpy-ROS-2-Transport (noch nicht gegen eine ROS-2-Installation ausgeführt).
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — Koordinationsschranke für kameraausgestattete UAVs, mit einem MAVLink-Befehlssender (nur gegen einen Emulator getestet).

*Vision-KI-Knoten (Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — Integrationsknoten für die Hailo-8-Vision-Pipeline, mit einer echten stufenweisen Hardware-Bereitschaftsprüfung.
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — echte Registry für kompilierte Modelle mit Hailo-Architektur-/Prüfsummen-Safe-Load-Verifizierung.
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — echter GStreamer-Pipeline- + MediaMTX-Konfigurationsgenerator mit einer echten HailoRT-Integrationsschranke.
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — Position-Based-Visual-Servoing-Korrekturgesetz mit Freigabe abhängig vom Zonenstatus; noch keine Posenschätzung per Kamera.
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — v0-Logik für Zonenverletzung, Kalibrierungsaktualität und E-STOP-Anforderung, die Objektpositionen aus einer Datei nimmt; kein Detektor speist sie, und noch kein physischer E-STOP ist angeschlossen.

*Kognitiver KI-Knoten (Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — Integrationsknoten für die Hailo-10-Cognitive-Pipeline (LLM-/VLA-/Sprach-Orchestrierung).
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — echte Aktions-Token-Kodierung/-Dekodierung und Trajektoriengenerierung für ein Vision-Language-Action-Modell.
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — echtes Sprach-Frontend (VAD + Intent-Parser) mit einem begrenzten, bestätigungsgesicherten Watch-Relay.
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — echte regelbasierte Aufgabenzerlegung und semantische Fehlerbehebung über MCU-Fehlercodes.
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — echte, nur auf der Standardbibliothek basierende TF-IDF-Dokumentensuche über die eigenen Markdown-Dokumente dieses Ökosystems.
- **[HYDRA-UMC-LOCAL-TECHNICIAN](https://github.com/JuanenRac/HYDRA-UMC-LOCAL-TECHNICIAN)** — lokaler, richtlinien-gesteuerter KI-Wartungstechniker für das Ökosystem selbst - beobachtet, diagnostiziert und schlägt Korrekturen vor; die zwei höchsten Risikostufen sind absichtlich noch nicht implementiert.

*Orchestrierung & Schwarm*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — Integrationsknoten mit einem echten gRPC/Protobuf-Health-Report-Vertrag und einer Missions-Zustandsmaschine.
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — echte prioritätsbasierte Job-Queue mit Deduplizierung, über eine echte HTTP-API.
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — echter gRPC-basierter Flotten-Health-Watchdog mit Retry/Backoff und Identitäts-Mismatch-Erkennung.
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — echter RRT-basierter 3D-Pfadplaner mit echter Hindernis-/Arbeitsraum-Kollisionsvalidierung.
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — echte CRDT-LWW-Element-Map-Zustandssynchronisation, eigenschaftsgetestet auf Multi-Zellen-Konvergenz.

*Digitaler Zwilling & Simulation*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — Integrationsknoten für die Digital-Twin-Engine, mit einem echten Versionskompatibilitäts-Sync-Vertrag.
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — Hardware-in-the-Loop-Router mit einer Software-Kollisionsverriegelung zwischen Simulation und echter Hardware (ohne echte Hardware getestet).
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — echte Vorwärtskinematik und Gelenkgrenzenvalidierung über eine echte URDF-Teilmenge.
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — echter prozeduraler 2D-Szenengenerator mit YOLO/COCO-Annotationsexport.

*Daten & Analytik*
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — echter sqlite3-gestützter Zeitreihenspeicher mit einer echten Ingest-/Abfrage-HTTP-API.
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — echter FFT- + statistischer Basislinien-Anomaliedetektor mit Drift-Überwachung.
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — echte OEE-/Verfügbarkeitsberechnung über den DATALAKE-Verlauf, mit reproduzierbarem CSV-Export.
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — echte CAN/WebSocket-Ingestion-Pipeline in DATALAKE, mit Sequenz-Deduplizierung.

*Industrie-Gateway*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — Integrationsknoten, der zu Industrieprotokollen weiterleitet, mit einer echten Befehls-Allowlist-/Backpressure-Schicht.
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — echter OPC-UA-Adressraum, verifiziert mit einer echten Binärprotokoll-Client-Session.
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — echter MQTT-Broker mit optionaler Pro-Client-Authentifizierung und Topic-ACLs.
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — echte MTConnect-`/probe`- und `/current`-XML-Endpunkte mit Degraded-Mode-Ausgabe.

*Ergänzende Tools & Ökosystembetrieb*
- **[HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)** — Smart-Summaries- und Anomaly-Highlighting-Panels über DATALAKE/ANOMALY-DETECTOR, mit einem ehrlichen statistischen Fallback.
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — WearOS-Begleit-App mit haptischen Alarmmustern und einem Sprach-Relay zum gekoppelten Telefon (noch nicht auf einer physischen Uhr ausgeführt).
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — Firmware für ein Platinenmontagegestell mit echter Werkzeug-ID-Dekodierung und Smart-Idle-Vorheizlogik.
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — Firmware plus ein echter Python-Vision-Begleiter für einen Thermal-/RGB-Inspektionswerkzeugkopf.
- **[URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER)** — Desktop-Werkzeug, das die Repositories der URTC-Familie erkennt, installiert und aktualisiert, jeweils mit einer ausdrücklichen Aktion.
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — administratives Desktop-Tool, das jedes Repository in diesem Ökosystem entdeckt, klont und aktualisiert.
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** — Windows/Linux-Desktop-Tool, das ein flashbereites CM5-Image baut, vorgeladen mit den aktuellsten Versionen des Ökosystems, mit Ersteinrichtungs-Konfiguration für WLAN/Benutzer/SSH im Stil von Raspberry Pi Imager.
- **[HYDRA-UMC-OPS-AGENT](https://github.com/JuanenRac/HYDRA-UMC-OPS-AGENT)** — Wartungsvorfall-Koordinator: eine Edge-Rolle mit niedrigem Privileg sammelt einen bereinigten Inventar-/Gesundheits-Snapshot, eine Control-Plane-Rolle rendert ihn schreibgeschützt und bittet einen KI-Anbieter um einen Diagnosevorschlag - wendet nie einen Patch an und stellt nie etwas bereit.
- **[HYDRA-UMC-DEV-SERVER](https://github.com/JuanenRac/HYDRA-UMC-DEV-SERVER)** — reproduzierbarer Entwicklungshost (Raspberry Pi 5 / CM5), der den Quellcode des Ökosystems vorhält und begrenzte Build-/Test-Aufgaben über eine dauerhafte Warteschlange ausführt; eine dedizierte Entwicklerrolle, ausdrücklich kein operativer CM5.

---

## 📚 Dokumentation & Community

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Technologie-Stack und Coding-Richtlinien für einen Pull Request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — die in dieser Community erwarteten Verhaltensstandards.
- **[SECURITY.md](SECURITY.md)** — wie man eine Schwachstelle meldet, und die echten Sicherheitsschwerpunkte dieses Projekts.
- **[SUPPORT.md](SUPPORT.md)** — wo man Fragen stellt und Fehler meldet.
- **[LICENSE.md](LICENSE.md)** — die eigene Lizenz dieses Projekts.

## 👤 AUTOR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
