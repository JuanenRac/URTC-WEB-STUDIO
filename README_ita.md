<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

<p align="center">
  <a href="README.md">🇺🇸 English</a> |
  <a href="README_spa.md">🇪🇸 Español</a> |
  <a href="README_fra.md">🇫🇷 Français</a> |
  🇮🇹 <b>Italiano</b> |
  <a href="README_deu.md">🇩🇪 Deutsch</a> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  <a href="README_jpn.md">🇯🇵 日本語</a>
</p>


<p align="left">
  <img src="https://img.shields.io/badge/Licenza-GPL%203.0-blue.svg" alt="GPL 3.0">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>


Un compagno basato su browser per l'**Universal Robot Tool Controller (URTC)** - una
app a pagina singola React/Vite che parla con hardware URTC reale tramite un
adattatore USB-CAN via la [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
usando lo stesso framing SLCAN e lo stesso protocollo CAN dei due strumenti compagni
da desktop, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) e
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). L'obiettivo è la parità di
funzionalità con questi due strumenti all'interno di un'unica scheda del browser, non
una demo semplificata di essi - le schede Flasher Studio e Tester Studio inviano e
ricevono le trame CAN reali descritte in `docs/CANBUS.TXT` del
[repository firmware di URTC](https://github.com/JuanenRac/URTC).

---

## 🧭 Cosa è reale e cosa è una sandbox

Questa app ha due tipi di schede:

- **Schede reali, guidate dall'hardware** - Flasher Studio, Tester Studio, e il CAN
  Bus Protocol Analyzer. Queste fanno qualcosa solo dopo che hai collegato un
  adattatore USB-CAN reale (pulsante nell'intestazione in alto a destra); ogni
  comando che inviano e ogni lettura che mostrano proviene dal bus CAN reale. Questo
  include la **lettura reale della termocamera** - il pannello "Thermal Inspection"
  di Tester Studio (`0x250`/`0x251`/`0x254`/`0x255`) interroga l'array IR MLX90640
  reale della testa utensile via CAN.
- **Schede sandbox offline** - Control (catalogo utensili), OLED, Specs/BOM, e
  Thermal IR Inspection. Queste ti permettono di esplorare il catalogo dei 25
  utensili, visualizzare in anteprima le schermate di stato OLED, sfogliare
  BOM/pinout, e vedere un feed simulato di termocamera, tutto senza alcun hardware
  collegato. L'interruttore "FW v0.0 / v0.1" nell'intestazione influisce solo su
  queste schede sandbox (quali profili utensile sbloccherebbe una determinata build
  firmware) - non ha alcuna relazione con ciò che riporta una scheda reale
  collegata.
  - **Non confondere le due viste termiche**: la scheda autonoma "Thermal IR
    Inspection" (`ThermalCameraViewer.tsx`) è rumore `Math.random()` al 100% lato
    client, senza alcun traffico CAN - è un mockup di interfaccia, non una lettura
    di sensore. I dati reali MLX9064x appaiono solo all'interno del pannello
    "Thermal Inspection" di Tester Studio, e solo una volta collegato l'hardware.

## 🔌 Hardware necessario

- Un adattatore USB-CAN con firmware **SLCAN** (es. un CANable con
  `candlelight`/`slcan`, o qualsiasi adattatore che parli il protocollo seriale
  SLCAN `lawicel` standard) - la stessa classe di adattatore supportata da entrambi
  gli strumenti desktop tramite il proprio transporto Serial.
- Il bus impostato a **500 kbit/s** (questa app non rileva automaticamente il
  bitrate come fa il flag `--auto-detect` degli strumenti desktop; apre sempre a
  500k).
- Un browser con supporto Web Serial - **Chrome o Edge**. Firefox e Safari non
  implementano Web Serial e non potranno connettersi affatto.
- Web Serial richiede un contesto sicuro (HTTPS) o `localhost` - e non può essere
  usato da dentro un iframe. Se stai visualizzando in anteprima questa app dentro un
  frame incorporato, aprila prima nella sua scheda dedicata.

## ⚡ Flasher Studio - copertura reale delle funzionalità

Portato dal proprio `flasher_protocol.py` di `URTC-FLASHER`, contro gli stessi CAN
ID:

- **Aggiornamento CAN-OTA della scheda principale** (`0x7F0`-`0x7F7`): trigger di
  ingresso nel bootloader, firma HMAC-SHA256, trasferimento paginato con controllo
  di flusso via ACK di pagina e retry/backoff, CRC32 + END_UPDATE con versione
  dichiarata, e gestione dello stato terminale (incluso il recupero da una trama di
  conferma persa nello stesso modo dello strumento desktop - interroga di nuovo la
  versione invece di segnalare un falso fallimento).
- **Aggiornamento CAN-OTA dello slave di espansione** (`0x210`-`0x219`, inoltrato
  tramite il proprio bridge I2C della scheda principale) - stesso schema di
  firma/CRC, nessun ACK di pagina né heartbeat su questo percorso (corrisponde al
  protocollo reale; il progresso viene interrogato, non spinto).
- **Autorizzazione al downgrade** (`0x7FD`) - una casella protetta da conferma che
  autorizza il tentativo corrente a bypassare il controllo anti-rollback del
  bootloader, per un ritorno deliberato a una release più vecchia.
- **Cancellazione F-RAM prima del flash** (`0x192`), opzionale, solo scheda
  principale.
- **Interrogazione contatore errori CAN** (`0x7FB`/`0x7FC`, TEC/REC letti
  direttamente dai registri di errore propri del controller CAN) - distingue un
  vero problema di bus da uno lato applicazione/bootloader.
- **Rilettura/backup firmware via CAN** (`0x7FE`/`0x7FF`) - legge il contenuto
  attuale dello slot principale prima che tu lo sovrascriva, al ritmo di 2KB/pagina
  con ACK dell'host, e lo salva come download `.bin`.
- **Interrogazione versione scheda dal vivo** (`0x7F8`/`0x7F9`/`0x7FA`) - mostra il
  vero rispondente (app o bootloader), HardwareID, e versione, non un interruttore
  simulato.
- **Supporto sidecar `<file>.manifest.json`** - flashando un file arrivato
  dall'elenco firmware GitHub (o dalla cartella locale `public/firmware/`), la
  versione dichiarata di un manifest corrispondente ha priorità nel riportare cosa
  si sta installando, e il suo `sha256` (se presente) viene controllato come
  avviso di sanità precoce e non bloccante - stesso comportamento del
  `_check_manifest` dello strumento desktop.
- **Configurazione scheda**: tipo di scheda di espansione / variante sensore
  MLX9064x / configurazione utensile libero (pin ID `11111`) / info periferiche e
  numero di serie - `0x1A0`-`0x1A7`.

### SWD/JTAG - non disponibile da un browser, per design

Non esiste alcuna API web capace di pilotare una sonda di debug SWD/JTAG - Web
Serial parla solo con dispositivi a framing seriale (come un adattatore USB-CAN),
non con il protocollo proprio di una sonda, e STM32CubeProgrammer/pyOCD sono
sottoprocessi nativi che lo strumento desktop lancia. Questa è una limitazione
strutturale dell'eseguire in una sandbox browser, non una funzionalità mancante
qui. La scheda SWD/JTAG in Flasher Studio spiega i comandi esatti che lo strumento
desktop `URTC Flasher` eseguirebbe localmente, come riferimento - usa quello
strumento direttamente per la programmazione a chip completo, i controlli
option-byte/RDP, o un backup completo della flash prima di una cancellazione di
massa.

## 🧰 Tester Studio - copertura reale delle funzionalità

Portato dai propri `tester_tool_panels.py` /
`tester_common_panels.py` di `URTC-TESTER`, contro gli stessi CAN ID:

- Un pannello per utensile (saldatore + alimentatore filo, utensili di movimento a
  motore passo-passo semplice condivisi, pickup a vuoto, trapano, AOI, laser,
  riscaldatore/movimento/ventole stampante 3D, sonda di scansione, elettromagnete,
  saldatore a punti/ultrasuoni, sonda flying incl. il percorso avanzato ADS1115,
  cura UV, rework ad aria calda, crimpatura, ispezione termica, dispensazione
  pasta), ciascuno inviando i byte di comando reali dell'utensile e decodificando
  la sua telemetria reale.
- **Casella attiva + keepalive** per ogni utensile con un watchdog di comunicazione
  lato firmware (saldatore, laser, cura UV, rework ad aria calda, ugello stampante
  3D - reinvio ogni 150ms sotto un watchdog di 250ms; ventola strato stampante 3D -
  reinvio ogni 400ms sotto il proprio watchdog di 1000ms), corrispondendo
  esattamente al timing proprio dello strumento desktop.
- **Global Controls** (`0x100`), passthrough SPI di **Expansion Board** + query TMC
  DIAG0 (`0x180`-`0x183`), query/cancellazione **F-RAM** (`0x190`-`0x192`),
  **Self-Test** (controlli sicuri, a riposo, per utensile), un **Raw Bus Monitor**
  con esportazione traccia `.trc`/`.asc`, e un iniettore **Custom Frame** con un
  intervallo di ripetizione opzionale - validato allo stesso modo del proprio
  iniettore di trame del CAN Bus Protocol Analyzer: l'ID è mascherato al range
  standard CAN di 11 bit, e i token dati sono filtrati a byte esadecimali validi
  prima di essere limitati agli 8 byte massimi del payload CAN.
- **Detect Hardware** interroga il vero utensile attivo (`0x110`/`0x111`) e la
  versione scheda (`0x7F8`/`0x7F9`), e un errore critico dichiarato (`0x111` byte
  1) appare come banner di guasto dal vivo.

## 🔐 Nota di sicurezza: la chiave di firma OTA

Come lo `URTC Flasher` da desktop, questa app viene distribuita con la chiave di
firma HMAC-SHA256 predefinita del progetto committata nel codice sorgente
(`src/lib/flasher.ts`) - la chiave anti-manomissione propria del bootloader che
determina se un aggiornamento CAN-OTA viene accettato. Questa è una corrispondenza
intenzionale con la convenzione propria dello strumento desktop (l'`HMAC_KEY` di
`flasher_config.py`, a sua volta sovrascrivibile tramite una configurazione locale
non committata), non una svista. Viene con un avvertimento specifico dell'esecuzione
come **app web**: a differenza di un eseguibile desktop scaricato, chiunque carichi
questa pagina può leggere la chiave direttamente dal bundle JS distribuito - non
c'è modo per un'app statica lato client di mantenere un segreto di firma privato
dai propri visitatori. Se ruoti la chiave di firma reale per un deployment di
produzione, distribuisci questa app solo in un posto di cui controlli l'accesso
(una rete interna, VPN, o host con accesso limitato), oppure trattala come
tratteresti la consegna dello stesso strumento Flasher da desktop - a tecnici
autorizzati, non a internet pubblica.

## 🚀 Per iniziare

### Prerequisiti
- Node.js (v18+)
- npm

### Installazione

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### Modalità sviluppo

Esegue l'app con il dev server di Vite e il live-reload:
- **Windows:** doppio clic su `dev.bat` o esegui `npm run dev`
- **Linux/Mac:** esegui `./dev.sh` o `npm run dev`

Poi apri `http://localhost:3000` in Chrome o Edge.

### Build di produzione

Compila in un bundle statico e ottimizzato in `dist/`:
- **Windows:** doppio clic su `build.bat` o esegui `npm run build`
- **Linux/Mac:** esegui `./build.sh` o `npm run build`

Questo è un sito statico semplice - non c'è alcun componente server incluso (a
differenza del proprio `server.ts` di `HYDRA-UMC STUDIO`). Visualizza in anteprima
la cartella `dist/` compilata localmente con:

```bash
npm run preview
```

oppure servi `dist/` con qualsiasi host di file statici a tua scelta. `npm run
lint` esegue il compilatore TypeScript in modalità solo-controllo.

### Versionamento

Il `version` di `package.json` viene incrementato automaticamente a ogni
`npm run build` reale (collegato come script `prebuild`, che esegue
`scripts/bump-version.mjs`) - `npm run dev`/`lint`/`preview` non lo toccano
mai. Non è Semantic Versioning: è un contachilometri in base 10. La cifra
patch aumenta di 1; quando supererebbe 9, si azzera e la cifra minor
aumenta al suo posto (`0.1.9` -> `0.2.0`, mai `0.1.10`); lo stesso riporto
si propaga da minor a major. Vedi `CHANGELOG.md` per la cronologia delle
versioni e un riepilogo del lavoro passato su questo progetto.

## 🛠️ Stack tecnologico
- **Linguaggio:** TypeScript
- **Framework frontend:** React 18
- **Strumento di build:** Vite
- **Stile:** Tailwind CSS
- **Icone:** Lucide React
- **CRC32:** `crc-32` - controllo di integrità dell'immagine firmware, rispecchia
  il calcolo CRC32 proprio del bootloader
- **Trasporto hardware:** Web Serial API + framing SLCAN (nessuna dipendenza
  nativa, nessun server backend compagno)

## 📂 Struttura del repository

```
/
├── src/
│   ├── App.tsx                     Componente radice - stato schede, stato
│   │                                hardware, log delle trame CAN, e gli
│   │                                handler collegati a ogni scheda sotto
│   │                                (incluso l'avvio/rilettura CAN OTA e il
│   │                                proprio iniettore di trame del CAN Bus
│   │                                Analyzer)
│   ├── main.tsx                    Entry point Vite/React
│   ├── i18n.ts                     Configurazione i18next - en/es/de/fr/it,
│   │                                persistita in localStorage
│   ├── index.css                   Entry point Tailwind
│   ├── types.ts                    Tipi TypeScript condivisi (CanFrame,
│   │                                HardwareState, FlasherState,
│   │                                ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Dichiarazioni di tipo ambientali proprie di
│   │                                Vite
│   ├── components/
│   │   ├── Header.tsx               Barra superiore: pulsante
│   │   │                            connetti/disconnetti, nome utensile attivo,
│   │   │                            interruttore sandbox FW v0.0/v0.1
│   │   ├── Sidebar.tsx              Navigazione a sinistra - le 7 schede
│   │   │                            descritte in questo README
│   │   ├── ToolCatalog.tsx          Scheda sandbox: il catalogo dei 25 utensili,
│   │   │                            selezione utensile, controllo setpoint
│   │   ├── OledDisplay.tsx          Scheda sandbox: anteprima schermate di
│   │   │                            stato OLED
│   │   ├── SpecsAndBomViewer.tsx    Scheda sandbox: navigatore BOM/pinout
│   │   ├── ThermalCameraViewer.tsx  Scheda sandbox: feed simulato MLX90640 -
│   │   │                            100% Math.random(), nessun traffico CAN
│   │   │                            (vedi "Cosa è reale e cosa è una sandbox"
│   │   │                            sopra)
│   │   ├── HardwarePanel.tsx        Pannello sandbox di controllo
│   │   │                            jumper/LED/scheda di espansione, usato
│   │   │                            dentro le schede Control e OLED
│   │   ├── CanBusAnalyzer.tsx       Scheda reale: log trame CAN grezze,
│   │   │                            iniettore trama personalizzata, trigger di
│   │   │                            comando predefiniti
│   │   ├── FlasherStudio.tsx        Scheda reale: interfaccia CAN-OTA
│   │   │                            (principale + slave di espansione) e lo
│   │   │                            spiegatore di capacità SWD/JTAG
│   │   ├── TesterStudio.tsx         Scheda reale: controllo/telemetria dal vivo
│   │   │                            per utensile, costruita dalla cartella
│   │   │                            tester/ sotto
│   │   └── tester/
│   │       ├── ToolPanels.tsx       Un pannello per profilo utensile - byte di
│   │       │                        comando reali, decodifica telemetria reale,
│   │       │                        keepalive watchdog per utensile
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor, iniettore
│   │       │                        Custom Frame
│   │       └── shared.tsx           Primitive UI condivise (Section, Field,
│   │                                classi bottone/input, safeInt)
│   ├── data/
│   │   └── toolsData.ts             I 25 TOOL_PROFILES - nomi, default, icone
│   │                                per le schede sandbox
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Trasporto Web Serial + SLCAN -
│   │   │                            connetti/disconnetti, TX/RX trame,
│   │   │                            waitForFrame per ID con un buffer rx
│   │   │                            limitato e un cap di coda di 500 trame
│   │   ├── useFlasher.ts            Macchina a stati CAN-OTA (scheda principale
│   │   │                            + slave di espansione), rispecchia
│   │   │                            flasher_protocol.py
│   │   └── useKeepalive.ts          Hook di reinvio a intervallo fisso che
│   │                                sostiene il keepalive watchdog della
│   │                                casella attiva di ogni utensile
│   ├── lib/
│   │   ├── flasher.ts               Costanti del protocollo OTA, la chiave di
│   │   │                            firma HMAC-SHA256 committata, helper
│   │   │                            CRC32/HMAC, parsing manifest
│   │   └── canIds.ts                Costanti CAN ID per Tester Studio -
│   │                                 rispecchia tester_config.py byte per byte
│   └── locales/                     Stringhe UI - en.json, es.json, de.json,
│                                     fr.json, it.json, ja.json, zh.json
├── scripts/
│   └── bump-version.mjs             Script di incremento versione senza dipendenze,
│                                     eseguito automaticamente prima di ogni build
│                                     reale (vedi "Versionamento" sopra)
├── public/
│   └── firmware/                    .bin/.elf/.hex inclusi per l'applicazione
│                                     principale, il bootloader principale,
│                                     l'applicazione slave di espansione, e il
│                                     bootloader slave di espansione
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   Banner logo completo (mostrato in cima a
│                                     questo README)
│   ├── URTC_APP_ICON_NEW.svg        Icona app
│   ├── urtc_custom_icon.svg         Icona app, stesso artwork
│   └── urtc_icon.ico                Favicon
├── index.html                       HTML di ingresso Vite
├── metadata.json                    Nome/descrizione app + permesso "serial"
│                                     richiesto (usato dalla piattaforma di
│                                     hosting)
├── vite.config.ts                   Configurazione Vite + plugin Tailwind
├── tsconfig.json                    Configurazione TypeScript
├── .env.example                     VITE_APP_TITLE
├── dev.bat / dev.sh                 Installa dipendenze + avvia il dev server
│                                     Vite
├── build.bat / build.sh             Installa dipendenze + produce la build
│                                     statica di dist/
├── tools/
│   └── ci_validate.py               Validazione manifest/CHANGELOG/docs usata dalla CI
├── bump_manifest_version.py         Sincronizza la versione di hydra-umc.project.json con quella nativa (--sync)
├── package.json
├── CHANGELOG.md                     Cronologia delle versioni e riepilogo del lavoro passato
├── LICENSE
├── README.md                        Questo file
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- traduzioni
```

## 📜 LICENZA

URTC Web Studio è (c) 2026 JuanenRac (Electro Hobby 3D). Questo avviso deve essere
incluso in qualsiasi distribuzione di questo progetto o lavoro derivato.

Questo progetto consiste di codice sorgente e propria documentazione, resi
disponibili sotto licenze diverse - ciascuna adatta a ciò che effettivamente copre:

1. Il codice sorgente (tutto ciò che è sotto `src/`, più la configurazione
   Vite/TypeScript che lo compila) è disponibile sotto la **GNU General Public
   License v3.0 (GPL-3.0)**. Testo completo su
   https://www.gnu.org/licenses/gpl-3.0.html.

2. La documentazione (questo README e le proprie traduzioni - `README_spa.md`,
   `README_ita.md`, `README_fra.md`, `README_deu.md`, `README_zho.md`,
   `README_jpn.md`) è disponibile sotto
   **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
   Testo completo su https://creativecommons.org/licenses/by-sa/4.0/.

Questo strumento è il compagno basato su browser del progetto
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC) - vedi
il repository proprio di quel progetto per il firmware della scheda, i design
hardware, e la documentazione completa del protocollo contro cui lavora questo
strumento. Il firmware proprio di URTC è GPL-3.0 e i suoi design hardware sono
CERN-OHL-S v2; la licenza propria di questo strumento qui non si estende a quel
progetto separato, e viceversa. Esistono anche 2 alternative desktop native che
coprono lo stesso terreno:
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) e
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Se costruisci su questo progetto, tieni presente la separazione delle licenze: le
modifiche al codice dovrebbero rimanere GPL-3.0, i derivati della documentazione
dovrebbero rimanere CC BY-SA - ciascuno con attribuzione a questo progetto e al suo
autore.

## 🔗 Progetti correlati

Questo progetto fa parte di un ecosistema robotico più ampio dello stesso autore
(JuanenRac / Electro Hobby 3D), composto da molti progetti che spaziano tra
firmware, software di controllo, IA e integrazione industriale. Vale la pena
conoscerlo, poiché una richiesta potrebbe in realtà riguardare uno di questi
invece di questo repository.

### Direttamente correlati

- **[URTC](https://github.com/JuanenRac/URTC)** — il firmware esatto con cui questo strumento comunica via Web Serial, con lo stesso framing SLCAN e protocollo CAN dei 2 strumenti desktop compagni sotto.
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** / **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — i 2 strumenti desktop compagni a cui questa app basata su browser è l'alternativa senza installazione, stesso protocollo.
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** —
  alternativa a riga di comando/terminale a questo strumento basato su browser.

### Resto dell'ecosistema

**💠 Ecosistema principale**
[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC) · [HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER) · [HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO) · [HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE) · [HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI) · [HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL) · [HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL) · [HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF) · [URTC](https://github.com/JuanenRac/URTC) · [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER) · [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)

**👁️ Nodo IA Visione (Hailo-8)**
[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE) · [HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER) · [HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF) · [HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES) · [HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)

**🧠 Nodo IA Cognitiva (Hailo-10)**
[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE) · [HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE) · [HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI) · [HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER) · [HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)

**🐝 Orchestrazione e Sciame**
[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR) · [HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC) · [HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D) · [HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER) · [HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)

**🎮 Gemello Digitale e Simulazione**
[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN) · [HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA) · [HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE) · [HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)

**📊 Dati e Analisi**
[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE) · [HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR) · [HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR) · [HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)

**🏭 Gateway Industriale**
[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL) · [HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER) · [HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER) · [HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)

**🛠️ Strumenti Complementari**
[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK) · [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL) · [HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH) · [HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)

## 👤 AUTORE

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
