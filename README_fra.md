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


<p align="center">
  <img src="https://img.shields.io/badge/Licence-GPL%203.0-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
</p>


Un compagnon basé sur navigateur pour l'**Universal Robot Tool Controller (URTC)** -
une app monopage React/Vite qui est conçue pour parler à du matériel URTC réel (elle n'en a jamais piloté) via un adaptateur
USB-CAN grâce à la [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
utilisant le même framing SLCAN et le même protocole CAN que les deux outils
compagnons de bureau, [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) et
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). L'objectif est de réunir les principaux flux de travail de ces deux outils dans un seul onglet de navigateur, pas une démo simplifiée de ceux-ci ; la parité complète n'est pas encore atteinte (voir « Pas encore couvert » plus bas) - les onglets Flasher Studio et Tester Studio envoient et
reçoivent les vraies trames CAN décrites dans `docs/CANBUS.TXT` du
[dépôt firmware d'URTC](https://github.com/JuanenRac/URTC).

**Vérification d'honnêteté - ce qui fonctionne réellement aujourd'hui :** `npm test` (Vitest) couvre la logique pure : l'analyse SLCAN, l'appariement requête/réponse, les contrôles d'image de firmware et de manifeste, les limites des outils, les confirmations, les règles qui séparent le simulateur du vrai bus, l'export de traces et les huit langues de l'interface. Les écrans et le transport Web Serial lui-même n'ont pas de tests automatisés, et rien de tout cela n'a tourné contre une vraie carte URTC dans cet environnement (pas d'adaptateur USB-CAN ici pour le tester) : Flasher Studio, Tester Studio et l'Analyseur de Protocole CAN Bus sont du vrai code vérifié uniquement par ces tests, la vérification de types (`npm run lint`) et la relecture du code. Control/OLED/Specs-BOM/Thermal IR Inspection sont des onglets bac à sable ouvertement déclarés comme tels, sans aucun trafic CAN. Voir `CHANGELOG.md` pour savoir exactement ce qui a été livré jusqu'à présent.

---

> **État de la sûreté et de la cybersécurité :** cet écosystème n'est pas un système de sécurité certifié et aucune carte URTC assemblée n'existe encore. Les bootloaders contrôlent les images de firmware par CRC32 et un HMAC-SHA256 à clé partagée, pas par une signature asymétrique (prévue) ; les images d'application publiées sont signées avec la clé publique de développement (`signing_key_kind: dev`), si bien que n'importe qui peut produire une image acceptée par le bootloader ; rien n'a été transmis à une carte réelle. Lisez la [base de sécurité](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) et le [modèle de menaces](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md) avant de vous fier à une affirmation d'ici pour la sécurité d'une personne.

## 📋 En un coup d'œil

| | |
|---|---|
| Version | `0.3.0` |
| Maturité | Fonctionnel |
| Technologie | Web Serial API / TypeScript |
| Cible | Un navigateur web sur le PC de l'utilisateur |
| Sur matériel réel | Simulé seulement : testé avec des émulateurs, des doubles de test ou des simulateurs ; aucune exécution sur du matériel réel n'est consignée pour cette version |

## 🧭 Ce qui est réel vs. ce qui est un bac à sable

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

## 🔌 Matériel nécessaire

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

## 🛡️ Validation des trames CAN

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

## ⚡ Flasher Studio - couverture réelle des fonctionnalités

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

### SWD/JTAG - non disponible depuis un navigateur, par conception

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

## 🧰 Tester Studio - couverture réelle des fonctionnalités

Porté depuis les propres `tester_tool_panels.py` /
`tester_common_panels.py` d'`URTC-TESTER`, contre les mêmes CAN ID :

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

### Séparation du simulateur et confirmations (contrôles logiciels, pas des fonctions de sécurité)

- Les onglets bac à sable (Control, OLED, Thermal IR) ne transmettent rien. Leurs trames portent la marque SIM et, tant qu'une carte est connectée, ils ne produisent aucune réponse simulée. Parmi les messages prédéfinis de l'analyseur de protocole, seules les requêtes simples sont envoyées à une carte connectée ; le reste reste simulé.
- Tester Studio n'affiche un panneau d'outil que pour l'outil que la carte a elle-même signalé (`0x111`), et aucun avant que la carte ait répondu.
- Laser, perceuse, séchage UV, soudage, éléments chauffants, mouvement, distribution de pâte, écritures dans la mémoire de la carte et trames saisies à la main présentant un risque demandent d'abord une confirmation.
- **TOUT ARRÊTER** dans l'en-tête (visible une fois connecté) éteint chaque actionneur que cette page maintient actif ; fermer la page et se déconnecter font de même. C'est une commande logicielle, pas un arrêt d'urgence.
- Flasher une image signée avec la clé de développement publique demande d'abord une confirmation, car cette clé ne prouve rien sur l'auteur de l'image.
- Quand la carte déclare une erreur critique, la bannière indique aussi la raison de la protection contre l'emballement thermique si la carte la signale.

### Pas encore couvert

- Les compteurs d'erreur de l'inspection thermique (`0x1AA`/`0x1AB`).
- Un mode écoute seule et le choix du débit à la main : on ne peut pas rejoindre un bus sur lequel aucune carte ne répond.
- La lecture de l'image thermique ne vérifie pas d'abord que le capteur est prêt et ne réessaie pas un bloc perdu.
- Télécharger un fichier de firmware directement depuis la release GitHub dans le navigateur : GitHub sert les fichiers d'une release depuis un hôte sans en-têtes CORS, le téléchargement peut donc être bloqué (l'image incluse, ou un fichier choisi sur le disque avec son `.manifest.json`, fonctionnent toujours).

## 🔐 Note de sécurité : aucune clé de signature dans cette application

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

Chaque fichier d'une release officielle a une signature de release (`<fichier>.sig`, Ed25519) : la synchronisation la vérifie lorsqu'elle est présente et refuse une signature incorrecte ; un jeu sans signatures (une pré-release de banc ou un build local) demande `--allow-unsigned`.

## 🚀 Pour commencer

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

La page construite déclare une politique de sécurité du contenu (scripts uniquement depuis la page elle-même ; connexions uniquement vers elle-même et vers GitHub) et charge chaque onglet à sa première ouverture. Elle n'a pas encore été essayée dans un vrai navigateur.

### GitHub Pages (outil d'établi)

Le dépôt peut publier le site compilé sur GitHub Pages (workflow `.github/workflows/pages.yml` : `npm ci`, vérification des types, tests, `npm run build` avec le chemin de base du projet, puis `upload-pages-artifact` et `deploy-pages`). Il est proposé comme **outil d'établi** : les images de firmware incluses sont signées avec la clé publique de développement, que n'importe qui peut utiliser ; la page publiée affiche donc un avis et n'est pas une source de firmware fiable pour une machine en service. Pour l'activer, le propriétaire du dépôt ouvre Settings > Pages et règle Source sur "GitHub Actions" ; d'ici là, le workflow se termine sans déployer. Web Serial exige un navigateur basé sur Chromium et https, ce que Pages fournit.

### Versionnage

Le `version` de `package.json` (et le `version` correspondant dans `urtc.project.json`) n'est incrémenté que par l'étape explicite `python bump.py` (elle exécute `bump_manifest_version.py`, qui lit la version actuelle dans `package.json`, l'incrémente, la réécrit, synchronise le manifest et ajoute une entrée minimale au CHANGELOG si cette version n'en a pas encore une). `build.bat`/`build.sh` ne font que compiler et ne touchent jamais la version.
`npm run build` (`vite build`) seul est délibérément compilation uniquement
et ne touche jamais la version - `scripts/bump-version.mjs` faisait ce
travail dans une conception antérieure avec un hook `prebuild`, mais ce
script est aujourd'hui legacy, conservé seulement pour référence (voir son
propre commentaire d'en-tête) ; `npm run dev`/`lint`/`preview` n'y touchent
jamais non plus. Ce n'est pas du Semantic Versioning : c'est un compteur
kilométrique en base 10. Le chiffre du patch augmente de 1 ; lorsqu'il
dépasserait 9, il revient à 0 et le chiffre du minor augmente à sa place
(`0.1.9` -> `0.2.0`, jamais `0.1.10`) ; la même retenue se propage du minor
au major. Voir `CHANGELOG.md` pour l'historique des versions et un résumé du
travail antérieur sur ce projet.

## 📖 Documentation complémentaire

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

## 🛠️ Stack technique
- **Langage :** TypeScript
- **Framework frontend :** React 18
- **Outil de build :** Vite
- **Style :** Tailwind CSS
- **Icônes :** Lucide React
- **CRC32 :** `crc-32` - vérification d'intégrité de l'image firmware, reflète le
  propre calcul de CRC32 du bootloader
- **Transport matériel :** Web Serial API + framing SLCAN (aucune dépendance
  native, aucun serveur backend compagnon)

## 📂 Structure du dépôt

```
/
├── src/
│   ├── App.tsx                     Composant racine - etat des onglets, etat
│   │                                materiel, journalisation des trames CAN, et
│   │                                les gestionnaires cables dans chaque onglet
│   │                                ci-dessous (y compris le
│   │                                demarrage/relecture CAN OTA et le propre
│   │                                injecteur de trames du CAN Bus Analyzer)
│   ├── main.tsx                    Point d'entree Vite/React
│   ├── i18n.ts                     Configuration i18next - en/es/de/fr/it/zh/ja,
│   │                                persistee dans localStorage
│   ├── index.css                   Point d'entree Tailwind
│   ├── types.ts                    Types TypeScript partages (CanFrame,
│   │                                HardwareState, FlasherState,
│   │                                ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Declarations de types ambiants propres a
│   │                                Vite
│   ├── components/
│   │   ├── Header.tsx               Barre superieure : bouton
│   │   │                            connecter/deconnecter, nom de l'outil
│   │   │                            actif, commutateur bac a sable FW v0.0/v0.1
│   │   ├── Sidebar.tsx              Navigation gauche - les 7 onglets decrits
│   │   │                            dans ce README
│   │   ├── ToolCatalog.tsx          Onglet bac a sable : le catalogue de 25
│   │   │                            outils, selection d'outil, controle de
│   │   │                            consigne
│   │   ├── OledDisplay.tsx          Onglet bac a sable : apercu des ecrans
│   │   │                            d'etat OLED
│   │   ├── SpecsAndBomViewer.tsx    Onglet bac a sable : navigateur BOM/pinouts
│   │   ├── ThermalCameraViewer.tsx  Onglet bac a sable : flux simule MLX90640 -
│   │   │                            100% Math.random(), aucun trafic CAN (voir
│   │   │                            "Ce qui est reel vs. ce qui est un bac a
│   │   │                            sable" ci-dessus)
│   │   ├── HardwarePanel.tsx        Panneau bac a sable de controle
│   │   │                            cavaliers/LED/carte d'extension, utilise
│   │   │                            dans les onglets Control et OLED
│   │   ├── CanBusAnalyzer.tsx       Onglet reel : journal de trames CAN brutes,
│   │   │                            injecteur de trame personnalisee,
│   │   │                            declencheurs de commande preetablis
│   │   ├── FlasherStudio.tsx        Onglet reel : interface CAN-OTA (principale
│   │   │                            + esclave d'extension) et l'explicateur de
│   │   │                            capacite SWD/JTAG
│   │   ├── TesterStudio.tsx         Onglet reel : controle/telemetrie en
│   │   │                            direct par outil, construit depuis le
│   │   │                            dossier tester/ ci-dessous
│   │   └── tester/
│   │       ├── ToolPanels.tsx       Un panneau par profil d'outil - octets de
│   │       │                        commande reels, decodage de telemetrie
│   │       │                        reelle, keepalive watchdog par outil
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor, injecteur
│   │       │                        Custom Frame
│   │       └── shared.tsx           Primitives UI partagees (Section, Field,
│   │                                classes bouton/input, safeInt)
│   ├── data/
│   │   └── toolsData.ts             Les 25 TOOL_PROFILES - noms, valeurs par
│   │                                defaut, icones pour les onglets bac a
│   │                                sable
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Transport Web Serial + SLCAN -
│   │   │                            connecter/deconnecter, TX/RX de trames,
│   │   │                            waitForFrame par ID avec un buffer rx
│   │   │                            borne et un plafond de file de 500 trames
│   │   ├── useFlasher.ts            Machine a etats CAN-OTA (carte principale
│   │   │                            + esclave d'extension), reflete
│   │   │                            flasher_protocol.py
│   │   └── useKeepalive.ts          Hook de renvoi a intervalle fixe qui
│   │                                soutient le keepalive watchdog de la case
│   │                                active de chaque outil
│   ├── lib/
│   │   ├── flasher.ts               Constantes du protocole OTA, aides CRC32/HMAC,
│   │   │                            lecture des manifestes (aucune clé de signature)
│   │   ├── boardVersion.ts          Requêtes de version : 0x7F9/0x7FA/0x7E9 et 0x217/0x218 de l'esclave
│   │   ├── githubRelease.ts         Images de la release GitHub la plus récente et leur téléchargement
│   │   ├── firmwareImage.ts         Contrôles d'image, cible du manifeste et version (avec correctif)
│   │   ├── firmwareSignature.ts     Choisit la signature envoyée : la publiée, ou une
│   │   │                            clé saisie pour un flashage ; contrôle sha256
│   │   ├── quickState.ts            Décodage de 0x111 (défaut thermique, reset)
│   │   ├── bundledFirmware.ts       Généré par scripts/sync-firmware.mjs
│   │   └── canIds.ts                Constantes de CAN ID pour Tester Studio -
│   │                                 reflete tester_config.py octet par octet
│   └── locales/                     Chaines UI - en.json, es.json, de.json,
│                                     fr.json, it.json, ja.json, zh.json, pt.json
├── scripts/
│   ├── bump-version.mjs             Script d'incrementation de version sans dependance;
│   │                                 aujourd'hui legacy, conserve pour reference seulement
│   │                                 - remplace par bump_manifest_version.py (voir "Versionnage")
│   └── sync-firmware.mjs            Copie les fichiers de la release URTC (ou un
│                                     dossier local) dans public/firmware/,
│                                     empreintes vérifiées - npm run sync-firmware
├── public/
│   └── firmware/                    .bin/.elf/.hex embarques pour
│                                     l'application principale, le bootloader
│                                     principal, l'application esclave
│                                     d'extension, et le bootloader esclave
│                                     d'extension
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   Banniere de logo complete (affichee en
│                                     haut de ce README)
│   ├── URTC_APP_ICON_NEW.svg        Icone de l'app
│   ├── urtc_custom_icon.svg         Icone de l'app, meme illustration
│   └── urtc_icon.ico                Favicon
├── index.html                       HTML d'entree Vite
├── vite.config.ts                   Configuration Vite + plugin Tailwind
├── tsconfig.json                    Configuration TypeScript
├── .env.example                     Aucune variable n'est lue par l'app
├── dev.bat / dev.sh                 Installe les dependances + demarre le
│                                     serveur de developpement Vite
├── build.bat / build.sh             Installe les dependances + produit le
│                                     build statique de dist/
├── tools/
│   └── ci_validate.py               Validation manifest/CHANGELOG/docs utilisée par la CI
├── bump.py                          Commande explicite pour monter la version (compiler ne la monte jamais)
├── bump_manifest_version.py         Incrementation de version, declenchee uniquement par `bump.py` (package.json + manifest, voir "Versionnage"); le mode `--sync` existe aussi pour accepter un increment natif prealable
├── package.json
├── CHANGELOG.md                     Historique des versions et resume du travail passe
├── LICENSE
├── NOTICE                      Mention de copyright et licence de la documentation
├── README.md                        Ce fichier
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- traductions
```

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

## 🔗 Projets Liés

Ce projet fait partie de l'écosystème robotique HYDRA-UMC du même auteur (JuanenRac / Electro Hobby 3D). Bon à savoir, car une demande pourrait en réalité concerner l'un de ceux-ci plutôt que ce dépôt.

**Projet Parent**
- **[URTC](https://github.com/JuanenRac/URTC)** — firmware pour la carte physique Universal Robot Tool Controller, plus de 25 profils d'outil sur bus CAN ; le parent dont ce dépôt est un outil spécifique, au sein de sa propre famille d'outils CAN-bus.

**Projets Frères** — les autres outils de la propre famille d'outils CAN-bus d'URTC
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — outil de bureau à interface graphique pour flasher les cartes URTC, CAN-OTA plus SWD/JTAG puce complète — même protocole SLCAN/CAN que cette application basée sur navigateur, qui en est l'alternative sans installation.
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — outil de bureau de diagnostic CAN-bus en direct pour cartes URTC, un panneau par profil d'outil — même protocole SLCAN/CAN que cette application basée sur navigateur, qui en est l'alternative sans installation.

**Directement Liés**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — CLI de flotte avec un vrai contrat de codes de sortie stable, un vrai client en direct de la propre API de HYDRA-UMC-SERVER — une alternative en ligne de commande à cet outil basé sur navigateur.

**Fait Également Partie de l'Écosystème**

*Matériel & Plateforme de Base*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — la conception de la carte mère du bras robotique : hôte CM5 + coprocesseur STM32H745 double cœur, destinée à coordonner jusqu'à 8 bras-outils via CAN-OTA/SPI-OTA (firmware à un stade précoce ; aucune carte assemblée pour l'instant).
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — couche produit reproductible sur Raspberry Pi OS pour le CM5 : agent en lecture seule, config/profils validés, provisionnement WiFi de premier contact.
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — le contrat JSON-Schema partagé et la barrière logicielle de contrôle des jobs contre laquelle chaque bridge valide ses commandes (pas une fonction de sécurité certifiée).
- **[HYDRA-UMC-CONNECTOR-HUB](https://github.com/JuanenRac/HYDRA-UMC-CONNECTOR-HUB)** — registre déclaratif et validateur de manifestes d'adaptateur pour les connecteurs de machines externes ; étend la propre idée de contrat du SDK aux machines externes sans remplacer les projets de passerelle industrielle.

*Backend Central & Clients*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — le vrai backend headless (REST/WebSocket) auquel parle réellement chaque client de contrôle.
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — tableau de bord de contrôle web avec visualisation 3D multi-robot en temps réel.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — centre de commande d'essaim de bureau (PySide6) pour plusieurs serveurs à la fois, empaqueté en exécutable autonome.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — application de contrôle Android native avec connexion biométrique et un compagnon Wear OS jumelé.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — application de contrôle iOS/iPadOS (Flutter) avec synchronisation WebSocket en temps réel.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — interface tactile native pour l'écran tactile DSI 7" embarqué, intégrée directement sur le CM5.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — créateur/éditeur graphique de bureau pour URDF qui envoie les modèles terminés vers le propre catalogue de STUDIO.
- **[HYDRA-UMC-EDITOR-STL](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-STL)** — éditeur de bureau de modèles STL, transformant/remplaçant/retirant/ajoutant de vraies pièces dans le même catalogue de modèles qu'édite aussi HYDRA-UMC-EDITOR-URDF.
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — frontière de coordination pour les flottes AGV/AMR via un éditeur MQTT VDA 5050 (testé uniquement contre une flotte émulée).
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — coordinateur haut niveau pour cellules CNC avec accès au statut/octets de contrôle GRBL (testé uniquement contre un émulateur).
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — frontière de coordination pour droïdes à pattes/humanoïdes, avec un émetteur de commandes Boston Dynamics Spot (testé uniquement contre un émulateur).
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — coordinateur de cellules laser lisant 3 signaux GPIO de clé/enceinte/verrouillage (testé uniquement contre une puce simulée ; il ne peut ni armer ni tirer un laser).
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — coordinateur haut niveau sûr pour le flux de cartes du pick-and-place OpenPnP.
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — frontière de coordination sûre pour imprimantes 3D Moonraker/Klipper, avec de vraies commandes de tâche contrôlées.
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — coordinateur avec un transport ROS 2 rclpy à importation paresseuse (pas encore exécuté contre une installation ROS 2).
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — frontière de coordination pour UAV équipés de caméra, avec un émetteur de commandes MAVLink (testé uniquement contre un émulateur).

*Nœud IA de Vision (Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — hub d'intégration pour le pipeline de vision Hailo-8, avec une vraie vérification de disponibilité matérielle par étape.
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — registre réel de modèles compilés avec vérification de chargement sécurisé par architecture Hailo/checksum.
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — générateur réel de pipeline GStreamer + config MediaMTX, avec une vraie frontière d'intégration HailoRT.
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — loi de correction Position-Based Visual Servoing avec autorisation conditionnée à l'état de zone ; pas encore d'estimation de pose par caméra.
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — logique v0 de violation de zone, de fraîcheur de calibration et de demande d'E-STOP qui lit les positions d'objets dans un fichier ; aucun détecteur ne l'alimente et aucun E-STOP physique n'y est encore relié.

*Nœud IA Cognitif (Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — hub d'intégration pour le pipeline cognitif Hailo-10 (orchestration LLM/VLA/voix).
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — vrai encodage/décodage de jetons d'action et génération de trajectoire pour un modèle Vision-Language-Action.
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — vrai front-end vocal (VAD + analyseur d'intention) avec un relais Watch borné et soumis à confirmation.
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — vraie décomposition de tâches basée sur des règles et récupération sémantique d'erreurs sur les codes d'erreur MCU.
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — vraie recherche documentaire TF-IDF (bibliothèque standard uniquement) sur les propres documents Markdown de cet écosystème.
- **[HYDRA-UMC-LOCAL-TECHNICIAN](https://github.com/JuanenRac/HYDRA-UMC-LOCAL-TECHNICIAN)** — technicien de maintenance IA local et à portes de politique pour l'écosystème lui-même - observe, diagnostique et propose des corrections ; les deux niveaux de risque les plus élevés ne sont délibérément pas encore implémentés.

*Orchestration & Essaim*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — hub d'intégration avec un vrai contrat de rapport de santé gRPC/Protobuf et une machine à états de mission.
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — vraie file de tâches basée sur la priorité avec déduplication, via une vraie API HTTP.
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — vrai chien de garde de santé de flotte basé sur gRPC, avec retry/backoff et détection d'incohérence d'identité.
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — vrai planificateur de trajectoire 3D basé sur RRT, avec vraie validation des collisions obstacle/espace de travail.
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — vraie synchronisation d'état CRDT LWW-Element-Map, testée par propriétés pour la convergence multi-cellule.

*Jumeau Numérique & Simulation*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — hub d'intégration pour le moteur de jumeau numérique, avec un vrai contrat de synchronisation par compatibilité de version.
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — routeur hardware-in-the-loop avec un verrouillage logiciel de collision entre simulation et matériel réel (testé sans matériel réel).
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — vraie cinématique directe et validation des limites articulaires sur un vrai sous-ensemble URDF.
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — vrai générateur procédural de scènes 2D avec export d'annotations YOLO/COCO.

*Données & Analytique*
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — vrai magasin de séries temporelles basé sur sqlite3, avec une vraie API HTTP d'ingestion/requête.
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — vrai détecteur d'anomalies FFT + ligne de base statistique, avec surveillance de dérive.
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — vrai calcul OEE/disponibilité sur l'historique de DATALAKE, avec export CSV reproductible.
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — vrai pipeline d'ingestion CAN/WebSocket vers DATALAKE, avec déduplication par séquence.

*Passerelle Industrielle*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — hub d'intégration relayant vers les protocoles industriels, avec une vraie couche de liste blanche de commandes/contre-pression.
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — vrai espace d'adressage OPC-UA, vérifié avec une vraie session client du protocole binaire.
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — vrai broker MQTT avec authentification par client optionnelle et ACL de sujets.
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — vrais points de terminaison XML MTConnect `/probe` et `/current`, avec sortie en mode dégradé.

*Outils Complémentaires & Opérations de l'Écosystème*
- **[HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)** — panneaux Smart Summaries et Anomaly Highlighting sur DATALAKE/ANOMALY-DETECTOR, avec un repli statistique honnête.
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — application compagnon WearOS avec des motifs d'alerte haptique et un relais vocal vers le téléphone jumelé (pas encore exécutée sur une montre physique).
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — firmware pour un rack de montage de cartes avec décodage réel d'ID d'outil et logique de préchauffage Smart Idle.
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — firmware plus un vrai compagnon de vision Python pour une tête d'outil d'inspection thermique/RGB.
- **[URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER)** — outil de bureau qui détecte, installe et met à jour les dépôts de la famille URTC, une action explicite à la fois.
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — outil administratif de bureau qui découvre, clone et met à jour chaque dépôt de cet écosystème.
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** — outil de bureau Windows/Linux qui construit une image de la CM5 prête à graver, préchargée avec les versions les plus actuelles de l'écosystème, avec une configuration de premier démarrage Wi-Fi/utilisateur/SSH façon Raspberry Pi Imager.
- **[HYDRA-UMC-OPS-AGENT](https://github.com/JuanenRac/HYDRA-UMC-OPS-AGENT)** — coordinateur d'incidents de maintenance : un rôle edge à faible privilège collecte un instantané d'inventaire/santé assaini, un rôle control-plane le rend en lecture seule et demande à un fournisseur d'IA de suggérer un diagnostic - n'applique jamais de correctif ni ne déploie rien.
- **[HYDRA-UMC-DEV-SERVER](https://github.com/JuanenRac/HYDRA-UMC-DEV-SERVER)** — hôte de développement reproductible (Raspberry Pi 5 / CM5) qui héberge le code source de l'écosystème et exécute des tâches de compilation/test délimitées via une file d'attente durable ; un rôle de développement dédié, explicitement distinct d'un CM5 opérationnel.

---

## 📚 Documentation & Communauté

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — pile technologique et lignes directrices de codage pour une pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — les normes de comportement attendues dans cette communauté.
- **[SECURITY.md](SECURITY.md)** — comment signaler une vulnérabilité, et les véritables axes de sécurité de ce projet.
- **[SUPPORT.md](SUPPORT.md)** — où poser des questions et signaler des bugs.
- **[LICENSE.md](LICENSE.md)** — la licence propre de ce projet.

## 👤 AUTEUR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
