<p align="center">
  <img src="images/URTC_LOGO_WEB_STUDIO.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

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
  collegato. L'interruttore "FW v1.0 / v1.1" nell'intestazione influisce solo su
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
git clone https://github.com/JuanenRac/URTC-Web-Studio.git
cd URTC-Web-Studio
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
aumenta al suo posto (`1.1.9` -> `1.2.0`, mai `1.1.10`); lo stesso riporto
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
│   │   │                            interruttore sandbox FW v1.0/v1.1
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
│                                     fr.json, it.json
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
│   ├── URTC_LOGO_WEB_STUDIO.svg     Banner logo completo (mostrato in cima a
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
├── package.json
├── CHANGELOG.md                     Cronologia delle versioni e riepilogo del lavoro passato
├── LICENSE
├── README.md                        Questo file
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md  <- traduzioni
```

## 📜 Licenza e note sul copyright

URTC Web Studio è (c) 2026 JuanenRac (Electro Hobby 3D). Questo avviso deve essere
incluso in qualsiasi distribuzione di questo progetto o lavoro derivato.

Questo progetto consiste di codice sorgente e propria documentazione, resi
disponibili sotto licenze diverse - ciascuna adatta a ciò che effettivamente copre:

1. Il codice sorgente (tutto ciò che è sotto `src/`, più la configurazione
   Vite/TypeScript che lo compila) è disponibile sotto la **GNU General Public
   License v3.0 (GPL-3.0)**. Testo completo su
   https://www.gnu.org/licenses/gpl-3.0.html.

2. La documentazione (questo README e le proprie traduzioni - `README_spa.md`,
   `README_ita.md`, `README_fra.md`, `README_deu.md`) è disponibile sotto
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
(JuanenRac / Electro Hobby 3D). Vale la pena conoscerlo, poiché una richiesta
potrebbe in realtà riguardare uno di questi invece di questo repository:

**Piattaforma HYDRA-UMC** — la microfabbrica multi-robot
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — la scheda madre stessa:
  host Raspberry Pi CM5 + co-processore real-time STM32H745 dual-core, orchestrando
  fino a 8 bracci robotici distribuiti via CAN-OTA/SPI-OTA. Hardware + firmware
  propri, GPL-3.0/CERN-OHL-S v2/CC BY-SA 4.0.
- **[HYDRA-UMC STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — dashboard
  di controllo basata su web per HYDRA-UMC: visualizzazione 3D multi-robot,
  registrazione cinematica/traiettorie, flashing e testing CAN-OTA per l'intera
  piattaforma. React + Vite + Three.js.
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — il
  backend headless (Node/Express/WebSocket) che prima era integrato nel
  processo stesso di HYDRA-UMC STUDIO. Gestisce l'API REST/WS di controllo
  robot, la persistenza di settings.json, l'autenticazione JWT e il discovery
  mDNS; HYDRA-UMC STUDIO è ora un client frontend statico puro che comunica
  con esso via rete.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — app di controllo Android per HYDRA-UMC via Wi-Fi/Bluetooth. App reale e
  funzionante - set completo di funzionalità di controllo remoto, autenticazione
  JWT, storage credenziali cifrato.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — app di controllo iOS/iPadOS per HYDRA-UMC via Wi-Fi, costruita in Flutter
  (multipiattaforma, verificabile su Windows senza un Mac; il packaging `.ipa`
  finale richiede ancora Xcode). App reale e funzionante - stesso set di
  funzionalità dell'app Android.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — centro di
  comando desktop (Python/PySide6) per lo sciame: scoperta rete
  multi-controller, sincronizzazione bidirezionale dal vivo, viewport 3D robot
  reale, spazio di lavoro agganciabile in stile Photoshop. Reale e funzionante,
  non un placeholder.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — creatore/editor grafico di URDF desktop (Python/PySide6) per il catalogo modelli
  proprio di questo progetto: estrae file sorgente da GitHub o da una cartella
  locale, valida la fattibilità dei gradi di libertà, modifica
  colore/scala/cinematica con un'anteprima 3D dal vivo, e invia il risultato
  finale a un server STUDIO in esecuzione. Reale e funzionante, non un
  placeholder.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — UI touch
  nativa in Flutter per il touchscreen DSI da 5"/7" proprio di HYDRA-UMC (1280×720, stessa risoluzione in entrambe le dimensioni) sul
  Compute Module 5, che controlla questo stesso server direttamente dalla scheda.
  Scaffold reale e funzionante con tutte le 6 schermate del catalogo (dashboard, controllo manuale, camera, vista 3D semplificata, metriche di sistema, login) collegate al server live; la build reale del target Linux non è ancora stata eseguita su hardware reale (ambiente di lavoro finora solo Windows - vedere il README di quel progetto).

**Piattaforma URTC** — il controller utensile che ogni braccio robotico HYDRA-UMC
porta con sé
- **[URTC](https://github.com/JuanenRac/URTC)** — Universal Robot Tool Controller:
  controller testa utensile su bus CAN basato su STM32F303, 25 profili utensile
  completamente implementati, aggiornamento firmware CAN-OTA.
- **[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER)** — strumento
  desktop di flashing CAN-OTA + SWD/JTAG a chip completo per schede URTC
  (Windows/Linux).
- **[URTC Tester](https://github.com/JuanenRac/URTC-TESTER)** — strumento desktop
  di diagnostica CAN-bus dal vivo per schede URTC, un pannello per profilo
  utensile (Windows/Linux).
- **URTC Web Studio** *(questo repository)* — alternativa basata su browser ai 2
  strumenti desktop sopra (Web Serial API + SLCAN), nessuna installazione locale
  necessaria.

## 👤 Autore

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
