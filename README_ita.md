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

### I flussi principali del flasher e del tester di URTC in una scheda del browser, con un adattatore USB-CAN e Web Serial

<p align="center">
  <img src="https://img.shields.io/badge/Licenza-GPL%203.0-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Tests-792-2ea44f.svg" alt="Tests">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>

---

**Verifica di onestà - cosa funziona davvero oggi:** `npm test` (Vitest) copre la logica pura: l'analisi SLCAN, l'abbinamento richiesta/risposta, i controlli di immagine firmware e manifest, i limiti degli utensili, le conferme, le regole che separano il simulatore dal bus reale, l'esportazione delle tracce e le otto lingue dell'interfaccia. Le schermate e il trasporto Web Serial in sé non hanno test unitari (i controlli end-to-end alla fine di questo paragrafo li pilotano davanti a una scheda modellata), e nulla di tutto ciò è stato eseguito contro una scheda URTC reale in questo ambiente (qui non c'è un adattatore USB-CAN con cui provarlo): Flasher Studio, Tester Studio e l'Analizzatore di Protocollo CAN Bus sono codice reale verificato solo da questi test, dal controllo dei tipi (`npm run lint`) e dalla revisione del codice. Control/OLED/Specs-BOM/Thermal IR Inspection sono schede sandbox dichiarate apertamente come tali, senza alcun traffico CAN. Vedi `CHANGELOG.md` per sapere esattamente cosa è stato rilasciato finora. `npm run test:e2e` apre inoltre la pagina compilata in un browser reale (Playwright) davanti a una scheda modellata: così si verificano la copia offline, lo storico dei contatori termici e la sessione salvata.

---

> **Stato di sicurezza (safety e security):** questo ecosistema non è un sistema di sicurezza certificato e non esiste ancora alcuna scheda URTC assemblata. I bootloader controllano le immagini firmware con CRC32 e un HMAC-SHA256 a chiave condivisa, non con una firma asimmetrica (prevista); le immagini applicative pubblicate sono firmate con la chiave pubblica di sviluppo (`signing_key_kind: dev`), quindi chiunque può produrre un'immagine accettata dal bootloader; nulla è stato trasmesso a una scheda reale. Leggi la [base di sicurezza](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) e il [modello delle minacce](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md) prima di fidarti di qualsiasi affermazione qui per la sicurezza di una persona.

## 📋 In breve

| | |
|---|---|
| Versione | `0.3.9` |
| Maturità | Funzionale |
| Test | 792 (`npm test`) |
| Tecnologia | Web Serial API / TypeScript |
| Destinazione | Un browser web sul PC dell'utente |
| Su hardware reale | Solo simulato: provato con emulatori, test double o simulatori; per questa versione non risulta alcuna esecuzione su hardware reale |

**Vai a:** [Panoramica](#-panoramica) · [Architettura](#-architettura) · [Funzionalità](#-funzionalità) · [Sicurezza](#-sicurezza-e-protezione) · [Interfacce](#-interfacce) · [Avvio rapido](#-avvio-rapido) · [Test](#-test) · [Struttura](#-struttura-del-repository) · [Correlati](#-progetti-correlati)

<!-- urtc-section:status_web_studio -->
## 🚦 Stato del progetto

🟢 fatto e verificato · 🟡 funziona, con limiti noti · 🟠 a metà o non verificato · 🔴 non fatto o non funzionante. Nulla è verde se non ha mai girato su hardware reale.

| Parte | Stato | Ciò che il repository può dimostrare |
| --- | :---: | --- |
| Software | 🟡 | Funziona su un PC e contro il simulatore; mai usato con una scheda reale. |
| Interfaccia | 🟡 | La finestra funziona ed è verificata con una scheda simulata; non provata con un adattatore reale. |
| Test | 🟢 | La suite di test passa nella CI a ogni push. |
| Hardware reale | 🟠 | Nessuna esecuzione su una scheda reale: la prova al banco è ancora da fare. |
| Documentazione | 🟡 | README in otto lingue e documenti di riferimento; le traduzioni non sono state riviste da madrelingua. |

<!-- /urtc-section:status_web_studio -->

## 🎯 Panoramica

Un compagno basato su browser per l'**Universal Robot Tool Controller (URTC)** - una
app a pagina singola React/Vite che è pensata per parlare con hardware URTC reale (non è mai stata eseguita con nessuno) tramite un
adattatore USB-CAN via la [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
usando lo stesso framing SLCAN e lo stesso protocollo CAN dei due strumenti compagni
da desktop, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) e
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). L'obiettivo è riunire i flussi di lavoro principali di questi due strumenti in un'unica scheda del browser, non una demo semplificata di essi; la parità completa non è ancora raggiunta (vedi «Non ancora coperto» più sotto) - le schede Flasher Studio e Tester Studio inviano e
ricevono le trame CAN reali descritte in `docs/CANBUS.TXT` del
[repository firmware di URTC](https://github.com/JuanenRac/URTC).

### Cosa è reale e cosa è una sandbox

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

## 🧩 Ruolo in URTC

URTC-WEB-STUDIO è la versione per browser dei due programmi desktop di URTC, URTC-FLASHER e URTC-TESTER: una pagina React che parla con una scheda URTC tramite un adattatore USB-CAN con Web Serial, con lo stesso inquadramento SLCAN e lo stesso protocollo CAN (le sue tabelle e i suoi vettori sono generati da URTC-COMMON). Porta i loro flussi principali in una scheda del browser senza installare nulla, e lascia SWD/JTAG, che nessun browser può pilotare, al flasher desktop. Ha anche schede sandbox che esplorano i 25 utensili offline e non trasmettono nulla.

## 🏛️ Architettura

<p align="center">
  <img src="images/architecture.svg" alt="Architettura di URTC-WEB-STUDIO: chi lo usa, che cosa contiene e da che cosa dipende" width="100%">
</p>

Come si incastrano le parti di questo repository: chi lo usa, che cosa contiene e da che cosa dipende. L'immagine è disegnata da `docs/architecture.json` e verificata rispetto al codice.

### Stack tecnologico

- **Linguaggio:** TypeScript
- **Framework frontend:** React 18
- **Strumento di build:** Vite
- **Stile:** Tailwind CSS
- **Icone:** Lucide React
- **CRC32:** `crc-32` - controllo di integrità dell'immagine firmware, rispecchia
  il calcolo CRC32 proprio del bootloader
- **Trasporto hardware:** Web Serial API + framing SLCAN (nessuna dipendenza
  nativa, nessun server backend compagno)

## 🖼️ Schermate

<!-- urtc-shots -->
Catturate a 1920×1080 su un banco di prova, con dati di esempio e senza alcuna installazione reale dietro.

<table>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/control.png" alt="Matrice degli utensili e controllo: i 25 profili utensile del firmware con i loro jumper e i comandi dell'utensile selezionato (scheda simulatore: non invia nulla al bus)." width="100%"><br><sub>Matrice degli utensili e controllo: i 25 profili utensile del firmware con i loro jumper e i comandi dell'utensile selezionato (scheda simulatore: non invia nulla al bus).</sub></td>
<td width="50%" valign="top"><img src="images/screenshots/oled.png" alt="OLED e monitor hardware: la schermata di stato dell'utensile, i cinque jumper di identificazione, il LED di stato e l'anello da 8 LED (scheda simulatore)." width="100%"><br><sub>OLED e monitor hardware: la schermata di stato dell'utensile, i cinque jumper di identificazione, il LED di stato e l'anello da 8 LED (scheda simulatore).</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/flasher.png" alt="Flasher: la mappa flash della scheda, l'immagine e il suo manifesto pronti all'invio e le opzioni di un aggiornamento CAN-OTA (scheda modellata; non si invia nulla)." width="100%"><br><sub>Flasher: la mappa flash della scheda, l'immagine e il suo manifesto pronti all'invio e le opzioni di un aggiornamento CAN-OTA (scheda modellata; non si invia nulla).</sub></td>
<td width="50%" valign="top"><img src="images/screenshots/thermal.png" alt="Ispezione termica: un'immagine a falsi colori di una matrice a infrarossi 32×24 con un punto caldo simulato (scheda simulatore)." width="100%"><br><sub>Ispezione termica: un'immagine a falsi colori di una matrice a infrarossi 32×24 con un punto caldo simulato (scheda simulatore).</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="images/screenshots/tester.png" alt="Diagnostica del tester: la scatola nera e i contatori termici nel tempo, letti da una scheda modellata." width="100%"><br><sub>Diagnostica del tester: la scatola nera e i contatori termici nel tempo, letti da una scheda modellata.</sub></td>
<td width="50%"></td>
</tr>
</table>
<!-- /urtc-shots -->

## ✨ Funzionalità

### Flasher Studio - copertura reale delle funzionalità

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

#### SWD/JTAG - non disponibile da un browser, per design

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

### Tester Studio - copertura reale delle funzionalità

Portato dai pannelli del deck Qt Quick di `URTC-TESTER`
(`assets/qml/TesterDeck.qml`), contro gli stessi CAN ID:

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

- **Scheda Evidenze.** Legge i record (`urtc-evidence/1`) che scrivono il flasher, il tester e l'updater, dai file scelti dalla persona (non si carica nulla), controlla ciascuno con le stesse regole e lo stesso digest del codice comune e li elenca dal più recente, con filtri per tipo, risultato e testo, un riepilogo, il problema di ogni record non valido e un download CSV; la pagina è nelle otto lingue.

- **Frame costruiti da funzioni pure.** I frame dei pannelli (LED e anello di stato, passthrough SPI, funzioni opzionali, ugello ed estrusore della testa per stampante 3D, impulso di saldatura, movimenti del motore passo-passo) sono costruiti in `toolFrames.ts` e quelli dell'aggiornamento del firmware (START_UPDATE, i quattro blocchi di firma, i frame di dati dell'immagine e END_UPDATE) in `flashFrames.ts`; un valore che non sta nel suo campo viene portato al più vicino che ci sta, e i test fissano i byte.

- **Banco del rack con risposte.** Il rack simulato risponde a ogni ordine con il suo frame di risposta (una conferma, o un rifiuto con il motivo); `rackSim.ts` lo scrive e lo legge (`encodeRackReply`, `parseRackReply`), il pannello del banco dice il motivo nella lingua della pagina e un comando trattenuto perché troppo presto è un rifiuto con il suo motivo, come nel firmware.

- **Scheda Tracce CAN.** Apre una traccia registrata (`.trc` o `.asc`) ed elenca le sue trame nominate con la specifica (`canTrace.ts`, con gli stessi schemi dei pannelli): i rifiuti e i guasti sono evidenziati, come le trame troppo corte, duplicate, fuori ordine o seguite da un lungo silenzio; la tabella filtra per identificatore, tipo, nodo, risultato, tempo e testo, una linea del tempo mostra dove sono i rifiuti e la selezione si salva in CSV o JSON. Il file viene letto nella pagina (non viene caricato nulla e nulla di ciò che contiene viene eseguito), fino a 5 MB e 200.000 trame; la pagina è in otto lingue.

<!-- urtc-section:heads -->
### Più teste utensile su un bus

Il firmware può far condividere un bus CAN a più teste utensile (l'estensione multinodo). È **disattivata per impostazione predefinita**, e un bus con una sola testa funziona esattamente come prima. La finestra **Teste** trova le teste, elenca ciascuna con indirizzo, utensile e numero di serie, e mostra il suo stato: pronta, selezionata, conflitto di indirizzo, guasto memorizzato, nel suo bootloader o persa. Ne selezioni una, il programma chiede conferma e solo dopo le invia qualcosa; finché sul bus ci sono più teste, un comando viene rifiutato finché una non è selezionata e l'ha confermato. Se la testa selezionata si perde, tutte le teste passano allo stato sicuro (una casella della finestra lo disattiva). Provata solo contro un modello del bus, non con schede. Vedi `docs/MULTINODE.md` in URTC-COMMON.
<!-- /urtc-section:heads -->

## 🔒 Sicurezza e protezione

| Minaccia | Difesa |
|---|---|
| Un frame malformato raggiunge il filo o lo schermo | Entrambe le direzioni del collegamento SLCAN sono validate: un identificatore fuori da `0x000`-`0x7FF`, un payload oltre 8 byte o un byte fuori da `0x00`-`0xFF` viene rifiutato prima di essere scritto, e una riga in ingresso che non è un vero frame SLCAN viene scartata |
| Un segreto viaggia nella pagina | L'app non contiene alcuna chiave di firma: Flasher Studio invia solo la firma che la compilazione di URTC ha pubblicato accanto a ogni immagine, quindi la pagina può essere ospitata pubblicamente |
| Un'immagine firmware sbagliata o manomessa | Un manifesto il cui `sha256` non coincide con il file blocca il flashing; ogni immagine di una release ufficiale porta una firma di release Ed25519 che la pagina verifica nel browser prima di inviare l'immagine |
| Una risposta simulata scambiata per reale | Le schede sandbox non trasmettono nulla e, con una scheda collegata, non rispondono nulla; i loro frame sono marcati SIM e una traccia riprodotta REPLAY |
| Un'azione sulla scheda per errore | Laser, trapano, polimerizzazione UV, saldatura, riscaldatori, movimento, jetting di pasta, scritture nella memoria della scheda, frame rischiosi digitati a mano e un'immagine firmata con la chiave pubblica di sviluppo chiedono prima una conferma |
| Un attuatore lasciato in funzione | Ogni utensile con watchdog nel firmware è mantenuto vivo da un reinvio e spento quando si sostituisce il pannello, si cambia scheda, si scollega la scheda o si chiude la pagina; STOP ALL spegne tutto ciò che la pagina mantiene vivo |
| Una pagina che carica codice da altrove | Una content security policy: script solo dalla pagina stessa, connessioni solo a se stessa e a GitHub |

STOP ALL è un comando software, non un arresto di emergenza, e nessuno dei controlli sopra è una funzione di sicurezza.

### Separazione del simulatore e conferme (controlli software, non funzioni di sicurezza)

- Le schede sandbox (Control, OLED, Thermal IR) non trasmettono nulla. Le loro trame sono contrassegnate SIM e, finché è collegata una scheda, non producono alcuna risposta simulata. Dei messaggi predefiniti dell'analizzatore di protocollo vengono inviate a una scheda collegata solo le semplici interrogazioni; il resto resta simulato.
- Tester Studio mostra un pannello utensile solo per l'utensile che la scheda stessa ha segnalato (`0x111`), e nessuno prima che la scheda abbia risposto.
- Laser, trapano, polimerizzazione UV, saldatura, riscaldatori, movimento, erogazione di pasta, scritture nella memoria della scheda e trame digitate a mano rischiose richiedono prima una conferma.
- **FERMA TUTTO** nell'intestazione (visibile a connessione attiva) spegne ogni attuatore che questa pagina mantiene attivo; chiudere la pagina e disconnettersi fanno lo stesso. È un comando software, non un arresto di emergenza.
- Flashare un'immagine firmata con la chiave di sviluppo pubblica chiede prima una conferma, perché quella chiave non prova nulla su chi ha creato l'immagine.
- Quando la scheda dichiara un errore critico, il banner indica anche il motivo della protezione contro la fuga termica se la scheda lo comunica.
- **Riproduzione di una traccia registrata** (CAN Bus Protocol Analyzer): un file `.trc` o `.asc`, per esempio quello esportato dal Raw Bus Monitor, riproduce i suoi frame ricevuti nel registro e nei pannelli senza scheda, da 0,25x a 10x e volendo in ciclo. I frame sono marcati REPLAY, non si trasmette nulla, una registrazione non risponde mai a una richiesta, non viene mai esportata come qualcosa che ha detto la scheda e la riproduzione va in pausa finché una scheda è collegata.

### Nota di sicurezza: nessuna chiave di firma in questa app

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

## 🔌 Interfacce

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

### Validazione dei frame CAN

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

## 🚀 Avvio rapido

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

La pagina compilata dichiara una content security policy (script solo dalla pagina stessa; connessioni solo verso se stessa e GitHub) e carica ogni scheda alla prima apertura. `npm run test:e2e` la pilota in un vero Chromium davanti a una scheda modellata; non è stata provata con un adattatore reale.

<!-- urtc-section:compatibility -->
### Requisiti e compatibilità

Quali versioni dei programmi URTC funzionano insieme, e quale versione del protocollo parla ciascuna, è elencato nella tabella di compatibilità generata da URTC-COMMON: [docs/COMPATIBILITY.md](https://github.com/JuanenRac/URTC/blob/main/docs/COMPATIBILITY.md). Le note di una versione dei repository che includono `tools/changelog_section.py` (il firmware, il flasher, il tester e l'updater) sono la sezione del CHANGELOG di quella versione seguita da questa tabella: `python tools/changelog_section.py VERSION --compat`.
<!-- /urtc-section:compatibility -->

## 🧪 Test

`npm test` (Vitest) esegue 792 test della logica pura: parsing SLCAN, abbinamento di richieste e risposte, controlli di immagini firmware e manifesti, firme di release, limiti degli utensili, conferme, le regole che separano il simulatore dal bus reale, esportazione e riproduzione di tracce, il selettore dei nodi, il simulatore del rack, la registrazione di sessione salvata, la copia offline, la sincronizzazione del firmware e le otto lingue dell'interfaccia. `npm run lint` controlla i tipi del codice e `npm run test:e2e` esegue 21 controlli end-to-end in un vero Chromium contro un adattatore e una scheda modellati (`npm run test:coverage` aggiunge una soglia di copertura). Le schermate e il trasporto Web Serial non hanno test unitari propri; i controlli end-to-end li pilotano. Niente di tutto questo è girato contro un vero adattatore o una vera scheda.

## 🏗️ Compilazione e rilascio

### GitHub Pages (disattivato finché il proprietario non lo attiva)

Il repository può pubblicare il sito compilato su GitHub Pages (workflow `.github/workflows/pages.yml`: `npm ci`, controllo dei tipi, test, `npm run build` con il percorso base del progetto, poi `upload-pages-artifact` e `deploy-pages`). **Il workflow è disattivato**: i suoi due job vengono eseguiti solo se la variabile del repository `URTC_PAGES_ENABLED` vale `true` (Settings > Secrets and variables > Actions > Variables), cosa che il proprietario fa dopo la prima release ufficiale firmata di URTC. La compilazione esegue poi `npm run sync-firmware -- --require-official`: prende solo il firmware dell'ultima release ufficiale (mai una pre-release, mai il tag di ripiego di `firmware-release.json`), rifiuta qualsiasi file senza una firma di release valida e qualsiasi immagine applicativa compilata con la chiave pubblica di sviluppo, quindi la pagina pubblicata non può contenere immagini della chiave di sviluppo. Anche Pages va attivato una volta (Settings > Pages > Source: GitHub Actions); con la variabile non impostata il workflow viene saltato. Web Serial richiede un browser basato su Chromium e https, che Pages fornisce.

La `version` di `package.json` e quella di `urtc.project.json` cambiano solo con un passo esplicito (`python bump.py`, che le tiene uguali e scrive la voce del changelog); `build.bat` / `build.sh`, `npm run build`, `npm run dev`, `npm run lint` e `npm run preview` non cambiano mai la versione.

## 📂 Struttura del repository

<p align="center">
  <img src="images/repository-structure.svg" alt="Struttura del repository URTC-WEB-STUDIO" width="100%">
</p>

<details>
<summary>Versione testuale dell'albero</summary>

```text
URTC-WEB-STUDIO/
├── src/                                           l'app: componenti, hook, la logica CAN, SLCAN e firmware, gli otto file di lingua e le tabelle generate
├── docs/                                          architettura, compilazione ed esecuzione, contratto di integrazione
├── e2e/                                           controlli end-to-end e il modello della scheda
├── public/                                        firmware incluso, header, manifesto web
├── scripts/                                       sincronizzazione del firmware e service worker
├── tools/                                         controllo di compilazione e strumenti condivisi
├── images/                                        banner e immagini di questo README
├── .github/                                       workflow di CI e modelli per issue e pull request
├── build.sh build.bat                             script di compilazione
├── build-test.sh build-test.bat                   script di compilazione e test che non cambiano nulla nel repository
├── test.sh test.bat                               eseguono i test
├── urtc.project.json                              manifesto: versione, ruolo, maturità e comando di compilazione
├── CHANGELOG.md                                   che cosa è cambiato in ogni versione
├── SECURITY.md SUPPORT.md LICENSE                 politica di sicurezza, supporto e licenza
├── CONTRIBUTING.md CODE_OF_CONDUCT.md             come contribuire e codice di condotta
├── .gitattributes .gitignore                      impostazioni di Git
├── dev.sh dev.bat                                 installare e avviare il server di sviluppo
├── bump.py bump_manifest_version.py               script che alzano la versione
├── index.html                                     pagina di ingresso di Vite
├── package.json package-lock.json tsconfig.json   pacchetti, versioni bloccate, TypeScript e Vite
├── playwright.config.ts vite.config.ts            impostazioni dei controlli end-to-end
├── playwright.screenshots.config.ts               Impostazioni Playwright per le schermate del README
├── urtc_i18n.lock.json                            blocco dei file di lingua generati
└── NOTICE LICENSE.md                              avviso di copyright e licenza della documentazione
```

</details>

L'elenco annotato di ogni file sorgente, una riga per file, è in [docs/SOURCE_MAP.md](docs/SOURCE_MAP.md).

## 🗺️ Roadmap e limiti noti

- Una modalità di solo ascolto e la scelta manuale della velocità: non ci si può agganciare a un bus su cui nessuna scheda risponde.
- La lettura dell'immagine termica non controlla prima che il sensore sia pronto e non ritenta un blocco perso.
- Scaricare un file firmware direttamente dalla release GitHub nel browser: GitHub serve i file di una release da un host senza intestazioni CORS, quindi il download può essere bloccato (l'immagine inclusa, o un file scelto dal disco con il suo `.manifest.json`, funzionano sempre).

## 🌍 Lingue

Il README e i testi esistono in inglese, spagnolo, francese, italiano, tedesco, cinese, giapponese e portoghese europeo. I nomi del cinese e del giapponese nell'elenco delle lingue sono scritti nella loro lingua, come quelli delle altre lingue dell'elenco.

## 🔗 Progetti correlati

URTC è fatto di repository indipendenti, ciascuno con la propria versione, i propri test e il proprio README. Ecco la famiglia, per gruppi:

* **URTC Tool Platform:**
  * [URTC](https://github.com/JuanenRac/URTC) - firmware della scheda della testa utensile (25 profili utensile, bootloader CAN) e riferimento del protocollo CAN.
  * [URTC-COMMON](https://github.com/JuanenRac/URTC-COMMON) - il protocollo CAN scritto una sola volta come dati (specifica, tabelle generate, vettori di conformità) e il codice condiviso dai programmi.
  * [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER) - strumento desktop che aggiorna il firmware della scheda via CAN o via SWD/JTAG.
  * [URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY) - gateway davanti al bus CAN: lascia passare solo gli identificatori di un elenco, ne limita la frequenza e chiede una chiave di sessione.
  * [URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK) - logica C indipendente dall'hardware e protocollo di comandi per un portautensili con preriscaldamento e tracciamento del ciclo di vita.
  * [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER) - tester desktop del bus CAN in tempo reale che mostra i comandi e la telemetria del profilo utensile segnalato da una scheda.
  * [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL) - protocollo di frame del sensore in C e un companion Python termico/RGB per una testa utensile di ispezione.
  * **URTC-WEB-STUDIO** (questo repository) - app per browser che programma e collauda la scheda via Web Serial e SLCAN, senza installare nulla.
* **Ecosystem Operations:**
  * [URTC-DEVTOOLS](https://github.com/JuanenRac/URTC-DEVTOOLS) - gli strumenti di repository condivisi della famiglia come un insieme versionato, con un file di lock che distingue una copia modificata da una rimasta indietro.
  * [URTC-DOCS](https://github.com/JuanenRac/URTC-DOCS) - architettura, interfacce, base di sicurezza e catalogo generato dell'ecosistema, più gli strumenti che confrontano tutti i repository.
  * [URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER) - strumento desktop che rileva, installa e aggiorna i repository della famiglia URTC, un'azione esplicita alla volta.

**Progetti fratelli (indipendenti, con la stessa base e gli stessi strumenti):**

* **[HYDRA-UMC-DOCS](https://github.com/JuanenRac/HYDRA-UMC-DOCS)** - progetto fratello: il centro di documentazione di HYDRA-UMC, un ecosistema indipendente che condivide base e strumenti con questo
* **[ARMOR-DOCS](https://github.com/JuanenRac/ARMOR-DOCS)** - progetto fratello: il centro di documentazione di A.R.M.O.R., l'ecosistema di sicurezza, anch'esso indipendente e sulla stessa base
* **[JuanenRac](https://github.com/JuanenRac/JuanenRac)** - il profilo e il pannello di stato di tutti gli ecosistemi

## 📚 Documentazione

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — come la UI, le
  impostazioni persistite e l'autorità del trasporto esterno restano
  separate, e perché le schede sandbox devono esporre stati offline/non
  disponibile invece di presentare dati simulati come reali.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — il percorso di
  validazione non mutante `build-test.bat`/`.sh` (TypeScript + test, senza
  modifiche a versione o CHANGELOG), `dev.bat`/`.sh` per lo sviluppo
  locale, e perché il materiale di firma OTA non appartiene mai alla
  configurazione del browser.
- [`docs/TRACE_VIEWER.md`](docs/TRACE_VIEWER.md) — cosa legge la scheda Tracce CAN, come nomina ed evidenzia ogni trama, i suoi limiti e il CSV e il JSON che scrive.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — cosa
  deve fare questo client di fronte a uno schema sconosciuto, un'identità
  del target mancante o un risultato API malformato, e perché la reale
  autorità di flashing resta lato server o negli strumenti desktop
  dedicati.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — stack tecnologico e linee guida di codifica per una pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — gli standard di comportamento attesi in questa comunità.
- **[SECURITY.md](SECURITY.md)** — come segnalare una vulnerabilità, e le reali aree di attenzione sulla sicurezza di questo progetto.
- **[SUPPORT.md](SUPPORT.md)** — dove porre domande e segnalare bug.
- **[LICENSE.md](LICENSE.md)** — la licenza propria di questo progetto.

## 🤝 Contribuire e comunità

* Prima di una pull request esegui `URTC_CI=1 python tools/ci_validate.py`: deve passare. Vedi [CONTRIBUTING.md](CONTRIBUTING.md) e il [codice di condotta](CODE_OF_CONDUCT.md).
* Il README esiste in otto lingue: una modifica del testo si fa in tutti e otto i file, e le sezioni condivise con altri repository le scrive `tools/readme_sections.py` di URTC-COMMON.
* Una modifica al protocollo CAN parte da URTC-COMMON (`spec/can_protocol.json`) e arriva in questo repository tramite la copia verificata.
* Non descrivere come funzionante su una scheda ciò che è stato solo compilato.
* Segnala una vulnerabilità in privato: [SECURITY.md](SECURITY.md). Domande, idee e segnalazioni: electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTORE

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

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

**Copia offline e installazione (nuovo, verificato solo con test e un browser):** la compilazione scrive un service worker (`sw.js`) e un manifest di applicazione web; dopo la prima visita via https (o su localhost) il browser conserva la pagina, i suoi script e il firmware incluso, l'intestazione dice **Funziona offline** e lo Studio si apre senza rete (l'intestazione dice allora **Offline**); dove il browser lo offre, un pulsante **Installa** installa lo Studio come applicazione. La pagina e il manifest del firmware vengono sempre richiesti prima alla rete, così chi è online riceve i più recenti; `version.json` non è mai servito dalla copia; una nuova versione attende la chiusura delle schede aperte prima di subentrare. L'API di GitHub non viene conservata: senza rete non si può consultare l'ultima release e si usano solo le immagini incluse.

**Contatori termici nel tempo (nuovo, verificato solo con test e una scheda modellata):** nella scheda Scatola nera i contatori termici a vita (`0x1AA` / `0x1AB`) possono essere riletti ogni 10 s, 30 s, 1 min o 5 min; ogni lettura si aggiunge a uno storico conservato nel browser che disegna le ore di riscaldamento e i guasti nel tempo, può essere scaricato come CSV e cancellato; un contatore che scende (un'altra scheda) fa ripartire lo storico.

**Sessione salvata (nuovo, verificato solo con test e una scheda modellata):** il Monitor del bus salva i frame come log e come record che indica il log tramite il suo SHA-256 e la sua dimensione, nello stesso formato del Tester desktop; **Verifica una sessione salvata** prende il record e il suo log e dice se vanno insieme. Mostra che un log non è stato modificato. Dove il browser sa fare firme Ed25519, il record porta anche una firma fatta con una chiave di questo browser (creata al primo uso e conservata nel browser): mostra che il record non è stato modificato dopo la firma e non dice chi possiede la chiave. Il monitor può anche mostrare solo gli ID digitati, o solo i frame con dati cambiati (la frequenza e il carico continuano a contare ogni frame).

**Avviso di versione (nuovo, verificato solo con test):** la compilazione scrive un `version.json` accanto alla pagina; la pagina compilata lo confronta una volta, all'apertura e solo con la stessa origine, con la propria versione e segnala quando ne viene servita una maggiore, con un pulsante Ricarica. Niente si ricarica da solo, una versione uguale o più vecchia non dice nulla e un file mancante o l'assenza di rete restano in silenzio.

**PID del riscaldatore (nella scheda Funzioni opzionali; nuovo, verificato solo con simulazioni):** Tester Studio legge lo stato del PID del riscaldatore del firmware (`0x1B9` / `0x1BA`: i guadagni in vigore, lo stato e l'uscita dell'ultimo ciclo di controllo), salva i guadagni (da 0 a 600) e avvia o annulla l'autotuning a relè, che scalda la punta attorno al setpoint attuale del saldatore (da 100 a 445 C) e salva i guadagni trovati. Salvare i guadagni e avviare l'autotuning chiedono conferma, annullare no; un guadagno che non sia un numero da 0 a 600 viene rifiutato prima di inviare qualsiasi cosa. La funzione va prima attivata tra le funzioni opzionali; nulla di tutto ciò è stato provato con una scheda reale.
