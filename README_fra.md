<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="URTC Web Studio Logo" width="100%">
</p>

# URTC Web Studio

<p align="center">
  <a href="README.md">🇺🇸 English</a> |
  <a href="README_spa.md">🇪🇸 Español</a> |
  🇫🇷 <b>Français</b> |
  <a href="README_ita.md">🇮🇹 Italiano</a> |
  <a href="README_deu.md">🇩🇪 Deutsch</a> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  <a href="README_jpn.md">🇯🇵 日本語</a> |
  <a href="README_por.md">🇵🇹 Português</a>
</p>

### Les principaux flux du flasheur et du testeur d'URTC dans un onglet de navigateur, via un adaptateur USB-CAN et Web Serial

<p align="center">
  <img src="https://img.shields.io/badge/Licence-GPL%203.0-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Tests-577-2ea44f.svg" alt="Tests">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>

---

**Vérification d'honnêteté - ce qui fonctionne réellement aujourd'hui :** `npm test` (Vitest) couvre la logique pure : l'analyse SLCAN, l'appariement requête/réponse, les contrôles d'image de firmware et de manifeste, les limites des outils, les confirmations, les règles qui séparent le simulateur du vrai bus, l'export de traces et les huit langues de l'interface. Les écrans et le transport Web Serial lui-même n'ont pas de tests unitaires (les contrôles de bout en bout à la fin de ce paragraphe les pilotent face à une carte modélisée), et rien de tout cela n'a tourné contre une vraie carte URTC dans cet environnement (pas d'adaptateur USB-CAN ici pour le tester) : Flasher Studio, Tester Studio et l'Analyseur de Protocole CAN Bus sont du vrai code vérifié uniquement par ces tests, la vérification de types (`npm run lint`) et la relecture du code. Control/OLED/Specs-BOM/Thermal IR Inspection sont des onglets bac à sable ouvertement déclarés comme tels, sans aucun trafic CAN. Voir `CHANGELOG.md` pour savoir exactement ce qui a été livré jusqu'à présent. `npm run test:e2e` ouvre en plus la page compilée dans un vrai navigateur (Playwright) face à une carte modélisée : c'est ainsi que sont vérifiés la copie hors ligne, l'historique des compteurs thermiques et la session enregistrée.

---

> **État de la sûreté et de la cybersécurité :** cet écosystème n'est pas un système de sécurité certifié et aucune carte URTC assemblée n'existe encore. Les bootloaders contrôlent les images de firmware par CRC32 et un HMAC-SHA256 à clé partagée, pas par une signature asymétrique (prévue) ; les images d'application publiées sont signées avec la clé publique de développement (`signing_key_kind: dev`), si bien que n'importe qui peut produire une image acceptée par le bootloader ; rien n'a été transmis à une carte réelle. Lisez la [base de sécurité](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) et le [modèle de menaces](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md) avant de vous fier à une affirmation d'ici pour la sécurité d'une personne.

## 📋 En un coup d'œil

| | |
|---|---|
| Version | `0.3.7` |
| Maturité | Fonctionnel |
| Tests | 577 (`npm test`) |
| Technologie | Web Serial API / TypeScript |
| Cible | Un navigateur web sur le PC de l'utilisateur |
| Sur matériel réel | Simulé seulement : testé avec des émulateurs, des doubles de test ou des simulateurs ; aucune exécution sur du matériel réel n'est consignée pour cette version |

**Aller à :** [Présentation](#-présentation) · [Architecture](#-architecture) · [Fonctionnalités](#-fonctionnalités) · [Sécurité](#-sécurité-et-protection) · [Interfaces](#-interfaces) · [Démarrage rapide](#-démarrage-rapide) · [Tests](#-tests) · [Structure](#-structure-du-dépôt) · [Liés](#-projets-liés)

<!-- urtc-section:status_web_studio -->
## 🚦 État du projet

🟢 fait et vérifié · 🟡 fonctionne, avec des limites connues · 🟠 à moitié fait ou non vérifié · 🔴 non fait ou non fonctionnel. Rien n'est vert si cela n'a jamais tourné sur du vrai matériel.

| Partie | État | Ce que le dépôt peut démontrer |
| --- | :---: | --- |
| Logiciel | 🟡 | Fonctionne sur un PC et face au simulateur ; jamais utilisé avec une vraie carte. |
| Interface | 🟡 | La fenêtre fonctionne et est vérifiée face à une carte simulée ; non essayée avec un vrai adaptateur. |
| Tests | 🟢 | La suite de tests passe dans la CI à chaque push. |
| Matériel réel | 🟠 | Pas encore d'essai sur une vraie carte : l'essai au banc reste à faire. |
| Documentation | 🟡 | README en huit langues et documents de référence ; les traductions n'ont pas été relues par des locuteurs natifs. |

<!-- /urtc-section:status_web_studio -->

## 🎯 Présentation

Un compagnon basé sur navigateur pour l'**Universal Robot Tool Controller (URTC)** -
une app monopage React/Vite qui est conçue pour parler à du matériel URTC réel (elle n'en a jamais piloté) via un adaptateur
USB-CAN grâce à la [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
utilisant le même framing SLCAN et le même protocole CAN que les deux outils
compagnons de bureau, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) et
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). L'objectif est de réunir les principaux flux de travail de ces deux outils dans un seul onglet de navigateur, pas une démo simplifiée de ceux-ci ; la parité complète n'est pas encore atteinte (voir « Pas encore couvert » plus bas) - les onglets Flasher Studio et Tester Studio envoient et
reçoivent les vraies trames CAN décrites dans `docs/CANBUS.TXT` du
[dépôt firmware d'URTC](https://github.com/JuanenRac/URTC).

### Ce qui est réel vs. ce qui est un bac à sable

Cette app a deux types d'onglets :

- **Onglets réels, pilotés par le matériel** - Flasher Studio, Tester Studio, et le
  CAN Bus Protocol Analyzer. Ceux-ci ne font quoi que ce soit qu'une fois que vous
  avez connecté un vrai adaptateur USB-CAN (bouton en haut à droite de l'en-tête) ;
  chaque commande qu'ils envoient et chaque lecture qu'ils affichent provient du bus CAN (ce chemin n'a jamais été exécuté avec un vrai adaptateur ni une vraie carte). Cela inclut la **lecture réelle de la caméra thermique** - le panneau
  « Thermal Inspection » de Tester Studio (`0x250`/`0x251`/`0x254`/`0x255`) interroge
  la matrice IR MLX90640 réelle de la tête d'outil via CAN.
- **Onglets bac à sable hors ligne** - Control (catalogue d'outils), OLED, Specs/BOM,
  et Thermal IR Inspection. Ceux-ci vous permettent d'explorer le catalogue de 25
  outils, prévisualiser les écrans d'état OLED, parcourir le BOM/pinouts, et voir un
  flux de caméra thermique simulé, tout cela sans aucun matériel connecté. Le
  commutateur « FW v0.0 / v0.1 » de l'en-tête n'affecte que ces onglets bac à sable
  (quels profils d'outils un build de firmware donné débloquerait) - il n'a aucun
  rapport avec ce que rapporte une carte réelle connectée.
  - **Ne confondez pas les deux vues thermiques** : l'onglet autonome « Thermal IR
    Inspection » (`ThermalCameraViewer.tsx`) est du bruit `Math.random()` à 100%
    côté client, sans aucun trafic CAN - c'est une maquette d'interface, pas une
    lecture de capteur. Les vraies données MLX9064x n'apparaissent que dans le
    panneau « Thermal Inspection » de Tester Studio, et seulement une fois le
    matériel connecté.

## 🧩 Rôle dans URTC

URTC-WEB-STUDIO est la version navigateur des deux programmes de bureau d'URTC, URTC-FLASHER et URTC-TESTER : une page React qui parle à une carte URTC par un adaptateur USB-CAN avec Web Serial, avec le même cadrage SLCAN et le même protocole CAN (ses tableaux et vecteurs sont générés à partir d'URTC-COMMON). Elle apporte leurs principaux flux dans un onglet de navigateur, sans rien installer, et laisse SWD/JTAG, qu'aucun navigateur ne peut piloter, au flasheur de bureau. Elle a aussi des onglets bac à sable qui explorent les 25 outils hors ligne et ne transmettent rien.

## 🏛️ Architecture

<p align="center">
  <img src="images/architecture.svg" alt="Architecture de URTC-WEB-STUDIO : qui l'utilise, ce qu'il contient et de quoi il dépend" width="100%">
</p>

Comment les parties de ce dépôt s'articulent : qui l'utilise, ce qu'il contient et de quoi il dépend. L'image est dessinée à partir de `docs/architecture.json` et vérifiée par rapport au code.

### Stack technique

- **Langage :** TypeScript
- **Framework frontend :** React 18
- **Outil de build :** Vite
- **Style :** Tailwind CSS
- **Icônes :** Lucide React
- **CRC32 :** `crc-32` - vérification d'intégrité de l'image firmware, reflète le
  propre calcul de CRC32 du bootloader
- **Transport matériel :** Web Serial API + framing SLCAN (aucune dépendance
  native, aucun serveur backend compagnon)

## ✨ Fonctionnalités

### Flasher Studio - couverture réelle des fonctionnalités

Porté depuis le propre `flasher_protocol.py` d'`URTC-FLASHER`, contre les mêmes
CAN ID :

- **Mise à jour CAN-OTA de la carte principale** (`0x7F0`-`0x7F7`) : déclencheur
  d'entrée dans le bootloader, HMAC-SHA256 à clé partagée (testé uniquement contre un simulateur), transfert paginé avec
  contrôle de flux par ACK de page et retry/backoff, CRC32 + END_UPDATE avec
  version déclarée, et gestion de statut terminal (y compris la récupération d'une
  trame de confirmation perdue de la même manière que l'outil de bureau - il
  réinterroge la version plutôt que de signaler un faux échec).
- **Mise à jour CAN-OTA de l'esclave d'extension** (`0x210`-`0x219`, relayée via le
  propre pont I2C de la carte principale) - même schéma de signature/CRC, aucun
  ACK de page ni battement de cœur sur ce chemin (correspond au protocole réel ; la
  progression est interrogée, pas poussée).
- **Autorisation de downgrade** (`0x7FD`) - une case à cocher protégée par
  confirmation qui autorise la tentative actuelle à contourner le contrôle
  anti-rollback du bootloader, pour un retour délibéré à une version plus
  ancienne.
- **Effacement F-RAM avant flashage** (`0x192`), optionnel, carte principale
  uniquement.
- **Requête compteur d'erreurs CAN** (`0x7FB`/`0x7FC`, TEC/REC lus directement
  depuis les propres registres d'erreur du contrôleur CAN) - distingue un vrai
  problème de bus d'un problème côté application/bootloader.
- **Relecture/sauvegarde firmware via CAN** (`0x7FE`/`0x7FF`) - relit le contenu
  actuel de l'emplacement principal avant que vous ne l'écrasiez, au rythme de
  2KB/page avec ACK de l'hôte, et l'enregistre sous forme de téléchargement `.bin`.
- **Requête de version de carte en direct** (`0x7F8`/`0x7F9`/`0x7FA`/`0x7E9`) - affiche le
  vrai répondant (application ou bootloader), le HardwareID, et la version, pas un
  commutateur simulé.
- **Signature et empreinte publiées** - chaque image issue du build URTC est
  livrée avec `<file>.manifest.json` (version, `sha256` et la valeur `hmac_sha256` attendue par le bootloader, un HMAC-SHA256 à clé partagée et non une signature asymétrique) et `<file>.sha256`. L'application
  envoie cette signature publiée, un `sha256` du manifeste qui ne correspond
  pas au fichier **bloque** le flashage, et c'est la version du manifeste qui
  est annoncée au bootloader. Un fichier choisi sur le disque n'a pas de
  manifeste : il ne peut être flashé qu'avec une clé de signature saisie pour
  ce seul flashage (cartes de banc), sauf si son `.manifest.json` est choisi
  avec lui.
- **Numéro de correctif du firmware** (`0x7E9`, et le `0x218` étendu de
  l'esclave) - le firmware installé et l'image choisie sont affichés en
  majeur.mineur.correctif. Le correctif n'intervient dans la comparaison que si
  les deux côtés en portent un, une carte antérieure (elle n'envoie pas
  `0x7E9`) continue de fonctionner en majeur.mineur, et le correctif n'est
  placé dans END_UPDATE que vers un bootloader qui l'a annoncé. Le journal
  indique si l'image est plus ancienne, égale ou plus récente que ce que la
  carte a signalé.
- **Firmware de la release GitHub la plus récente** - les binaires sont des
  fichiers joints à la release de chaque version d'URTC, pas des fichiers git.
  La liste vient de l'API des releases de `JuanenRac/URTC` (seulement les
  images d'application de la carte choisie, chacune avec son `.sha256` et son
  `.manifest.json`) ; une image téléchargée doit correspondre aux empreintes
  publiées par la release, et les contrôles d'image, de manifeste et de
  signature restent en place. GitHub sert les fichiers depuis un hôte qui
  n'envoie pas d'en-têtes CORS, un navigateur peut donc ne pas pouvoir les
  télécharger : le journal le dit, et l'image peut être prise dans le dossier
  inclus, ou téléchargée depuis la page de la release et choisie avec
  Parcourir avec son `.manifest.json`.
- **Configuration de carte** : type de carte d'extension / variante de capteur
  MLX9064x / configuration d'outil libre (broches ID `11111`) / infos périphérique
  et numéro de série - `0x1A0`-`0x1A7`.

#### SWD/JTAG - non disponible depuis un navigateur, par conception

Il n'existe aucune API web capable de piloter une sonde de débogage SWD/JTAG - Web
Serial ne parle qu'à des périphériques à framing série (comme un adaptateur
USB-CAN), pas au protocole propre d'une sonde, et STM32CubeProgrammer/pyOCD sont
des sous-processus natifs que l'outil de bureau exécute. C'est une limitation
structurelle de l'exécution dans un bac à sable navigateur, pas une fonctionnalité
manquante ici. L'onglet SWD/JTAG dans Flasher Studio explique les commandes
exactes que l'outil de bureau `URTC Flasher` exécuterait localement, à titre de
référence - utilisez cet outil directement pour la programmation à puce complète,
les vérifications option-byte/RDP, ou une sauvegarde complète de la flash avant un
effacement de masse.

### Tester Studio - couverture réelle des fonctionnalités

Porté depuis les panneaux du propre deck Qt Quick d'`URTC-TESTER`
(`assets/qml/TesterDeck.qml`), contre les mêmes CAN ID :

- Un panneau par outil (fer à souder + dévidoir de fil, outils de mouvement à
  moteur pas-à-pas simple partagés, ramassage par vide, perceuse, AOI, laser,
  chauffage/mouvement/ventilateurs d'imprimante 3D, sonde de balayage,
  électroaimant, soudeuse par points/ultrasons, sonde volante incl. le chemin
  avancé ADS1115, séchage UV, retravail à air chaud, sertissage, inspection
  thermique, distribution de pâte), chacun envoyant les octets de commande réels
  de l'outil et décodant sa télémétrie réelle.
- **Case active + keepalive** pour chaque outil avec un watchdog de communication
  côté firmware (fer à souder, laser, séchage UV, retravail à air chaud, buse
  d'imprimante 3D - renvoi toutes les 150ms sous un watchdog de 250ms ; ventilateur
  de couche d'imprimante 3D - renvoi toutes les 400ms sous son propre watchdog de
  1000ms), avec les mêmes intervalles de renvoi que l'outil de bureau. La décocher,
  changer de panneau ou d'onglet, se déconnecter ou fermer la page envoie la
  commande d'arrêt de l'outil.
- **Global Controls** (`0x100`), passthrough SPI de **Expansion Board** + requête
  TMC DIAG0 (`0x180`-`0x183`), requête/effacement **F-RAM** (`0x190`-`0x192`),
  **Self-Test** (contrôles sûrs, au repos, par outil), un **Raw Bus Monitor** avec
  export de trace `.trc`/`.asc`, et un injecteur **Custom Frame** avec un
  intervalle de répétition optionnel - validé comme l'injecteur de trames propre
  au CAN Bus Protocol Analyzer : un identifiant hors de `0`-`7FF`, un octet de
  données invalide ou plus de 8 octets est refusé avec un message, jamais masqué,
  ignoré ni tronqué. Les identifiants que seule la carte émet sont refusés, et les
  écritures dans la mémoire de la carte, les commandes du bootloader et celles des
  actionneurs sont confirmées au préalable.
- **Detect Hardware** interroge le vrai outil actif (`0x110`/`0x111`) et la
  version de carte (`0x7F8`/`0x7F9`), et une erreur critique déclarée (`0x111`
  octet 1) apparaît comme une bannière de défaut en direct.

<!-- urtc-section:heads -->
### Plusieurs têtes d'outil sur un bus

Le firmware peut faire partager un bus CAN à plusieurs têtes d'outil (l'extension multinœud). Elle est **désactivée par défaut**, et un bus avec une seule tête fonctionne exactement comme avant. La fenêtre **Têtes** trouve les têtes, liste chacune avec son adresse, son outil et son numéro de série, et affiche son état : prête, sélectionnée, conflit d'adresse, défaut mémorisé, dans son bootloader ou perdue. Vous en sélectionnez une, le programme demande confirmation et ne lui envoie rien avant ; tant que plusieurs têtes sont sur le bus, une commande est refusée jusqu'à ce qu'une soit sélectionnée et l'ait confirmé. Si la tête sélectionnée est perdue, toutes les têtes passent à leur état sûr (une case de la fenêtre le désactive). Testé seulement contre un modèle du bus, pas avec des cartes. Voir `docs/MULTINODE.md` dans URTC-COMMON.
<!-- /urtc-section:heads -->

## 🔒 Sécurité et protection

| Menace | Défense |
|---|---|
| Une trame mal formée atteint le fil ou l'écran | Les deux sens de la liaison SLCAN sont validés : un identifiant hors de `0x000`-`0x7FF`, une charge de plus de 8 octets ou un octet hors de `0x00`-`0xFF` est refusé avant d'être écrit, et une ligne entrante qui n'est pas une vraie trame SLCAN est abandonnée |
| Un secret voyage dans la page | L'application ne contient aucune clé de signature : Flasher Studio n'envoie que la signature que la compilation d'URTC a publiée à côté de chaque image, si bien que la page peut être hébergée publiquement |
| Une image de firmware fausse ou manipulée | Un manifeste dont le `sha256` ne correspond pas au fichier bloque le flashage ; chaque image d'une release officielle porte une signature de release Ed25519 que la page vérifie dans le navigateur avant d'envoyer l'image |
| Une réponse simulée prise pour réelle | Les onglets bac à sable ne transmettent rien et, tant qu'une carte est connectée, ne répondent rien ; leurs trames sont marquées SIM et une trace rejouée REPLAY |
| Une action sur la carte par erreur | Laser, perceuse, polymérisation UV, soudure, chauffages, mouvement, jetting de pâte, écritures dans la mémoire de la carte, trames risquées saisies à la main et une image signée avec la clé publique de développement demandent d'abord une confirmation |
| Un actionneur qui continue de tourner | Chaque outil doté d'un chien de garde dans le firmware est maintenu en vie par un renvoi et coupé quand le panneau est remplacé, que l'onglet change, que la carte est déconnectée ou que la page se ferme ; STOP ALL coupe tout ce que la page maintient en vie |
| Une page qui charge du code d'ailleurs | Une politique de sécurité de contenu : scripts seulement de la page elle-même, connexions seulement vers elle-même et GitHub |

STOP ALL est une commande logicielle, pas un arrêt d'urgence, et aucun des contrôles ci-dessus n'est une fonction de sécurité.

### Séparation du simulateur et confirmations (contrôles logiciels, pas des fonctions de sécurité)

- Les onglets bac à sable (Control, OLED, Thermal IR) ne transmettent rien. Leurs trames portent la marque SIM et, tant qu'une carte est connectée, ils ne produisent aucune réponse simulée. Parmi les messages prédéfinis de l'analyseur de protocole, seules les requêtes simples sont envoyées à une carte connectée ; le reste reste simulé.
- Tester Studio n'affiche un panneau d'outil que pour l'outil que la carte a elle-même signalé (`0x111`), et aucun avant que la carte ait répondu.
- Laser, perceuse, séchage UV, soudage, éléments chauffants, mouvement, distribution de pâte, écritures dans la mémoire de la carte et trames saisies à la main présentant un risque demandent d'abord une confirmation.
- **TOUT ARRÊTER** dans l'en-tête (visible une fois connecté) éteint chaque actionneur que cette page maintient actif ; fermer la page et se déconnecter font de même. C'est une commande logicielle, pas un arrêt d'urgence.
- Flasher une image signée avec la clé de développement publique demande d'abord une confirmation, car cette clé ne prouve rien sur l'auteur de l'image.
- Quand la carte déclare une erreur critique, la bannière indique aussi la raison de la protection contre l'emballement thermique si la carte la signale.
- **Relecture d'une trace enregistrée** (CAN Bus Protocol Analyzer) : un fichier `.trc` ou `.asc`, par exemple celui qu'exporte le Raw Bus Monitor, rejoue ses trames reçues dans le journal et les panneaux sans carte, de 0,25x à 10x et éventuellement en boucle. Les trames sont marquées REPLAY, rien n'est transmis, un enregistrement ne répond jamais à une requête, n'est jamais exporté comme ce que dit la carte, et la relecture se met en pause tant qu'une carte est connectée.

### Note de sécurité : aucune clé de signature dans cette application

Depuis la 0.2.3, cette application ne contient **aucune** clé de signature
HMAC-SHA256. Le build URTC signe lui-même chaque image d'application (avec une clé privée uniquement pour les versions de release ; les images publiées utilisent la clé publique de développement) et publie la signature à côté ;
Flasher Studio ne fait que transporter cette signature - le même modèle que
le `URTC Flasher` de bureau. Le bundle JS ne contient rien de secret, la page
peut donc être hébergée publiquement.

La seule exception est une image compilée soi-même sans manifeste, pour une
carte de banc : l'application demande alors la clé de signature, la garde en
mémoire pour ce seul flashage et ne l'enregistre jamais. Les images signées
avec la clé PUBLIQUE de développement (`signing_key_kind: "dev"` dans le
manifeste) ne s'installent que sur les cartes dont le bootloader a été
compilé de la même façon - le journal l'indique. Voir
`docs/FIRMWARE_SIGNING.TXT` dans URTC.

Le dossier n'est **pas dans git** : `npm run sync-firmware` le crée (la CI et la construction Pages l'exécutent avant les tests et la construction). Tant qu'il n'y a pas de release officielle, le « latest » de GitHub répond 404 et `firmware-release.json` indique la release utilisée à la place (aujourd'hui la pré-release de banc) ; supprimez le fichier, ou changez son tag, quand une release officielle sera publiée. **Sécurité de la page** : les scripts, styles, polices et images viennent de la page elle-même (les polices sont livrées avec l'application, aucune requête ne part vers un serveur de polices), seuls les attributs de style qu'écrit React sont autorisés en ligne, et la page ne peut joindre que sa propre origine et les hôtes GitHub qui servent les releases (Content-Security-Policy dans l'`index.html` construit). Un hôte capable d'envoyer des en-têtes utilise `public/_headers` (la même politique, `Permissions-Policy: serial=(self)` et rien d'autre de puissant) ; GitHub Pages ne peut pas envoyer d'en-têtes, donc seule la politique contenue dans la page s'y applique.

`public/firmware/` contient exactement les fichiers publiés par URTC (mêmes
noms, mêmes octets, avec leurs fichiers associés). Les binaires d'URTC ne sont
pas dans git : ce sont des fichiers joints à la release de chaque version.
`npm run sync-firmware` télécharge la release la plus récente
(`npm run sync-firmware -- --tag v0.3.5` pour une release donnée), ou prend un
dossier local en argument (`npm run sync-firmware -- ../URTC/firmware` pour un
build de banc). Dans les deux cas il vérifie chaque empreinte et les champs de
signature avant de toucher à `public/firmware/`, et régénère
`src/lib/bundledFirmware.ts` ; un test vérifie le paquet par rapport à ses
manifestes.

Chaque fichier d'une release officielle a une signature de release (`<fichier>.sig`, Ed25519) : la synchronisation la vérifie lorsqu'elle est présente et refuse une signature incorrecte ; un jeu sans signatures (une pré-release de banc ou un build local) demande `--allow-unsigned`. La page vérifie la même signature dans le navigateur (Web Crypto) avant d'envoyer à une carte une image fournie ou une image d'une release GitHub, et s'arrête si elle n'est pas valide.

## 🔌 Interfaces

- Un adaptateur USB-CAN exécutant le firmware **SLCAN** (p. ex. un CANable
  exécutant `candlelight`/`slcan`, ou tout adaptateur parlant le protocole série
  SLCAN `lawicel` standard) - la même classe d'adaptateur que les deux outils de
  bureau supportent via leur propre transport Série.
- Le bus réglé à **500 kbit/s**. À la connexion, l'app essaie tour à tour 500, 250, 125 kbit/s et les autres débits standard, et garde le premier auquel une carte répond à une requête de version ; on ne peut pas encore choisir le débit à la main ni écouter sans qu'une carte réponde.
- Un navigateur avec support Web Serial - **Chrome ou Edge**. Firefox et Safari
  n'implémentent pas Web Serial et ne pourront pas se connecter du tout.
- Web Serial nécessite soit un contexte sécurisé (HTTPS) soit `localhost` - et ne
  peut pas être utilisé depuis l'intérieur d'un iframe. Si vous prévisualisez cette
  app dans un cadre intégré, ouvrez-la d'abord dans son propre onglet.

### Validation des trames CAN

Les deux sens de la liaison SLCAN sont validés avant que quoi que ce soit
n'atteigne l'UI ou le fil (`src/hooks/useSerialCanBus.ts`) :

- **Sortant** - `sendFrame()` refuse de sérialiser une commande dont
  l'identifiant sort de la plage CAN standard 11 bits (`0x000`-`0x7FF`),
  dont la charge utile dépasse 8 octets, ou dont un octet de charge utile
  sort de `0x00`-`0xFF`. L'UI affiche "Refusing malformed CAN frame: ..."
  au lieu d'écrire du texte invalide sur le port série.
- **Entrant** - `processBuffer()` exige une correspondance réelle
  `t<ID hex sur 3><DLC hex sur 1, 0-8><charge utile hex>` avant de
  transformer une ligne SLCAN reçue en `CanFrame` ; un DLC hors `0`-`8` ou
  une charge utile plus courte que sa propre longueur déclarée est
  journalisée dans la console et abandonnée plutôt que transmise à un
  panneau d'outil comme un octet `NaN`. Un horodatage optionnel de
  l'adaptateur en fin de trame reste accepté après une charge utile valide.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20 LTS+
- npm

### Installation

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### Mode développement

Exécute l'app avec le serveur de développement de Vite et le rechargement en
direct :
- **Windows :** double-cliquez sur `dev.bat` ou exécutez `npm run dev`
- **Linux/Mac :** exécutez `./dev.sh` ou `npm run dev`

Puis ouvrez `http://localhost:3000` dans Chrome ou Edge.

Le serveur de développement n'écoute que sur `localhost` : Web Serial fonctionne en https ou sur localhost, l'ouvrir au réseau n'apporterait rien.

### Build statique

Compile en un bundle statique et optimisé dans `dist/` :
- **Windows :** double-cliquez sur `build.bat` ou exécutez `npm run build`
- **Linux/Mac :** exécutez `./build.sh` ou `npm run build`

C'est un site statique simple - il n'y a aucun composant serveur intégré
(contrairement au propre `server.ts` d'`HYDRA-UMC STUDIO`). Prévisualisez le
dossier `dist/` compilé localement avec :

```bash
npm run preview
```

ou servez `dist/` avec l'hébergeur de fichiers statiques de votre choix. `npm run
lint` exécute le compilateur TypeScript en mode vérification uniquement.

La page construite déclare une politique de sécurité du contenu (scripts uniquement depuis la page elle-même ; connexions uniquement vers elle-même et vers GitHub) et charge chaque onglet à sa première ouverture. `npm run test:e2e` la pilote dans un vrai Chromium face à une carte modélisée ; elle n'a pas été essayée avec un vrai adaptateur.

<!-- urtc-section:compatibility -->
### Prérequis et compatibilité

Les versions des programmes URTC qui fonctionnent ensemble, et la version du protocole que parle chacune, figurent dans le tableau de compatibilité que génère URTC-COMMON : [docs/COMPATIBILITY.md](https://github.com/JuanenRac/URTC/blob/main/docs/COMPATIBILITY.md).
<!-- /urtc-section:compatibility -->

## 🧪 Tests

`npm test` (Vitest) exécute 577 tests de la logique pure : analyse SLCAN, appariement des requêtes et réponses, contrôles des images de firmware et des manifestes, signatures de release, limites d'outil, confirmations, les règles qui séparent le simulateur du vrai bus, export et relecture de traces, le sélecteur de nœuds, le simulateur de râtelier, l'enregistrement de session sauvegardé, la copie hors ligne, la synchronisation du firmware et les huit langues de l'interface. `npm run lint` vérifie les types du code et `npm run test:e2e` exécute 19 contrôles de bout en bout dans un vrai Chromium face à un adaptateur et une carte modélisés (`npm run test:coverage` ajoute un plancher de couverture). Les écrans et le transport Web Serial n'ont pas de tests unitaires propres ; les contrôles de bout en bout les pilotent. Rien de tout cela n'a tourné contre un vrai adaptateur ou une vraie carte.

## 🏗️ Compilation et publication

### GitHub Pages (désactivé tant que le propriétaire ne l'active pas)

Le dépôt peut publier le site compilé sur GitHub Pages (workflow `.github/workflows/pages.yml` : `npm ci`, vérification des types, tests, `npm run build` avec le chemin de base du projet, puis `upload-pages-artifact` et `deploy-pages`). **Le workflow est désactivé** : ses deux jobs ne s'exécutent que si la variable du dépôt `URTC_PAGES_ENABLED` vaut `true` (Settings > Secrets and variables > Actions > Variables), ce que le propriétaire fait après la première release officielle signée d'URTC. La compilation lance alors `npm run sync-firmware -- --require-official` : elle prend uniquement le firmware de la dernière release officielle (jamais une pré-release, jamais l'étiquette de repli de `firmware-release.json`), refuse tout fichier sans signature de release valide et toute image d'application compilée avec la clé publique de développement, si bien que la page publiée ne peut pas contenir d'images de la clé de développement. Pages doit aussi être activé une fois (Settings > Pages > Source: GitHub Actions) ; sans la variable, le workflow est ignoré. Web Serial nécessite un navigateur basé sur Chromium et https, ce que Pages fournit.

La `version` de `package.json` et celle de `urtc.project.json` ne changent que par une étape explicite (`python bump.py`, qui garde les deux égales et écrit l'entrée du journal des changements) ; `build.bat` / `build.sh`, `npm run build`, `npm run dev`, `npm run lint` et `npm run preview` ne changent jamais la version.

## 📂 Structure du dépôt

<p align="center">
  <img src="images/repository-structure.svg" alt="Structure du dépôt URTC-WEB-STUDIO" width="100%">
</p>

<details>
<summary>Version texte de l'arborescence</summary>

```text
URTC-WEB-STUDIO/
├── src/                                           l'application : composants, hooks, la logique CAN, SLCAN et firmware, les huit fichiers de langue et les tableaux générés
├── docs/                                          architecture, compilation et exécution, contrat d'intégration
├── e2e/                                           contrôles de bout en bout et le modèle de la carte
├── public/                                        firmware inclus, en-têtes, manifeste web
├── scripts/                                       synchronisation du firmware et service worker
├── tools/                                         contrôle de compilation et outils partagés
├── images/                                        bannière et images de ce README
├── .github/                                       workflow de CI et modèles d'issues et de pull requests
├── build.sh build.bat                             scripts de compilation
├── build-test.sh build-test.bat                   scripts de compilation et de test qui ne changent rien dans le dépôt
├── test.sh test.bat                               lancent les tests
├── urtc.project.json                              manifeste : version, rôle, maturité et commande de compilation
├── CHANGELOG.md                                   ce qui a changé à chaque version
├── SECURITY.md SUPPORT.md LICENSE                 politique de sécurité, assistance et licence
├── CONTRIBUTING.md CODE_OF_CONDUCT.md             comment contribuer et code de conduite
├── .gitattributes .gitignore                      réglages Git
├── dev.sh dev.bat                                 installer et lancer le serveur de développement
├── bump.py bump_manifest_version.py               scripts qui augmentent la version
├── index.html                                     page d'entrée de Vite
├── package.json package-lock.json tsconfig.json   paquets, versions figées, TypeScript et Vite
├── playwright.config.ts vite.config.ts            réglages des contrôles de bout en bout
├── urtc_i18n.lock.json                            verrou des fichiers de langue générés
└── NOTICE LICENSE.md                              avis de droit d'auteur et licence de la documentation
```

</details>

La liste annotée de chaque fichier source, une ligne par fichier, est dans [docs/SOURCE_MAP.md](docs/SOURCE_MAP.md).

## 🗺️ Feuille de route et limites connues

- Un mode écoute seule et le choix du débit à la main : on ne peut pas rejoindre un bus sur lequel aucune carte ne répond.
- La lecture de l'image thermique ne vérifie pas d'abord que le capteur est prêt et ne réessaie pas un bloc perdu.
- Télécharger un fichier de firmware directement depuis la release GitHub dans le navigateur : GitHub sert les fichiers d'une release depuis un hôte sans en-têtes CORS, le téléchargement peut donc être bloqué (l'image incluse, ou un fichier choisi sur le disque avec son `.manifest.json`, fonctionnent toujours).

## 🌍 Langues

Le README et les textes existent en anglais, espagnol, français, italien, allemand, chinois, japonais et portugais européen.

## 🔗 Projets liés

URTC est fait de dépôts indépendants, chacun avec sa version, ses tests et son README. Voici la famille, par groupes :

* **URTC Tool Platform:** [URTC](https://github.com/JuanenRac/URTC), [URTC-COMMON](https://github.com/JuanenRac/URTC-COMMON), [URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER), [URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY), [URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK), [URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER), [URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL), **URTC-WEB-STUDIO** (ce dépôt)
* **Ecosystem Operations:** [URTC-DOCS](https://github.com/JuanenRac/URTC-DOCS), [URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER)

**Projets frères (indépendants, avec la même base et les mêmes outils) :**

* **[HYDRA-UMC-DOCS](https://github.com/JuanenRac/HYDRA-UMC-DOCS)** - projet frère : le centre de documentation de HYDRA-UMC, un écosystème indépendant qui partage la base et les outils de celui-ci
* **[ARMOR-DOCS](https://github.com/JuanenRac/ARMOR-DOCS)** - projet frère : le centre de documentation d'A.R.M.O.R., l'écosystème de sécurité, lui aussi indépendant et construit sur la même base
* **[JuanenRac](https://github.com/JuanenRac/JuanenRac)** - le profil et le tableau d'état de tous les écosystèmes

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — comment l'UI, les
  paramètres persistés et l'autorité du transport externe restent séparés,
  et pourquoi les onglets sandbox doivent exposer des états hors-ligne/
  indisponible plutôt que présenter des données simulées comme réelles.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — le chemin de
  validation non mutant `build-test.bat`/`.sh` (TypeScript + tests, sans
  changement de version ni de CHANGELOG), `dev.bat`/`.sh` pour le
  développement local, et pourquoi le matériel de signature OTA n'a jamais
  sa place dans la configuration du navigateur.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — ce que
  ce client doit faire face à un schéma inconnu, une identité de cible
  manquante ou un résultat d'API malformé, et pourquoi l'autorité réelle de
  flashage reste côté serveur ou dans les outils de bureau dédiés.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — pile technologique et lignes directrices de codage pour une pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — les normes de comportement attendues dans cette communauté.
- **[SECURITY.md](SECURITY.md)** — comment signaler une vulnérabilité, et les véritables axes de sécurité de ce projet.
- **[SUPPORT.md](SUPPORT.md)** — où poser des questions et signaler des bugs.
- **[LICENSE.md](LICENSE.md)** — la licence propre de ce projet.

## 🤝 Contribuer et communauté

* Avant une pull request, lancez `URTC_CI=1 python tools/ci_validate.py` : il doit réussir. Voir [CONTRIBUTING.md](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md).
* Le README existe en huit langues : une modification du texte se fait dans les huit fichiers, et les sections partagées avec d'autres dépôts sont écrites par `tools/readme_sections.py` d'URTC-COMMON.
* Un changement du protocole CAN commence dans URTC-COMMON (`spec/can_protocol.json`) et arrive dans ce dépôt par la copie vérifiée.
* Ne décrivez pas comme fonctionnant sur une carte ce qui a seulement été compilé.
* Signalez une vulnérabilité en privé : [SECURITY.md](SECURITY.md). Questions, idées et rapports : electrohobby3d@gmail.com ([SUPPORT.md](SUPPORT.md)).

## 👤 AUTEUR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

## 📜 LICENCE

URTC Web Studio est (c) 2026 JuanenRac (Electro Hobby 3D). Cet avis doit être
inclus dans toute distribution de ce projet ou de ses travaux dérivés.

Ce projet consiste en du code source et sa propre documentation, disponibles sous
des licences différentes - chacune adaptée à ce qu'elle couvre réellement :

1. Le code source (tout ce qui se trouve sous `src/`, plus la configuration
   Vite/TypeScript qui le compile) est disponible sous la **GNU General Public
   License v3.0 (GPL-3.0-or-later)**. Texte complet sur
   https://www.gnu.org/licenses/gpl-3.0.html.

2. La documentation (ce README et ses propres traductions - `README_spa.md`,
   `README_ita.md`, `README_fra.md`, `README_deu.md`, `README_zho.md`,
   `README_jpn.md`) est disponible sous
   **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
   Texte complet sur https://creativecommons.org/licenses/by-sa/4.0/.

Cet outil est le compagnon basé sur navigateur du projet
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC) - voir
le propre dépôt de ce projet pour le firmware de la carte, les conceptions
matérielles, et la documentation complète du protocole contre lequel cet outil
fonctionne. Le propre firmware d'URTC est GPL-3.0-or-later et ses conceptions matérielles
sont CERN-OHL-S v2 ; la propre licence de cet outil ici ne s'étend pas à ce projet
séparé, et vice-versa. Il existe aussi 2 alternatives natives de bureau couvrant le
même terrain :
[URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) et
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Si vous construisez sur ce projet, gardez la séparation des licences à l'esprit :
les modifications de code devraient rester GPL-3.0-or-later, les dérivés de documentation
devraient rester CC BY-SA - chacun avec une attribution à ce projet et son auteur.

**Onglets Boîte noire, Fonctions optionnelles, Banc du rack et Vue thermique (nouveaux, vérifiés avec des simulations seulement) :** Tester Studio lit l'enregistreur de défauts (`0x1A8` / `0x1A9`) et le télécharge en CSV ou JSON, automatiquement une fois pour chaque erreur signalée par la carte quand cette option est activée ; active les fonctions optionnelles du firmware (`0x1AE` / `0x1AF`, désactivées par défaut, après confirmation ; elles agissent au prochain démarrage) ; simule le rack d'outils dans la page, avec l'identité de chaque tête (type et numéro de série) ; et dessine l'image d'inspection thermique en fausses couleurs (une image simulée l'indique). Le catalogue d'outils vient désormais des profils d'outil partagés d'URTC-COMMON. Rien de cela n'a été essayé avec une vraie carte.

**Visionneuse de la boîte noire (nouveau, vérifié par des tests seulement) :** l'onglet Black Box trace la température mesurée et la consigne des secondes enregistrées avant l'erreur, avec un trait à l'endroit où le drapeau d'erreur apparaît pour la première fois, et ouvre un enregistrement sauvegardé auparavant (le fichier JSON ou CSV qu'écrit l'onglet lui-même) sans carte connectée ; un fichier qui n'est pas un enregistrement, qui a une valeur hors plage ou plus de 67 échantillons est refusé avec la raison.

**Copie hors ligne et installation (nouveau, vérifié seulement par des tests et un navigateur) :** la compilation écrit un service worker (`sw.js`) et un manifeste d'application web ; après la première visite en https (ou sur localhost) le navigateur conserve la page, ses scripts et le firmware fourni, l'en-tête indique **Fonctionne hors ligne**, et le Studio s'ouvre sans réseau (l'en-tête indique alors **Hors ligne**) ; là où le navigateur le propose, un bouton **Installer** installe le Studio comme application. La page et le manifeste du firmware sont toujours demandés d'abord au réseau, de sorte que quelqu'un en ligne reçoit les plus récents ; `version.json` n'est jamais servi depuis la copie ; une nouvelle version attend la fermeture des onglets ouverts avant de prendre la main. L'API GitHub n'est pas conservée : sans réseau la dernière release ne peut pas être consultée, seules les images fournies sont utilisées.

**Compteurs thermiques dans le temps (nouveau, vérifié seulement par des tests et une carte modélisée) :** dans l'onglet Boîte noire, les compteurs thermiques à vie (`0x1AA` / `0x1AB`) peuvent être relus toutes les 10 s, 30 s, 1 min ou 5 min ; chaque lecture s'ajoute à un historique conservé dans le navigateur qui trace les heures de chauffe et les défauts dans le temps, peut être téléchargé en CSV et effacé ; un compteur qui baisse (autre carte) relance l'historique.

**Session enregistrée (nouveau, vérifié seulement par des tests et une carte modélisée) :** le Moniteur de bus enregistre les trames sous forme d'un journal et d'un registre qui désigne le journal par son SHA-256 et sa taille, au même format que le Testeur de bureau ; **Vérifier une session enregistrée** prend le registre et son journal et dit s'ils vont ensemble. Cela montre qu'un journal n'a pas été modifié. Là où le navigateur sait faire des signatures Ed25519, le registre porte aussi une signature faite avec une clé de ce navigateur (créée au premier usage et gardée dans le navigateur) : elle montre que le registre n'a pas été modifié après sa signature, et ne dit pas qui détient la clé. Le moniteur peut aussi n'afficher que les ID saisis, ou que les trames dont les données ont changé (le débit et la charge comptent toujours chaque trame).

**Avis de version (nouveau, vérifié par des tests seulement) :** la compilation écrit un `version.json` à côté de la page ; la page compilée le compare une fois, à l'ouverture et sur sa seule origine, avec sa propre version et signale qu'une version supérieure est servie, avec un bouton Recharger. Rien ne se recharge seul, une version égale ou plus ancienne ne dit rien, et un fichier absent ou l'absence de réseau restent silencieux.

**PID du chauffage (dans l'onglet Fonctions optionnelles ; nouveau, vérifié avec des simulations seulement) :** Tester Studio lit l'état du PID du chauffage du firmware (`0x1B9` / `0x1BA` : les gains en vigueur, l'état et la sortie du dernier cycle de régulation), enregistre des gains (de 0 à 600) et lance ou annule l'autoréglage par relais, qui chauffe la panne autour de la consigne actuelle du fer à souder (100 à 445 C) et enregistre les gains trouvés. Enregistrer des gains et lancer l'autoréglage demandent une confirmation, annuler non ; un gain qui n'est pas un nombre de 0 à 600 est refusé avant tout envoi. La fonction doit d'abord être activée parmi les fonctions optionnelles ; rien de cela n'a été essayé avec une vraie carte.
