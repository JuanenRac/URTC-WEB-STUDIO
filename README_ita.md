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
  <a href="README_jpn.md">🇯🇵 日本語</a> |
  <a href="README_por.md">🇵🇹 Português</a>
</p>


<p align="center">
  <img src="https://img.shields.io/badge/Licenza-GPL%203.0-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>


Un compagno basato su browser per l'**Universal Robot Tool Controller (URTC)** - una
app a pagina singola React/Vite che è pensata per parlare con hardware URTC reale (non è mai stata eseguita con nessuno) tramite un
adattatore USB-CAN via la [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
usando lo stesso framing SLCAN e lo stesso protocollo CAN dei due strumenti compagni
da desktop, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) e
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). L'obiettivo è riunire i flussi di lavoro principali di questi due strumenti in un'unica scheda del browser, non una demo semplificata di essi; la parità completa non è ancora raggiunta (vedi «Non ancora coperto» più sotto) - le schede Flasher Studio e Tester Studio inviano e
ricevono le trame CAN reali descritte in `docs/CANBUS.TXT` del
[repository firmware di URTC](https://github.com/JuanenRac/URTC).

**Verifica di onestà - cosa funziona davvero oggi:** `npm test` (Vitest) copre la logica pura: l'analisi SLCAN, l'abbinamento richiesta/risposta, i controlli di immagine firmware e manifest, i limiti degli utensili, le conferme, le regole che separano il simulatore dal bus reale, l'esportazione delle tracce e le otto lingue dell'interfaccia. Le schermate e il trasporto Web Serial in sé non hanno test automatici, e nulla di tutto ciò è stato eseguito contro una scheda URTC reale in questo ambiente (qui non c'è un adattatore USB-CAN con cui provarlo): Flasher Studio, Tester Studio e l'Analizzatore di Protocollo CAN Bus sono codice reale verificato solo da questi test, dal controllo dei tipi (`npm run lint`) e dalla revisione del codice. Control/OLED/Specs-BOM/Thermal IR Inspection sono schede sandbox dichiarate apertamente come tali, senza alcun traffico CAN. Vedi `CHANGELOG.md` per sapere esattamente cosa è stato rilasciato finora.

---

> **Stato di sicurezza (safety e security):** questo ecosistema non è un sistema di sicurezza certificato e non esiste ancora alcuna scheda URTC assemblata. I bootloader controllano le immagini firmware con CRC32 e un HMAC-SHA256 a chiave condivisa, non con una firma asimmetrica (prevista); le immagini applicative pubblicate sono firmate con la chiave pubblica di sviluppo (`signing_key_kind: dev`), quindi chiunque può produrre un'immagine accettata dal bootloader; nulla è stato trasmesso a una scheda reale. Leggi la [base di sicurezza](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) e il [modello delle minacce](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md) prima di fidarti di qualsiasi affermazione qui per la sicurezza di una persona.

## 📋 In breve

| | |
|---|---|
| Versione | `0.3.6` |
| Maturità | Funzionale |
| Tecnologia | Web Serial API / TypeScript |
| Destinazione | Un browser web sul PC dell'utente |
| Su hardware reale | Solo simulato: provato con emulatori, test double o simulatori; per questa versione non risulta alcuna esecuzione su hardware reale |

## 🧭 Cosa è reale e cosa è una sandbox

Questa app ha due tipi di schede:

- **Schede reali, guidate dall'hardware** - Flasher Studio, Tester Studio, e il CAN
  Bus Protocol Analyzer. Queste fanno qualcosa solo dopo che hai collegato un
  adattatore USB-CAN reale (pulsante nell'intestazione in alto a destra); ogni
  comando che inviano e ogni lettura che mostrano proviene dal bus CAN (questo percorso non è mai stato eseguito con un adattatore o una scheda reali). Questo
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
- Il bus impostato a **500 kbit/s**. Alla connessione l'app prova a turno 500, 250, 125 kbit/s e le altre velocità standard e mantiene la prima a cui una scheda risponde a una richiesta di versione; non è ancora possibile scegliere la velocità a mano né ascoltare senza che una scheda risponda.
- Un browser con supporto Web Serial - **Chrome o Edge**. Firefox e Safari non
  implementano Web Serial e non potranno connettersi affatto.
- Web Serial richiede un contesto sicuro (HTTPS) o `localhost` - e non può essere
  usato da dentro un iframe. Se stai visualizzando in anteprima questa app dentro un
  frame incorporato, aprila prima nella sua scheda dedicata.

## 🛡️ Validazione dei frame CAN

Entrambe le direzioni del collegamento SLCAN vengono validate prima che
qualcosa raggiunga la UI o il cavo (`src/hooks/useSerialCanBus.ts`):

- **In uscita** - `sendFrame()` rifiuta di serializzare un comando il cui
  identificatore esce dall'intervallo CAN standard a 11 bit
  (`0x000`-`0x7FF`), il cui payload supera 8 byte, o il cui payload contiene
  un byte fuori da `0x00`-`0xFF`. La UI mostra "Refusing malformed CAN
  frame: ..." invece di scrivere testo non valido sulla porta seriale.
- **In entrata** - `processBuffer()` richiede una corrispondenza reale
  `t<3 esadecimali ID><1 esadecimale DLC 0-8><payload esadecimale>` prima
  di trasformare una riga SLCAN ricevuta in un `CanFrame`; un DLC fuori da
  `0`-`8` o un payload più corto della propria lunghezza dichiarata viene
  registrato in console e scartato invece di essere passato a un pannello
  strumento come byte `NaN`. Un timestamp opzionale dell'adattatore in coda
  resta accettato dopo un payload valido.

## ⚡ Flasher Studio - copertura reale delle funzionalità

Portato dal proprio `flasher_protocol.py` di `URTC-FLASHER`, contro gli stessi CAN
ID:

- **Aggiornamento CAN-OTA della scheda principale** (`0x7F0`-`0x7F7`): trigger di
  ingresso nel bootloader, HMAC-SHA256 a chiave condivisa (testato solo contro un simulatore), trasferimento paginato con controllo
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
- **Interrogazione versione scheda dal vivo** (`0x7F8`/`0x7F9`/`0x7FA`/`0x7E9`) - mostra il
  vero rispondente (app o bootloader), HardwareID, e versione, non un interruttore
  simulato.
- **Firma e impronta pubblicate** - ogni immagine della build URTC arriva
  con `<file>.manifest.json` (versione, `sha256` e il valore `hmac_sha256` atteso dal bootloader, un HMAC-SHA256 a chiave condivisa e non una firma asimmetrica) e `<file>.sha256`. L'app invia la firma pubblicata,
  uno `sha256` del manifest che non corrisponde al file **blocca** il flash,
  e la versione del manifest è quella comunicata al bootloader. Un file
  scelto dal disco non ha manifest: si può flashare solo con una chiave di
  firma inserita per quel singolo flash (schede da banco), a meno che non si
  scelga insieme il suo `.manifest.json`.
- **Numero di patch del firmware** (`0x7E9`, e il `0x218` esteso dello slave) -
  il firmware installato e l'immagine scelta sono mostrati come
  major.minor.patch. La patch entra nel confronto solo quando la portano
  entrambi i lati, una scheda precedente (non invia `0x7E9`) continua a
  funzionare con major.minor, e la patch va in END_UPDATE solo verso un
  bootloader che l'ha annunciata. Il registro dice se l'immagine è più
  vecchia, uguale o più recente di quanto riportato dalla scheda.
- **Firmware dalla release GitHub più recente** - i binari sono file allegati
  alla release di ogni versione di URTC, non file in git. L'elenco viene
  dall'API delle release di `JuanenRac/URTC` (solo le immagini applicative
  della scheda scelta, ciascuna con il suo `.sha256` e il suo
  `.manifest.json`); un'immagine scaricata deve corrispondere alle impronte
  pubblicate dalla release, e restano i controlli di immagine, manifest e
  firma. GitHub serve i file da un host che non invia intestazioni CORS,
  quindi un browser può non riuscire a scaricarli: il registro lo dice, e
  l'immagine può essere presa dalla cartella inclusa, oppure scaricata dalla
  pagina della release e scelta con Sfoglia insieme al suo `.manifest.json`.
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
  lato firmware (saldatore, laser, polimerizzazione UV, rilavorazione ad aria calda,
  ugello della stampante 3D - rinvio ogni 150ms sotto un watchdog di 250ms;
  ventola di strato della stampante 3D - rinvio ogni 400ms sotto il proprio
  watchdog di 1000ms), con gli stessi intervalli di rinvio dello strumento da
  desktop. Deselezionarla, cambiare pannello o scheda, disconnettersi o chiudere la
  pagina invia il comando di spegnimento dell'utensile.
- **Global Controls** (`0x100`), passthrough SPI di **Expansion Board** + query TMC
  DIAG0 (`0x180`-`0x183`), query/cancellazione **F-RAM** (`0x190`-`0x192`),
  **Self-Test** (controlli sicuri, a riposo, per utensile), un **Raw Bus Monitor**
  con esportazione traccia `.trc`/`.asc`, e un iniettore **Custom Frame** con un
  intervallo di ripetizione opzionale - validato come il proprio iniettore di
  trame del CAN Bus Protocol Analyzer: un identificatore fuori da `0`-`7FF`, un
  byte di dati non valido o più di 8 byte viene rifiutato con un messaggio, mai
  mascherato, scartato o troncato. Gli identificatori che trasmette solo la scheda
  vengono rifiutati, e le scritture nella memoria della scheda, i comandi del
  bootloader e quelli degli attuatori sono confermati prima.
- **Detect Hardware** interroga il vero utensile attivo (`0x110`/`0x111`) e la
  versione scheda (`0x7F8`/`0x7F9`), e un errore critico dichiarato (`0x111` byte
  1) appare come banner di guasto dal vivo.

### Separazione del simulatore e conferme (controlli software, non funzioni di sicurezza)

- Le schede sandbox (Control, OLED, Thermal IR) non trasmettono nulla. Le loro trame sono contrassegnate SIM e, finché è collegata una scheda, non producono alcuna risposta simulata. Dei messaggi predefiniti dell'analizzatore di protocollo vengono inviate a una scheda collegata solo le semplici interrogazioni; il resto resta simulato.
- Tester Studio mostra un pannello utensile solo per l'utensile che la scheda stessa ha segnalato (`0x111`), e nessuno prima che la scheda abbia risposto.
- Laser, trapano, polimerizzazione UV, saldatura, riscaldatori, movimento, erogazione di pasta, scritture nella memoria della scheda e trame digitate a mano rischiose richiedono prima una conferma.
- **FERMA TUTTO** nell'intestazione (visibile a connessione attiva) spegne ogni attuatore che questa pagina mantiene attivo; chiudere la pagina e disconnettersi fanno lo stesso. È un comando software, non un arresto di emergenza.
- Flashare un'immagine firmata con la chiave di sviluppo pubblica chiede prima una conferma, perché quella chiave non prova nulla su chi ha creato l'immagine.
- Quando la scheda dichiara un errore critico, il banner indica anche il motivo della protezione contro la fuga termica se la scheda lo comunica.
- **Riproduzione di una traccia registrata** (CAN Bus Protocol Analyzer): un file `.trc` o `.asc`, per esempio quello esportato dal Raw Bus Monitor, riproduce i suoi frame ricevuti nel registro e nei pannelli senza scheda, da 0,25x a 10x e volendo in ciclo. I frame sono marcati REPLAY, non si trasmette nulla, una registrazione non risponde mai a una richiesta, non viene mai esportata come qualcosa che ha detto la scheda e la riproduzione va in pausa finché una scheda è collegata.

### Non ancora coperto

- I contatori di errore dell'ispezione termica (`0x1AA`/`0x1AB`).
- Una modalità di solo ascolto e la scelta manuale della velocità: non ci si può agganciare a un bus su cui nessuna scheda risponde.
- La lettura dell'immagine termica non controlla prima che il sensore sia pronto e non ritenta un blocco perso.
- Scaricare un file firmware direttamente dalla release GitHub nel browser: GitHub serve i file di una release da un host senza intestazioni CORS, quindi il download può essere bloccato (l'immagine inclusa, o un file scelto dal disco con il suo `.manifest.json`, funzionano sempre).

## 🔐 Nota di sicurezza: nessuna chiave di firma in questa app

Dalla 0.2.3 questa app **non** contiene alcuna chiave di firma HMAC-SHA256.
La build URTC firma da sé ogni immagine applicativa (con una chiave privata solo nelle build di release; le immagini pubblicate usano la chiave pubblica di sviluppo) e pubblica la firma accanto; Flasher Studio si
limita a trasportare quella firma - lo stesso modello del `URTC Flasher` da
desktop. Il bundle JS non contiene nulla di segreto, quindi la pagina può
essere pubblicata apertamente.

L'unica eccezione è un'immagine compilata in proprio senza manifest, per una
scheda da banco: l'app chiede allora la chiave di firma, la tiene in memoria
solo per quel flash e non la salva mai. Le immagini firmate con la chiave
PUBBLICA di sviluppo (`signing_key_kind: "dev"` nel manifest) si installano
solo su schede il cui bootloader è stato compilato allo stesso modo - il log
lo segnala. Vedi `docs/FIRMWARE_SIGNING.TXT` in URTC.

La cartella **non è in git**: la crea `npm run sync-firmware` (la CI e la build di Pages lo eseguono prima dei test e della build). Finché non esiste una release ufficiale, il «latest» di GitHub risponde 404 e `firmware-release.json` indica la release usata al suo posto (oggi la pre-release da banco); eliminalo, o cambia il suo tag, quando ne verrà pubblicata una ufficiale. **Sicurezza della pagina**: script, stili, font e immagini arrivano dalla pagina stessa (i font sono impacchettati con l'app, nessuna richiesta va a un server di font), in linea sono ammessi solo gli attributi di stile che scrive React, e la pagina può raggiungere solo la propria origine e gli host GitHub che servono le release (Content-Security-Policy nell'`index.html` generato). Un host che può inviare intestazioni usa `public/_headers` (la stessa politica, `Permissions-Policy: serial=(self)` e nient'altro di potente); GitHub Pages non può inviare intestazioni, quindi lì vale solo la politica contenuta nella pagina.

`public/firmware/` contiene esattamente i file pubblicati da URTC (stessi
nomi, stessi byte, con i loro file associati). I binari di URTC non sono in
git: sono file allegati alla release di ogni versione.
`npm run sync-firmware` scarica la release più recente
(`npm run sync-firmware -- --tag v0.3.5` per una precisa), oppure prende una
cartella locale come argomento (`npm run sync-firmware -- ../URTC/firmware`
per una build da banco). In entrambi i casi verifica ogni impronta e i campi
di firma prima di toccare `public/firmware/`, e rigenera
`src/lib/bundledFirmware.ts`; un test verifica il pacchetto rispetto ai suoi
manifest.

Ogni file di una release ufficiale ha una firma di release (`<file>.sig`, Ed25519): la sincronizzazione la verifica quando è presente e rifiuta una firma errata; un insieme senza firme (una pre-release da banco o una build locale) richiede `--allow-unsigned`. La pagina verifica la stessa firma nel browser (Web Crypto) prima di inviare a una scheda un'immagine inclusa o un'immagine di una release GitHub, e si ferma se non è valida.

## 🚀 Per iniziare

### Prerequisiti
- Node.js 20 LTS+
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

Il server di sviluppo ascolta solo su `localhost`: Web Serial funziona con https o su localhost, quindi aprirlo alla rete non servirebbe a nulla.

### Build statico

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

La pagina compilata dichiara una content security policy (script solo dalla pagina stessa; connessioni solo verso se stessa e GitHub) e carica ogni scheda alla prima apertura. Non è ancora stata provata in un browser reale.

### GitHub Pages (disattivato finché il proprietario non lo attiva)

Il repository può pubblicare il sito compilato su GitHub Pages (workflow `.github/workflows/pages.yml`: `npm ci`, controllo dei tipi, test, `npm run build` con il percorso base del progetto, poi `upload-pages-artifact` e `deploy-pages`). **Il workflow è disattivato**: i suoi due job vengono eseguiti solo se la variabile del repository `URTC_PAGES_ENABLED` vale `true` (Settings > Secrets and variables > Actions > Variables), cosa che il proprietario fa dopo la prima release ufficiale firmata di URTC. La compilazione esegue poi `npm run sync-firmware -- --require-official`: prende solo il firmware dell'ultima release ufficiale (mai una pre-release, mai il tag di ripiego di `firmware-release.json`), rifiuta qualsiasi file senza una firma di release valida e qualsiasi immagine applicativa compilata con la chiave pubblica di sviluppo, quindi la pagina pubblicata non può contenere immagini della chiave di sviluppo. Anche Pages va attivato una volta (Settings > Pages > Source: GitHub Actions); con la variabile non impostata il workflow viene saltato. Web Serial richiede un browser basato su Chromium e https, che Pages fornisce.

### Versionamento

Il `version` di `package.json` (e il `version` corrispondente in `urtc.project.json`) viene incrementato solo dal passo esplicito `python bump.py` (esegue `bump_manifest_version.py`, che legge la versione attuale da `package.json`, la incrementa, la riscrive, sincronizza il manifest e aggiunge una voce minima al CHANGELOG se quella versione non ne ha ancora una). `build.bat`/`build.sh` compilano soltanto e non toccano mai la versione. `npm run build` (`vite build`) da solo è deliberatamente
solo-compilazione e non tocca mai la versione - `scripts/bump-version.mjs`
faceva questo lavoro in un design precedente con un hook `prebuild`, ma
oggi quello script è legacy, mantenuto solo come riferimento (vedi il suo
stesso commento di intestazione); `npm run dev`/`lint`/`preview` non la
toccano mai nemmeno loro. Non è Semantic Versioning: è un contachilometri in
base 10. La cifra patch aumenta di 1; quando supererebbe 9, si azzera e la
cifra minor aumenta al suo posto (`0.1.9` -> `0.2.0`, mai `0.1.10`); lo
stesso riporto si propaga da minor a major. Vedi `CHANGELOG.md` per la
cronologia delle versioni e un riepilogo del lavoro passato su questo
progetto.

## 📖 Ulteriore documentazione

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — come la UI, le
  impostazioni persistite e l'autorità del trasporto esterno restano
  separate, e perché le schede sandbox devono esporre stati offline/non
  disponibile invece di presentare dati simulati come reali.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — il percorso di
  validazione non mutante `build-test.bat`/`.sh` (TypeScript + test, senza
  modifiche a versione o CHANGELOG), `dev.bat`/`.sh` per lo sviluppo
  locale, e perché il materiale di firma OTA non appartiene mai alla
  configurazione del browser.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — cosa
  deve fare questo client di fronte a uno schema sconosciuto, un'identità
  del target mancante o un risultato API malformato, e perché la reale
  autorità di flashing resta lato server o negli strumenti desktop
  dedicati.

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
│   ├── i18n.ts                     Configurazione i18next - en/es/de/fr/it/zh/ja/pt,
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
│   │   ├── TraceReplayPanel.tsx     Carica una traccia .trc/.asc e la riproduce nel registro
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
│   │   ├── useTraceReplay.ts        Riproduce una traccia registrata nel registro e nei pannelli
│   │   └── useKeepalive.ts          Hook di reinvio a intervallo fisso che
│   │                                sostiene il keepalive watchdog della
│   │                                casella attiva di ogni utensile
│   ├── lib/
│   │   ├── flasher.ts               Costanti del protocollo OTA, helper CRC32/HMAC,
│   │   │                            lettura dei manifest (nessuna chiave di firma)
│   │   ├── traceReplay.ts           Legge le tracce .trc/.asc; il riproduttore con velocità e pause
│   │   ├── boardVersion.ts          Richieste di versione: 0x7F9/0x7FA/0x7E9 e 0x217/0x218 dello slave
│   │   ├── githubRelease.ts         Immagini della release GitHub più recente e relativo download
│   │   ├── firmwareImage.ts         Controlli dell'immagine, destinazione del manifest e versione (con patch)
│   │   ├── firmwareSignature.ts     Sceglie la firma da inviare: quella pubblicata o
│   │   │                            una chiave inserita per un flash; verifica sha256
│   │   ├── quickState.ts            Decodifica di 0x111 (guasto termico, reset)
│   │   ├── bundledFirmware.ts       Generato da scripts/sync-firmware.mjs
│   │   └── canIds.ts                Costanti CAN ID per Tester Studio -
│   │                                 rispecchia tester_config.py byte per byte
│   └── locales/                     Stringhe UI - en.json, es.json, de.json,
│                                     fr.json, it.json, ja.json, zh.json, pt.json
├── scripts/
│   ├── bump-version.mjs             Script di incremento versione senza dipendenze;
│   │                                 oggi legacy, mantenuto solo come riferimento
│   │                                 - sostituito da bump_manifest_version.py (vedi "Versionamento")
│   └── sync-firmware.mjs            Copia i file della release URTC (o una
│                                     cartella locale) in public/firmware/,
│                                     impronte verificate - npm run sync-firmware
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
├── vite.config.ts                   Configurazione Vite + plugin Tailwind
├── tsconfig.json                    Configurazione TypeScript
├── .env.example                     L'app non legge nessuna variabile
├── dev.bat / dev.sh                 Installa dipendenze + avvia il dev server
│                                     Vite
├── build.bat / build.sh             Installa dipendenze + produce la build
│                                     statica di dist/
├── tools/
│   └── ci_validate.py               Validazione manifest/CHANGELOG/docs usata dalla CI
├── bump.py                          Comando esplicito per alzare la versione (compilare non la alza mai)
├── bump_manifest_version.py         Incremento di versione, avviato solo da `bump.py` (package.json + manifest, vedi "Versionamento"); esiste anche la modalità `--sync` per accettare un incremento nativo precedente
├── package.json
├── CHANGELOG.md                     Cronologia delle versioni e riepilogo del lavoro passato
├── LICENSE
├── NOTICE                      Avviso di copyright e licenza della documentazione
├── README.md                        Questo file
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- traduzioni
```

<!-- urtc-section:compatibility -->
## 🧩 Compatibilità

Quali versioni dei programmi URTC funzionano insieme, e quale versione del protocollo parla ciascuna, è elencato nella tabella di compatibilità generata da URTC-COMMON: [docs/COMPATIBILITY.md](https://github.com/JuanenRac/URTC/blob/main/docs/COMPATIBILITY.md).
<!-- /urtc-section:compatibility -->

## 📜 LICENZA

URTC Web Studio è (c) 2026 JuanenRac (Electro Hobby 3D). Questo avviso deve essere
incluso in qualsiasi distribuzione di questo progetto o lavoro derivato.

Questo progetto consiste di codice sorgente e propria documentazione, resi
disponibili sotto licenze diverse - ciascuna adatta a ciò che effettivamente copre:

1. Il codice sorgente (tutto ciò che è sotto `src/`, più la configurazione
   Vite/TypeScript che lo compila) è disponibile sotto la **GNU General Public
   License v3.0 (GPL-3.0-or-later)**. Testo completo su
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
strumento. Il firmware proprio di URTC è GPL-3.0-or-later e i suoi design hardware sono
CERN-OHL-S v2; la licenza propria di questo strumento qui non si estende a quel
progetto separato, e viceversa. Esistono anche 2 alternative desktop native che
coprono lo stesso terreno:
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) e
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Se costruisci su questo progetto, tieni presente la separazione delle licenze: le
modifiche al codice dovrebbero rimanere GPL-3.0-or-later, i derivati della documentazione
dovrebbero rimanere CC BY-SA - ciascuno con attribuzione a questo progetto e al suo
autore.

**Schede Scatola nera, Funzioni opzionali, Banco del rack e Vista termica (nuove, verificate solo con simulazioni):** Tester Studio legge il registratore di guasti (`0x1A8` / `0x1A9`) e lo scarica in CSV o JSON, automaticamente una volta per ogni errore segnalato dalla scheda quando l'opzione è attiva; attiva le funzioni opzionali del firmware (`0x1AE` / `0x1AF`, spente per impostazione predefinita, dopo una conferma; agiscono al prossimo avvio); simula il rack di utensili nella pagina, con l'identità di ogni testa (tipo e numero di serie); e disegna l'immagine di ispezione termica in falsi colori (un'immagine simulata lo dichiara). Il catalogo degli utensili ora deriva dai profili utensile condivisi di URTC-COMMON. Nulla di tutto ciò è stato provato con una scheda reale.

**Visualizzatore della scatola nera (nuovo, verificato solo con test):** la scheda Black Box disegna la temperatura misurata e il setpoint dei secondi registrati prima dell'errore, con una linea dove compare per la prima volta il flag di errore, e apre una registrazione salvata in precedenza (il file JSON o CSV che la scheda stessa scrive) senza scheda collegata; un file che non è una registrazione, ha un valore fuori intervallo o più di 67 campioni viene rifiutato con il motivo.

**Avviso di versione (nuovo, verificato solo con test):** la compilazione scrive un `version.json` accanto alla pagina; la pagina compilata lo confronta una volta, all'apertura e solo con la stessa origine, con la propria versione e segnala quando ne viene servita una maggiore, con un pulsante Ricarica. Niente si ricarica da solo, una versione uguale o più vecchia non dice nulla e un file mancante o l'assenza di rete restano in silenzio.

**PID del riscaldatore (nella scheda Funzioni opzionali; nuovo, verificato solo con simulazioni):** Tester Studio legge lo stato del PID del riscaldatore del firmware (`0x1B9` / `0x1BA`: i guadagni in vigore, lo stato e l'uscita dell'ultimo ciclo di controllo), salva i guadagni (da 0 a 600) e avvia o annulla l'autotuning a relè, che scalda la punta attorno al setpoint attuale del saldatore (da 100 a 445 C) e salva i guadagni trovati. Salvare i guadagni e avviare l'autotuning chiedono conferma, annullare no; un guadagno che non sia un numero da 0 a 600 viene rifiutato prima di inviare qualsiasi cosa. La funzione va prima attivata tra le funzioni opzionali; nulla di tutto ciò è stato provato con una scheda reale.

## 🔗 Progetti Correlati

Questo progetto fa parte dell'ecosistema robotico HYDRA-UMC dello stesso autore (JuanenRac / Electro Hobby 3D). Vale la pena conoscerlo, poiché una richiesta potrebbe in realtà riguardare uno di questi invece di questo repository.

**Progetto Padre**
- **[URTC](https://github.com/JuanenRac/URTC)** — firmware per la scheda fisica dell'Universal Robot Tool Controller, oltre 25 profili utensile su bus CAN; il genitore di cui questo repository è uno strumento specifico, all'interno della propria famiglia di strumenti CAN-bus.

**Progetti Fratelli** — gli altri strumenti della propria famiglia di strumenti CAN-bus di URTC
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — strumento desktop con GUI per il flashing delle schede URTC, CAN-OTA più SWD/JTAG a chip intero — stesso protocollo SLCAN/CAN di questa app basata su browser, che ne è l'alternativa senza installazione.
- **[URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY)** — un gateway davanti al bus CAN che lascia passare solo gli identificatori di un elenco, ne limita la frequenza e chiede una chiave di sessione.
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — strumento desktop di diagnostica CAN-bus dal vivo per schede URTC, un pannello per profilo utensile — stesso protocollo SLCAN/CAN di questa app basata su browser, che ne è l'alternativa senza installazione.

**Direttamente Correlati**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — CLI di flotta con un vero e stabile contratto di exit-code, un client live reale della stessa API di HYDRA-UMC-SERVER — un'alternativa da terminale/riga di comando a questo strumento basato su browser.

**Fa Anche Parte dell'Ecosistema**

*Hardware e Piattaforma di Base*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — il progetto della scheda madre del braccio robotico: host CM5 + coprocessore STM32H745 dual-core, pensato per coordinare fino a 8 bracci utensile via CAN-OTA/SPI-OTA (firmware in fase iniziale; nessuna scheda assemblata per ora).
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — livello prodotto riproducibile su Raspberry Pi OS per il CM5: agente in sola lettura, config/profili validati, provisioning WiFi al primo contatto.
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — il contratto JSON-Schema condiviso e la barriera software di controllo dei job contro cui ogni bridge valida i propri comandi (non è una funzione di sicurezza certificata).
- **[HYDRA-UMC-CONNECTOR-HUB](https://github.com/JuanenRac/HYDRA-UMC-CONNECTOR-HUB)** — registro dichiarativo e validatore di manifesti adattatore per connettori di macchine esterne; estende la propria idea di contratto dell'SDK alle macchine esterne senza sostituire i progetti di gateway industriale.

*Backend Centrale e Client*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — il vero backend headless (REST/WebSocket) con cui parla davvero ogni client di controllo.
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — dashboard di controllo web con visualizzazione 3D multi-robot in tempo reale.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — centro di comando sciame desktop (PySide6) per più server contemporaneamente, pacchettizzato come eseguibile standalone.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — app di controllo nativa per Android con login biometrico e un companion Wear OS abbinato.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — app di controllo per iOS/iPadOS (Flutter) con sincronizzazione WebSocket in tempo reale.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — interfaccia touch nativa per il touchscreen DSI da 7" a bordo, incorporata direttamente nel CM5.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — creatore/editor grafico desktop di URDF che invia i modelli finiti al catalogo di STUDIO.
- **[HYDRA-UMC-EDITOR-STL](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-STL)** — editor desktop di modelli STL, che trasforma/sostituisce/rimuove/aggiunge veri pezzi nello stesso catalogo di modelli modificato anche da HYDRA-UMC-EDITOR-URDF.
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — barriera di coordinamento per flotte AGV/AMR tramite un publisher MQTT VDA 5050 (testato solo contro una flotta emulata).
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — coordinatore ad alto livello per celle CNC con accesso a stato/byte di controllo GRBL (testato solo contro un emulatore).
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — barriera di coordinamento per droidi con zampe/umanoidi, con un mittente di comandi per Boston Dynamics Spot (testato solo contro un emulatore).
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — coordinatore per celle laser che legge 3 segnali GPIO di chiave/involucro/interblocco (testato solo contro un chip simulato; non può armare né far partire un laser).
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — coordinatore ad alto livello sicuro per il flusso schede del pick-and-place OpenPnP.
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — barriera di coordinamento sicura per stampanti 3D Moonraker/Klipper, con comandi di lavoro reali e controllati.
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — coordinatore con un trasporto ROS 2 rclpy importato in modo lazy (non ancora eseguito contro un'installazione ROS 2).
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — barriera di coordinamento per UAV dotati di fotocamera, con un mittente di comandi MAVLink (testato solo contro un emulatore).

*Nodo IA Visione (Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — hub di integrazione per la pipeline di visione Hailo-8, con un vero controllo di prontezza hardware per fase.
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — registro reale di modelli compilati con verifica di caricamento sicuro per architettura Hailo/checksum.
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — generatore reale di pipeline GStreamer + config MediaMTX, con una vera barriera di integrazione HailoRT.
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — legge di correzione Position-Based Visual Servoing con autorizzazione condizionata allo stato di zona; ancora nessuna stima di posa da telecamera.
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — logica v0 di violazione zona, freschezza di calibrazione e richiesta E-STOP che legge le posizioni degli oggetti da un file; nessun rilevatore la alimenta e nessun E-STOP fisico è ancora collegato.

*Nodo IA Cognitivo (Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — hub di integrazione per la pipeline cognitiva Hailo-10 (orchestrazione LLM/VLA/voce).
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — vera codifica/decodifica di token d'azione e generazione di traiettoria per un modello Vision-Language-Action.
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — vero front-end vocale (VAD + parser di intenti) con un relay verso Watch limitato e soggetto a conferma.
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — vera scomposizione dei task basata su regole e recupero semantico degli errori sui codici errore MCU.
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — vera ricerca documentale TF-IDF (solo libreria standard) sui documenti Markdown di questo ecosistema.
- **[HYDRA-UMC-LOCAL-TECHNICIAN](https://github.com/JuanenRac/HYDRA-UMC-LOCAL-TECHNICIAN)** — tecnico di manutenzione IA locale e con cancelli di policy per l'ecosistema stesso - osserva, diagnostica e propone correzioni; i due livelli di rischio più alti non sono deliberatamente ancora implementati.

*Orchestrazione e Sciame*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — hub di integrazione con un vero contratto di health-report gRPC/Protobuf e una macchina a stati di missione.
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — vera coda di lavori basata su priorità con deduplicazione, su una vera API HTTP.
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — vero watchdog di salute della flotta basato su gRPC, con retry/backoff e rilevamento di discrepanza d'identità.
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — vero pianificatore di percorsi 3D basato su RRT, con vera validazione delle collisioni ostacolo/spazio di lavoro.
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — vera sincronizzazione di stato CRDT LWW-Element-Map, con property test per la convergenza multi-cella.

*Gemello Digitale e Simulazione*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — hub di integrazione per il motore di gemello digitale, con un vero contratto di sincronizzazione per compatibilità di versione.
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — router hardware-in-the-loop con un interblocco software di collisione tra simulazione e hardware reale (testato senza hardware reale).
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — vera cinematica diretta e validazione dei limiti articolari su un vero sottoinsieme URDF.
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — vero generatore procedurale di scene 2D con esportazione di annotazioni YOLO/COCO.

*Dati e Analisi*
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — vero archivio di serie temporali basato su sqlite3, con una vera API HTTP di ingestione/query.
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — vero rilevatore di anomalie FFT + baseline statistica, con monitoraggio della deriva.
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — vero calcolo OEE/disponibilità sullo storico di DATALAKE, con esportazione CSV riproducibile.
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — vera pipeline di ingestione CAN/WebSocket verso DATALAKE, con deduplicazione per sequenza.

*Gateway Industriale*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — hub di integrazione che inoltra ai protocolli industriali, con un vero livello di allowlist dei comandi/backpressure.
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — vero spazio di indirizzi OPC-UA, verificato con una vera sessione client del protocollo binario.
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — vero broker MQTT con autenticazione opzionale per client e ACL sui topic.
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — veri endpoint XML `/probe` e `/current` di MTConnect, con output in modalità degradata.

*Strumenti Complementari e Operazioni dell'Ecosistema*
- **[HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)** — pannelli Smart Summaries e Anomaly Highlighting su DATALAKE/ANOMALY-DETECTOR, con un fallback statistico onesto.
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — app companion WearOS con schemi di avviso aptico e un relay vocale verso il telefono abbinato (non ancora eseguita su un orologio fisico).
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — firmware per un rack di montaggio schede con decodifica reale dell'ID utensile e logica di preriscaldamento Smart Idle.
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — firmware più un vero companion di visione Python per una testa utensile di ispezione termica/RGB.
- **[URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER)** — strumento desktop che rileva, installa e aggiorna i repository della famiglia URTC, con una azione esplicita alla volta.
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — strumento amministrativo desktop che scopre, clona e aggiorna ogni repository di questo ecosistema.
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** — strumento desktop Windows/Linux che costruisce un'immagine della CM5 pronta da scrivere, precaricata con le versioni più aggiornate dell'ecosistema, con configurazione di primo avvio Wi-Fi/utente/SSH in stile Raspberry Pi Imager.
- **[HYDRA-UMC-OPS-AGENT](https://github.com/JuanenRac/HYDRA-UMC-OPS-AGENT)** — coordinatore di incidenti di manutenzione: un ruolo edge a basso privilegio raccoglie uno snapshot di inventario/salute sanificato, un ruolo control-plane lo rende in sola lettura e chiede a un provider di IA di suggerire una diagnosi - non applica mai una patch né distribuisce nulla.
- **[HYDRA-UMC-DEV-SERVER](https://github.com/JuanenRac/HYDRA-UMC-DEV-SERVER)** — host di sviluppo riproducibile (Raspberry Pi 5 / CM5) che conserva il codice sorgente dell'ecosistema ed esegue attività delimitate di build/test tramite una coda durevole; un ruolo di sviluppo dedicato, esplicitamente distinto da un CM5 operativo.

---

## 📚 Documentazione e Comunità

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — stack tecnologico e linee guida di codifica per una pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — gli standard di comportamento attesi in questa comunità.
- **[SECURITY.md](SECURITY.md)** — come segnalare una vulnerabilità, e le reali aree di attenzione sulla sicurezza di questo progetto.
- **[SUPPORT.md](SUPPORT.md)** — dove porre domande e segnalare bug.
- **[LICENSE.md](LICENSE.md)** — la licenza propria di questo progetto.

## 👤 AUTORE

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
