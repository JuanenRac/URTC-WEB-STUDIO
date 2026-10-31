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

### Die wichtigsten Abläufe des URTC-Flashers und -Testers in einem Browser-Tab, über einen USB-CAN-Adapter und Web Serial

<p align="center">
  <img src="https://img.shields.io/badge/Lizenz-GPL%203.0-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Tests-619-2ea44f.svg" alt="Tests">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>

---

**Ehrlichkeitscheck - was heute wirklich funktioniert:** `npm test` (Vitest) deckt die reine Logik ab: SLCAN-Parsing, Zuordnung von Anfrage und Antwort, Prüfungen von Firmware-Images und Manifesten, Werkzeuggrenzen, Bestätigungen, die Regeln, die den Simulator vom echten Bus trennen, den Trace-Export und die acht Oberflächensprachen. Die Oberflächen und der Web-Serial-Transport selbst haben keine Unit-Tests (die End-to-End-Prüfungen am Ende dieses Absatzes steuern sie gegen eine modellierte Platine), und nichts davon ist in dieser Umgebung gegen eine echte URTC-Platine gelaufen (hier gibt es keinen USB-CAN-Adapter zum Testen): Flasher Studio, Tester Studio und der CAN-Bus-Protokollanalysator sind echter Code, der nur durch diese Tests, die Typprüfung (`npm run lint`) und Code-Durchsicht verifiziert ist. Control/OLED/Specs-BOM/Thermal IR Inspection sind offen als Sandbox-Tabs gekennzeichnet, ohne jeglichen CAN-Verkehr. Siehe `CHANGELOG.md` für das, was bisher genau ausgeliefert wurde. `npm run test:e2e` öffnet außerdem die gebaute Seite in einem echten Browser (Playwright) gegen eine modellierte Platine: So werden die Offline-Kopie, der Verlauf der Thermik-Zähler und die gespeicherte Sitzung geprüft.

---

> **Stand von Sicherheit (Safety) und Security:** Dieses Ökosystem ist kein zertifiziertes Sicherheitssystem, und es existiert noch keine bestückte URTC-Platine. Die Bootloader prüfen Firmware-Images mit CRC32 und einem HMAC-SHA256 mit gemeinsamem Schlüssel, nicht mit einer asymmetrischen Signatur (geplant); die veröffentlichten Anwendungs-Images sind mit dem öffentlichen Entwicklungsschlüssel signiert (`signing_key_kind: dev`), sodass jeder ein vom Bootloader akzeptiertes Image erzeugen kann; an eine echte Platine wurde noch nichts gesendet. Lesen Sie die [Sicherheitsbasis](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) und das [Bedrohungsmodell](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md), bevor Sie sich für die Sicherheit einer Person auf eine Aussage hier verlassen.

## 📋 Auf einen Blick

| | |
|---|---|
| Version | `0.3.9` |
| Reifegrad | Funktionsfähig |
| Tests | 619 (`npm test`) |
| Technik | Web Serial API / TypeScript |
| Ziel | Ein Webbrowser auf dem PC des Benutzers |
| Auf echter Hardware | Nur simuliert: gegen Emulatoren, Attrappen oder Simulatoren getestet; für diese Version ist kein Lauf auf echter Hardware vermerkt |

**Springe zu:** [Überblick](#-überblick) · [Architektur](#-architektur) · [Funktionen](#-funktionen) · [Sicherheit](#-sicherheit-und-schutz) · [Schnittstellen](#-schnittstellen) · [Schnellstart](#-schnellstart) · [Tests](#-tests) · [Struktur](#-struktur-des-repositorys) · [Verwandte](#-verwandte-projekte)

<!-- urtc-section:status_web_studio -->
## 🚦 Projektstatus

🟢 fertig und überprüft · 🟡 funktioniert, mit bekannten Grenzen · 🟠 halb fertig oder nicht überprüft · 🔴 nicht gemacht oder funktioniert nicht. Nichts ist grün, wenn es nie auf echter Hardware lief.

| Teil | Status | Was das Repository belegen kann |
| --- | :---: | --- |
| Software | 🟡 | Läuft am PC und gegen den Simulator; nie an einer echten Platine ausgeführt. |
| Oberfläche | 🟡 | Das Fenster läuft und wird gegen eine simulierte Platine geprüft; nicht mit einem echten Adapter probiert. |
| Tests | 🟢 | Die Testsuite besteht bei jedem Push in der CI. |
| Echte Hardware | 🟠 | Noch kein Lauf an einer echten Platine: der Bankversuch steht noch aus. |
| Dokumentation | 🟡 | README in acht Sprachen und Referenzdokumente; die Übersetzungen wurden nicht von Muttersprachlern geprüft. |

<!-- /urtc-section:status_web_studio -->

## 🎯 Überblick

Ein browserbasierter Begleiter für den **Universal Robot Tool Controller (URTC)** -
eine React/Vite-Single-Page-App, die mit echter URTC-Hardware (bisher nie mit solcher betrieben) über einen
USB-CAN-Adapter via der [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
spricht, wobei dasselbe SLCAN-Framing und CAN-Protokoll wie bei den beiden
Desktop-Begleit-Tools verwendet wird, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) und
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). Das Ziel ist, die wichtigsten Abläufe dieser beiden Tools in einem einzigen Browser-Tab bereitzustellen, keine vereinfachte Demo davon; volle Funktionsparität ist noch nicht erreicht (siehe „Noch nicht abgedeckt“ weiter unten) - die Tabs Flasher Studio und Tester Studio senden
und empfangen die echten CAN-Frames, die in `docs/CANBUS.TXT` des
[URTC](https://github.com/JuanenRac/URTC)-Repository beschrieben sind.

### Was echt ist vs. was eine Sandbox ist

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

## 🧩 Rolle in URTC

URTC-WEB-STUDIO ist die Browser-Version der beiden Desktop-Programme von URTC, URTC-FLASHER und URTC-TESTER: eine React-Seite, die über einen USB-CAN-Adapter mit Web Serial mit einer URTC-Platine spricht, mit derselben SLCAN-Rahmung und demselben CAN-Protokoll (Tabellen und Vektoren werden aus URTC-COMMON erzeugt). Sie bringt deren wichtigste Abläufe in einen Browser-Tab, ohne etwas zu installieren, und überlässt SWD/JTAG, das kein Browser ansteuern kann, dem Desktop-Flasher. Dazu gibt es Sandbox-Tabs, die die 25 Werkzeuge offline erkunden und nichts senden.

## 🏛️ Architektur

<p align="center">
  <img src="images/architecture.svg" alt="Architektur von URTC-WEB-STUDIO: wer es nutzt, was es enthält und wovon es abhängt" width="100%">
</p>

Wie die Teile dieses Repositorys zusammenpassen: wer es nutzt, was es enthält und wovon es abhängt. Das Bild wird aus `docs/architecture.json` gezeichnet und gegen den Code geprüft.

### Technologie-Stack

- **Sprache:** TypeScript
- **Frontend-Framework:** React 18
- **Build-Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **CRC32:** `crc-32` - Integritätsprüfung des Firmware-Images, spiegelt die
  eigene CRC32-Berechnung des Bootloaders
- **Hardware-Transport:** Web Serial API + SLCAN-Framing (keine nativen
  Abhängigkeiten, kein begleitender Backend-Server)

## 🖼️ Screenshots

<!-- urtc-shots -->
Aufgenommen mit 1920×1080 auf einem Prüfstand, mit Beispieldaten und ohne eine echte Anlage dahinter.

<table>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/control.png" alt="Werkzeugmatrix und Steuerung: die 25 Werkzeugprofile der Firmware mit ihren Jumpern und die Bedienelemente des gewählten Werkzeugs (Simulator-Tab: sendet nichts auf den Bus)." width="100%"><br><sub>Werkzeugmatrix und Steuerung: die 25 Werkzeugprofile der Firmware mit ihren Jumpern und die Bedienelemente des gewählten Werkzeugs (Simulator-Tab: sendet nichts auf den Bus).</sub></td>
<td width="50%" valign="top"><img src="images/screenshots/oled.png" alt="OLED und Hardware-Monitor: der Statusbildschirm des Werkzeugs, die fünf Kennungs-Jumper, die Status-LED und der 8-LED-Ring (Simulator-Tab)." width="100%"><br><sub>OLED und Hardware-Monitor: der Statusbildschirm des Werkzeugs, die fünf Kennungs-Jumper, die Status-LED und der 8-LED-Ring (Simulator-Tab).</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/flasher.png" alt="Flasher: die Flash-Karte der Platine, das Image und sein Manifest versandbereit sowie die Optionen einer CAN-OTA-Aktualisierung (modellierte Platine; es wird nichts gesendet)." width="100%"><br><sub>Flasher: die Flash-Karte der Platine, das Image und sein Manifest versandbereit sowie die Optionen einer CAN-OTA-Aktualisierung (modellierte Platine; es wird nichts gesendet).</sub></td>
<td width="50%" valign="top"><img src="images/screenshots/thermal.png" alt="Thermische Inspektion: ein Falschfarbenbild eines 32×24-Infrarot-Arrays mit einem simulierten Hotspot (Simulator-Tab)." width="100%"><br><sub>Thermische Inspektion: ein Falschfarbenbild eines 32×24-Infrarot-Arrays mit einem simulierten Hotspot (Simulator-Tab).</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/tester.png" alt="Tester-Diagnose: die Blackbox und die thermischen Zähler im Zeitverlauf, gelesen von einer modellierten Platine." width="100%"><br><sub>Tester-Diagnose: die Blackbox und die thermischen Zähler im Zeitverlauf, gelesen von einer modellierten Platine.</sub></td>
<td width="50%"></td>
</tr>
</table>
<!-- /urtc-shots -->

## ✨ Funktionen

### Flasher Studio - echte Funktionsabdeckung

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

#### SWD/JTAG - von einem Browser aus per Design nicht verfügbar

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

### Tester Studio - echte Funktionsabdeckung

Portiert aus den Panels des eigenen Qt-Quick-Decks von `URTC-TESTER`
(`assets/qml/TesterDeck.qml`), gegen dieselben CAN-IDs:

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

- **Reiter Nachweise.** Er liest die Datensätze (`urtc-evidence/1`), die Flasher, Tester und Updater schreiben, aus den Dateien, die die Person auswählt (nichts wird hochgeladen), prüft jeden nach denselben Regeln und mit derselben Prüfsumme wie der gemeinsame Code und listet sie die neuesten zuerst auf, mit Filtern für Art, Ergebnis und Text, einer Zusammenfassung, dem Problem jedes ungültigen Datensatzes und einem CSV-Download; die Seite ist in den acht Sprachen verfügbar.

- **Frames aus reinen Funktionen.** Die Frames der Bedienfelder (Status-LED und -Ring, SPI-Durchleitung, optionale Funktionen, Düse und Extruder des 3D-Drucker-Kopfes, Schweißimpuls, Schrittmotorbewegungen) entstehen in `toolFrames.ts` und die des Firmware-Updates (START_UPDATE, die vier Signaturblöcke, die Image-Datenframes und END_UPDATE) in `flashFrames.ts`; ein Wert, der nicht in sein Feld passt, wird auf den nächsten passenden gebracht, und die Tests legen die Bytes fest.

- **Rack-Werkbank mit Antworten.** Das simulierte Rack beantwortet jeden Befehl mit seinem Antwortframe (eine Quittung oder eine Ablehnung mit Grund); `rackSim.ts` schreibt und liest ihn (`encodeRackReply`, `parseRackReply`), das Werkbank-Panel nennt den Grund in der Sprache der Seite, und ein wegen zu frühen Eintreffens zurückgehaltener Befehl ist wie in der Firmware eine Ablehnung mit Grund.

<!-- urtc-section:heads -->
### Mehrere Werkzeugköpfe an einem Bus

Die Firmware kann mehrere Werkzeugköpfe an einem CAN-Bus betreiben (die Multinode-Erweiterung). Sie ist **standardmäßig aus**, und ein Bus mit einem Kopf arbeitet genau wie bisher. Das Fenster **Köpfe** findet die Köpfe, listet jeden mit Adresse, Werkzeug und Seriennummer und zeigt seinen Zustand: bereit, ausgewählt, Adresskonflikt, Fehler gespeichert, im Bootloader oder verloren. Sie wählen einen aus, das Programm fragt nach einer Bestätigung und sendet erst danach etwas an diesen Kopf; solange mehrere Köpfe am Bus hängen, wird ein Befehl abgelehnt, bis einer ausgewählt ist und es bestätigt hat. Geht der ausgewählte Kopf verloren, wechseln alle Köpfe in ihren sicheren Zustand (ein Kontrollkästchen des Fensters schaltet das ab). Getestet wurde nur gegen ein Modell des Busses, nicht mit Platinen. Siehe `docs/MULTINODE.md` in URTC-COMMON.
<!-- /urtc-section:heads -->

## 🔒 Sicherheit und Schutz

| Bedrohung | Abwehr |
|---|---|
| Ein fehlerhafter Frame erreicht die Leitung oder den Bildschirm | Beide Richtungen der SLCAN-Verbindung werden geprüft: Ein Bezeichner außerhalb von `0x000`-`0x7FF`, Nutzdaten über 8 Bytes oder ein Byte außerhalb von `0x00`-`0xFF` werden vor dem Schreiben abgelehnt, und eine eingehende Zeile, die kein echter SLCAN-Frame ist, wird verworfen |
| Ein Geheimnis steckt in der Seite | Die App enthält keinen Signaturschlüssel: Flasher Studio sendet nur die Signatur, die der URTC-Build neben jedem Image veröffentlicht hat, sodass die Seite öffentlich gehostet werden kann |
| Ein falsches oder manipuliertes Firmware-Image | Ein Manifest, dessen `sha256` nicht zur Datei passt, blockiert das Flashen; jedes Image eines offiziellen Releases trägt eine Ed25519-Release-Signatur, die die Seite im Browser prüft, bevor sie das Image sendet |
| Eine simulierte Antwort wird für echt gehalten | Die Sandbox-Tabs senden nichts und antworten, solange eine Platine verbunden ist, nichts; ihre Frames sind mit SIM markiert, ein abgespielter Trace mit REPLAY |
| Eine Aktion auf der Platine aus Versehen | Laser, Bohrer, UV-Härtung, Schweißen, Heizungen, Bewegung, Pastenjetting, Schreibzugriffe auf den Platinenspeicher, riskante von Hand eingegebene Frames und ein mit dem öffentlichen Entwicklungsschlüssel signiertes Image verlangen vorher eine Bestätigung |
| Ein Aktor, der weiterläuft | Jedes Werkzeug mit Firmware-Watchdog wird durch erneutes Senden am Leben gehalten und abgeschaltet, wenn das Panel ersetzt wird, der Tab wechselt, die Platine getrennt oder die Seite geschlossen wird; STOP ALL schaltet alles ab, was die Seite am Leben hält |
| Eine Seite, die Code von anderswo lädt | Eine Content Security Policy: Skripte nur von der Seite selbst, Verbindungen nur zu sich selbst und zu GitHub |

STOP ALL ist ein Software-Befehl, kein Not-Halt, und keine der obigen Prüfungen ist eine Sicherheitsfunktion.

### Trennung vom Simulator und Bestätigungen (Software-Prüfungen, keine Sicherheitsfunktionen)

- Die Sandbox-Tabs (Control, OLED, Thermal IR) übertragen nichts. Ihre Frames sind mit SIM markiert, und solange eine Platine verbunden ist, erzeugen sie keine simulierte Antwort. Von den vordefinierten Nachrichten des Protokollanalysators werden an eine verbundene Platine nur einfache Abfragen gesendet; der Rest bleibt simuliert.
- Tester Studio zeigt ein Werkzeugpanel nur für das Werkzeug, das die Platine selbst gemeldet hat (`0x111`), und keines, bevor die Platine geantwortet hat.
- Laser, Bohrer, UV-Härtung, Schweißen, Heizungen, Bewegung, Pastendosierung, Schreibzugriffe auf den Platinenspeicher und riskante von Hand getippte Frames verlangen vorher eine Bestätigung.
- **ALLES STOPPEN** in der Kopfzeile (sichtbar bei bestehender Verbindung) schaltet jeden Aktor ab, den diese Seite am Leben hält; das Schließen der Seite und das Trennen tun dasselbe. Es ist ein Software-Befehl, kein Not-Halt.
- Das Flashen eines mit dem öffentlichen Entwicklungsschlüssel signierten Images verlangt vorher eine Bestätigung, weil dieser Schlüssel nichts darüber aussagt, wer das Image erstellt hat.
- Meldet die Platine einen kritischen Fehler, nennt das Banner auch den Grund des Schutzes gegen thermisches Durchgehen, sofern die Platine ihn meldet.
- **Wiedergabe eines aufgezeichneten Traces** (CAN Bus Protocol Analyzer): Eine `.trc`- oder `.asc`-Datei, etwa die vom Raw Bus Monitor exportierte, spielt ihre empfangenen Frames ohne Platine in das Protokoll und die Panels ein, mit 0,25x bis 10x und wahlweise in einer Schleife. Die Frames sind als REPLAY markiert, es wird nichts gesendet, eine Aufzeichnung beantwortet nie eine Anfrage, sie wird nie als Aussage der Platine exportiert, und die Wiedergabe pausiert, solange eine Platine verbunden ist.

### Sicherheitshinweis: kein Signierschlüssel in dieser App

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

Der Ordner liegt **nicht in git**: `npm run sync-firmware` legt ihn an (die CI und der Pages-Build führen es vor den Tests und dem Build aus). Solange es kein offizielles Release gibt, antwortet GitHubs „latest“ mit 404, und `firmware-release.json` nennt das stattdessen verwendete Release (heute das Bench-Pre-Release); löschen Sie die Datei oder ändern Sie ihren Tag, wenn ein offizielles veröffentlicht wird. **Sicherheit der Seite**: Skripte, Styles, Schriften und Bilder kommen von der Seite selbst (die Schriften sind mit der App ausgeliefert, es geht keine Anfrage an einen Schriftenserver), inline sind nur die Style-Attribute erlaubt, die React schreibt, und die Seite erreicht nur ihren eigenen Ursprung und die GitHub-Hosts, die die Releases ausliefern (Content-Security-Policy im gebauten `index.html`). Ein Host, der Header senden kann, nutzt `public/_headers` (dieselbe Richtlinie, `Permissions-Policy: serial=(self)` und nichts anderes Mächtiges); GitHub Pages kann keine Header senden, dort gilt nur die Richtlinie in der Seite.

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

## 🔌 Schnittstellen

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

### CAN-Frame-Validierung

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

## 🚀 Schnellstart

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

Die gebaute Seite deklariert eine Content-Security-Policy (Skripte nur von der Seite selbst; Verbindungen nur zu ihr selbst und zu GitHub) und lädt jeden Tab beim ersten Öffnen. `npm run test:e2e` steuert sie in einem echten Chromium gegen eine modellierte Platine; mit einem echten Adapter wurde sie nicht ausprobiert.

<!-- urtc-section:compatibility -->
### Voraussetzungen und Kompatibilität

Welche Versionen der URTC-Programme zusammenarbeiten und welche Protokollversion jede spricht, steht in der Kompatibilitätstabelle, die URTC-COMMON erzeugt: [docs/COMPATIBILITY.md](https://github.com/JuanenRac/URTC/blob/main/docs/COMPATIBILITY.md). Die Notizen einer Version der Repositories, die `tools/changelog_section.py` mitführen (die Firmware, der Flasher, der Tester und der Updater), sind der Abschnitt des CHANGELOG dieser Version, gefolgt von dieser Tabelle: `python tools/changelog_section.py VERSION --compat`.
<!-- /urtc-section:compatibility -->

## 🧪 Tests

`npm test` (Vitest) führt 619 Tests der reinen Logik aus: SLCAN-Parsing, Zuordnung von Anfragen und Antworten, Prüfungen von Firmware-Images und Manifesten, Release-Signaturen, Werkzeuggrenzen, Bestätigungen, die Regeln, die den Simulator vom echten Bus trennen, Trace-Export und -Wiedergabe, die Knotenauswahl, den Rack-Simulator, die gespeicherte Sitzungsaufzeichnung, die Offline-Kopie, die Firmware-Synchronisierung und die acht Oberflächensprachen. `npm run lint` prüft die Typen des Quelltexts, und `npm run test:e2e` führt 19 End-to-End-Prüfungen in einem echten Chromium gegen einen modellierten Adapter und eine modellierte Platine aus (`npm run test:coverage` fügt eine Abdeckungsschwelle hinzu). Die Bildschirme und der Web-Serial-Transport haben keine eigenen Unit-Tests; die End-to-End-Prüfungen steuern sie an. Nichts davon lief gegen einen echten Adapter oder eine echte Platine.

## 🏗️ Build und Veröffentlichung

### GitHub Pages (ausgeschaltet, bis der Eigentümer es einschaltet)

Das Repository kann die gebaute Seite auf GitHub Pages veröffentlichen (Workflow `.github/workflows/pages.yml`: `npm ci`, Typprüfung, Tests, `npm run build` mit dem Projekt-Basispfad, dann `upload-pages-artifact` und `deploy-pages`). **Der Workflow ist ausgeschaltet**: Beide Jobs laufen nur, wenn die Repository-Variable `URTC_PAGES_ENABLED` auf `true` steht (Settings > Secrets and variables > Actions > Variables), was der Eigentümer nach dem ersten signierten offiziellen Release von URTC setzt. Der Build führt dann `npm run sync-firmware -- --require-official` aus: Er nimmt nur die Firmware des neuesten offiziellen Releases (nie ein Pre-Release, nie das Ersatz-Tag aus `firmware-release.json`), lehnt jede Datei ohne gültige Release-Signatur und jedes Anwendungs-Image ab, das mit dem öffentlichen Entwicklungsschlüssel gebaut wurde; die veröffentlichte Seite kann also keine Images des Entwicklungsschlüssels enthalten. Pages selbst muss einmal aktiviert werden (Settings > Pages > Source: GitHub Actions); ohne die Variable wird der Workflow übersprungen. Web Serial braucht einen Chromium-basierten Browser und https, was Pages bietet.

Die `version` von `package.json` und die von `urtc.project.json` ändern sich nur durch einen ausdrücklichen Schritt (`python bump.py`, der beide gleich hält und den Eintrag im Changelog schreibt); `build.bat` / `build.sh`, `npm run build`, `npm run dev`, `npm run lint` und `npm run preview` ändern die Version nie.

## 📂 Struktur des Repositorys

<p align="center">
  <img src="images/repository-structure.svg" alt="Struktur des Repositorys URTC-WEB-STUDIO" width="100%">
</p>

<details>
<summary>Textversion des Baums</summary>

```text
URTC-WEB-STUDIO/
├── src/                                           die App: Komponenten, Hooks, die CAN-, SLCAN- und Firmware-Logik, die acht Sprachdateien und erzeugte Tabellen
├── docs/                                          Architektur, Build und Betrieb, Integrationsvertrag
├── e2e/                                           End-to-End-Prüfungen und das Modell der Platine
├── public/                                        mitgeliefertes Firmware, Header, Web-Manifest
├── scripts/                                       Firmware-Synchronisierung und Service Worker
├── tools/                                         Build-Prüfung und gemeinsame Werkzeuge
├── images/                                        Banner und Bilder dieses READMEs
├── .github/                                       CI-Workflow sowie Vorlagen für Issues und Pull Requests
├── build.sh build.bat                             Build-Skripte
├── build-test.sh build-test.bat                   Build- und Testskripte, die im Repository nichts ändern
├── test.sh test.bat                               führen die Tests aus
├── urtc.project.json                              Manifest: Version, Rolle, Reifegrad und Build-Befehl
├── CHANGELOG.md                                   was sich in jeder Version geändert hat
├── SECURITY.md SUPPORT.md LICENSE                 Sicherheitsrichtlinie, Support und Lizenz
├── CONTRIBUTING.md CODE_OF_CONDUCT.md             wie man mitwirkt, und der Verhaltenskodex
├── .gitattributes .gitignore                      Git-Einstellungen
├── dev.sh dev.bat                                 installieren und den Entwicklungsserver starten
├── bump.py bump_manifest_version.py               Skripte, die die Version erhöhen
├── index.html                                     Einstiegsseite von Vite
├── package.json package-lock.json tsconfig.json   Pakete, feste Versionen, TypeScript und Vite
├── playwright.config.ts vite.config.ts            Einstellungen der End-to-End-Prüfungen
├── playwright.screenshots.config.ts               Playwright-Einstellungen für die Screenshots des README
├── urtc_i18n.lock.json                            Sperre der erzeugten Sprachdateien
└── NOTICE LICENSE.md                              Urheberrechtshinweis und Dokumentationslizenz
```

</details>

Die kommentierte Liste jeder Quelldatei, eine Zeile je Datei, steht in [docs/SOURCE_MAP.md](docs/SOURCE_MAP.md).

## 🗺️ Roadmap und bekannte Grenzen

- Ein reiner Mithörmodus und die manuelle Wahl der Bitrate: Ein Bus, auf dem keine Platine antwortet, lässt sich nicht aufschalten.
- Das Auslesen des Wärmebilds prüft nicht vorab, ob der Sensor bereit ist, und wiederholt keinen verlorenen Block.
- Eine Firmware-Datei direkt aus dem GitHub-Release im Browser herunterladen: GitHub liefert Release-Dateien von einem Host ohne CORS-Header aus, der Download kann daher blockiert sein (das mitgelieferte Image oder eine von der Festplatte gewählte Datei mit ihrer `.manifest.json` funktionieren immer).

## 🌍 Sprachen

README und Texte gibt es auf Englisch, Spanisch, Französisch, Italienisch, Deutsch, Chinesisch, Japanisch und europäischem Portugiesisch. Die Namen von Chinesisch und Japanisch in der Sprachliste sind wie die der anderen Sprachen in ihrer eigenen Sprache geschrieben.

## 🔗 Verwandte Projekte

URTC besteht aus unabhängigen Repositories mit jeweils eigener Version, eigenen Tests und eigenem README. Das ist die Familie, nach Gruppen:

* **URTC Tool Platform:**
  * [URTC](https://github.com/JuanenRac/URTC) - Firmware der Werkzeugkopf-Platine (25 Werkzeugprofile, CAN-Bootloader) und die Referenz des CAN-Protokolls.
  * [URTC-COMMON](https://github.com/JuanenRac/URTC-COMMON) - das CAN-Protokoll einmal als Daten geschrieben (Spezifikation, erzeugte Tabellen, Konformitätsvektoren) und der Code, den die Programme teilen.
  * [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER) - Desktop-Werkzeug, das die Platinen-Firmware über CAN oder über SWD/JTAG aktualisiert.
  * [URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY) - Gateway vor dem CAN-Bus: lässt nur gelistete Kennungen durch, begrenzt ihre Rate und verlangt einen Sitzungsschlüssel.
  * [URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK) - hardwareunabhängige C-Logik und Befehlsprotokoll für eine Werkzeugablage mit Vorheizen und Lebenszyklusverfolgung.
  * [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER) - Desktop-Live-Tester für den CAN-Bus, der die Bedienelemente und die Telemetrie des von einer Platine gemeldeten Werkzeugprofils zeigt.
  * [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL) - Sensorrahmen-Protokoll in C und ein Python-Thermo-/RGB-Begleiter für einen Inspektions-Werkzeugkopf.
  * **URTC-WEB-STUDIO** (dieses Repository) - Browser-App, die die Platine über Web Serial und SLCAN flasht und testet, ohne Installation.
* **Ecosystem Operations:**
  * [URTC-DEVTOOLS](https://github.com/JuanenRac/URTC-DEVTOOLS) - die gemeinsamen Repository-Werkzeuge der Familie als versionierter Satz, mit einer Sperrdatei, die eine bearbeitete von einer veralteten Kopie unterscheidet.
  * [URTC-DOCS](https://github.com/JuanenRac/URTC-DOCS) - Architektur, Schnittstellen, Sicherheitsbasis und erzeugter Katalog des Ökosystems sowie die Werkzeuge, die alle Repositories vergleichen.
  * [URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER) - Desktop-Werkzeug, das die Repositories der URTC-Familie erkennt, installiert und aktualisiert, jeweils eine ausdrückliche Aktion.

**Schwesterprojekte (unabhängig, mit derselben Basis und denselben Werkzeugen):**

* **[HYDRA-UMC-DOCS](https://github.com/JuanenRac/HYDRA-UMC-DOCS)** - Schwesterprojekt: das Dokumentationszentrum von HYDRA-UMC, einem unabhängigen Ökosystem, das Basis und Werkzeuge mit diesem teilt
* **[ARMOR-DOCS](https://github.com/JuanenRac/ARMOR-DOCS)** - Schwesterprojekt: das Dokumentationszentrum von A.R.M.O.R., dem Sicherheits-Ökosystem, ebenfalls unabhängig und auf derselben Basis
* **[JuanenRac](https://github.com/JuanenRac/JuanenRac)** - das Profil und das Status-Dashboard aller Ökosysteme

## 📚 Dokumentation

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

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Technologie-Stack und Coding-Richtlinien für einen Pull Request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — die in dieser Community erwarteten Verhaltensstandards.
- **[SECURITY.md](SECURITY.md)** — wie man eine Schwachstelle meldet, und die echten Sicherheitsschwerpunkte dieses Projekts.
- **[SUPPORT.md](SUPPORT.md)** — wo man Fragen stellt und Fehler meldet.
- **[LICENSE.md](LICENSE.md)** — die eigene Lizenz dieses Projekts.

## 🤝 Mitwirken und Community

* Führe vor einem Pull Request `URTC_CI=1 python tools/ci_validate.py` aus: es muss bestehen. Siehe [CONTRIBUTING.md](CONTRIBUTING.md) und den [Verhaltenskodex](CODE_OF_CONDUCT.md).
* Das README gibt es in acht Sprachen: Eine Textänderung wird in allen acht Dateien vorgenommen, und die mit anderen Repositorys geteilten Abschnitte schreibt `tools/readme_sections.py` von URTC-COMMON.
* Eine Änderung am CAN-Protokoll beginnt in URTC-COMMON (`spec/can_protocol.json`) und gelangt über die geprüfte Kopie in dieses Repository.
* Beschreibe nichts als auf einer Platine funktionierend, was nur gebaut wurde.
* Melde eine Schwachstelle privat: [SECURITY.md](SECURITY.md). Fragen, Ideen und Meldungen: electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTOR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

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

**Tabs Blackbox, Optionale Funktionen, Rack-Prüfstand und Wärmebild (neu, nur mit Attrappen geprüft):** Tester Studio liest den Fehlerrekorder (`0x1A8` / `0x1A9`) und lädt ihn als CSV oder JSON herunter, bei eingeschalteter Option automatisch einmal für jeden gemeldeten Fehler; schaltet die optionalen Firmware-Funktionen (`0x1AE` / `0x1AF`, standardmäßig aus, nach einer Bestätigung; wirksam nach dem nächsten Einschalten); simuliert das Werkzeug-Rack auf der Seite, mit der Identität jedes Kopfes (Typ und Seriennummer); und zeichnet das Wärmebild der thermischen Inspektion in Falschfarben (ein simuliertes Bild sagt das). Der Werkzeugkatalog stammt jetzt aus den gemeinsamen Werkzeugprofilen von URTC-COMMON. Nichts davon wurde mit einer echten Platine ausprobiert.

**Black-Box-Anzeige (neu, nur mit Tests geprüft):** Der Tab Black Box zeichnet die gemessene Temperatur und den Sollwert der aufgezeichneten Sekunden vor dem Fehler, mit einer Linie dort, wo das Fehlerflag zum ersten Mal erscheint, und öffnet einen früher gespeicherten Datensatz (die JSON- oder CSV-Datei, die der Tab selbst schreibt) ohne angeschlossene Platine; eine Datei, die kein Datensatz ist, einen Wert außerhalb des Bereichs oder mehr als 67 Messwerte enthält, wird mit Begründung abgelehnt.

**Offline-Kopie und Installation (neu, nur mit Tests und einem Browser geprüft):** Der Build schreibt einen Service Worker (`sw.js`) und ein Web-App-Manifest; nach dem ersten Besuch über https (oder auf localhost) speichert der Browser die Seite, ihre Skripte und die mitgelieferte Firmware, die Kopfzeile zeigt **Offline nutzbar**, und das Studio öffnet sich ohne Netzwerk (die Kopfzeile zeigt dann **Offline**); wo der Browser es anbietet, installiert die Schaltfläche **Installieren** das Studio als Anwendung. Die Seite und das Firmware-Manifest werden immer zuerst aus dem Netz geholt, sodass wer online ist die neuesten erhält; `version.json` wird nie aus der Kopie beantwortet; eine neue Version wartet, bis die offenen Tabs geschlossen sind, bevor sie übernimmt. Die GitHub-API wird nicht gespeichert: ohne Netz lässt sich die neueste Release nicht abfragen, es werden nur die mitgelieferten Images verwendet.

**Thermik-Zähler im Zeitverlauf (neu, nur mit Tests und einer modellierten Platine geprüft):** Im Tab Blackbox können die Thermik-Zähler über die Lebensdauer (`0x1AA` / `0x1AB`) alle 10 s, 30 s, 1 min oder 5 min erneut gelesen werden; jede Messung kommt in einen im Browser gespeicherten Verlauf, der die Heizstunden und die Fehler über die Zeit zeichnet, als CSV heruntergeladen und gelöscht werden kann; sinkt ein Zähler (andere Platine), beginnt der Verlauf neu.

**Gespeicherte Sitzung (neu, nur mit Tests und einer modellierten Platine geprüft):** Der Bus-Monitor speichert die Frames als Log und als Datensatz, der das Log über seinen SHA-256 und seine Größe benennt, im selben Format wie der Desktop-Tester; **Gespeicherte Sitzung prüfen** nimmt den Datensatz und sein Log und sagt, ob sie zusammengehören. Es zeigt, dass ein Log nicht bearbeitet wurde. Wo der Browser Ed25519-Signaturen erzeugen kann, trägt der Datensatz außerdem eine Signatur mit einem Schlüssel dieses Browsers (beim ersten Gebrauch erzeugt und im Browser gespeichert): Sie zeigt, dass der Datensatz nach dem Signieren nicht bearbeitet wurde, und sagt nicht, wer den Schlüssel besitzt. Der Monitor kann außerdem nur die eingegebenen IDs oder nur Frames mit geänderten Daten zeigen (Rate und Last zählen weiter jeden Frame).

**Versionshinweis (neu, nur mit Tests geprüft):** Der Build schreibt eine `version.json` neben die Seite; die gebaute Seite vergleicht sie beim Öffnen einmal und nur über denselben Ursprung mit ihrer eigenen Version und meldet, wenn eine höhere ausgeliefert wird, mit einer Schaltfläche zum Neuladen. Nichts lädt von selbst neu, eine gleiche oder ältere Version meldet nichts, und eine fehlende Datei oder fehlendes Netz bleiben stumm.

**Heizer-PID (im Tab Optionale Funktionen; neu, nur mit Attrappen geprüft):** Tester Studio liest den Zustand des Heizer-PID der Firmware (`0x1B9` / `0x1BA`: die gültigen Verstärkungen, den Zustand und den Ausgang des letzten Regelzyklus), speichert Verstärkungen (0 bis 600) und startet oder bricht den Relais-Autotune ab, der die Spitze um den aktuellen Sollwert des Lötkolbens (100 bis 445 C) heizt und die gefundenen Verstärkungen speichert. Verstärkungen speichern und den Autotune starten verlangen eine Bestätigung, das Abbrechen nicht; eine Verstärkung, die keine Zahl von 0 bis 600 ist, wird vor dem Senden abgelehnt. Die Funktion muss vorher bei den optionalen Funktionen eingeschaltet werden; nichts davon wurde mit einer echten Platine ausprobiert.
