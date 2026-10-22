<p align="center">
  <img src="images/URTC_WEB_STUDIO_BANNER.svg" alt="Logótipo do URTC Web Studio" width="100%">
</p>

# URTC Web Studio

<p align="center">
  <a href="README.md">🇺🇸 English</a> |
  <a href="README_spa.md">🇪🇸 Español</a> |
  <a href="README_fra.md">🇫🇷 Français</a> |
  <a href="README_ita.md">🇮🇹 Italiano</a> |
  <a href="README_deu.md">🇩🇪 Deutsch</a> |
  <a href="README_zho.md">🇨🇳 简体中文</a> |
  <a href="README_jpn.md">🇯🇵 日本語</a> |
  🇵🇹 <b>Português</b>
</p>


<p align="center">
  <img src="https://img.shields.io/badge/License-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Framework-React-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/API-Web%20Serial-green.svg" alt="Web Serial">
  <img src="https://img.shields.io/badge/Tool-Vite-646CFF.svg" alt="Vite">
</p>


Um companheiro baseado no navegador para o **Universal Robot Tool Controller (URTC)** -
uma aplicação de página única em React/Vite que destina-se a comunicar com hardware URTC real (nunca foi executada com nenhum) através de um
adaptador USB-CAN, por meio da [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API),
usando o mesmo framing SLCAN e o mesmo protocolo CAN que as duas ferramentas
de ambiente de trabalho que o acompanham, o [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER) e o
[URTC Tester](https://github.com/JuanenRac/URTC-TESTER). O objetivo é reunir os principais fluxos de trabalho dessas duas ferramentas num único separador do navegador, não uma demonstração simplificada das mesmas; a paridade completa ainda não foi alcançada (veja «Ainda não coberto» mais abaixo) - os separadores Flasher Studio e Tester Studio enviam e
recebem as tramas CAN reais descritas em `docs/CANBUS.TXT` do
[repositório de firmware do URTC](https://github.com/JuanenRac/URTC).

**Verificação de honestidade - o que realmente funciona hoje:** `npm test` (Vitest) cobre a lógica pura: a análise SLCAN, a correspondência pedido/resposta, as verificações de imagem de firmware e de manifesto, os limites das ferramentas, as confirmações, as regras que separam o simulador do barramento real, a exportação de traços e os oito idiomas da interface. Os ecrãs e o próprio transporte Web Serial não têm testes automatizados, e nada disto foi executado contra uma placa URTC real neste ambiente (aqui não há um adaptador USB-CAN com que testar): o Flasher Studio, o Tester Studio e o Analisador de Protocolo CAN Bus são código real verificado apenas por esses testes, pela verificação de tipos (`npm run lint`) e pela revisão do código. Control/OLED/Specs-BOM/Thermal IR Inspection são separadores de sandbox declarados abertamente como tal, sem qualquer tráfego CAN. Consulte o `CHANGELOG.md` para ver exatamente o que foi entregue até agora.

---

> **Estado de segurança (safety e security):** este ecossistema não é um sistema de segurança certificado e ainda não existe nenhuma placa URTC montada. Os bootloaders verificam as imagens de firmware com CRC32 e um HMAC-SHA256 de chave partilhada, não com uma assinatura assimétrica (prevista); as imagens de aplicação publicadas estão assinadas com a chave pública de desenvolvimento (`signing_key_kind: dev`), pelo que qualquer pessoa pode produzir uma imagem que o bootloader aceita; nada foi transmitido a uma placa real. Leia a [base de segurança](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/SECURITY_BASELINE.md) e o [modelo de ameaças](https://github.com/JuanenRac/URTC-DOCS/blob/main/docs/THREAT_MODEL.md) antes de confiar em qualquer afirmação aqui para a segurança de uma pessoa.

## 📋 Num relance

| | |
|---|---|
| Versão | `0.3.5` |
| Maturidade | Funcional |
| Tecnologia | Web Serial API / TypeScript |
| Destino | Um navegador web no PC do utilizador |
| Em hardware real | Só simulado: testado com emuladores, dublês de teste ou simuladores; não há registo de execução em hardware real para esta versão |

## 🧭 O que é real e o que é uma sandbox

Esta aplicação tem dois tipos de separadores:

- **Separadores reais, controlados por hardware** - Flasher Studio, Tester Studio e o CAN
  Bus Protocol Analyzer. Estes só fazem alguma coisa depois de ligar um
  adaptador USB-CAN real (botão do cabeçalho, no canto superior direito); todos os comandos que
  enviam e todas as leituras que mostram vêm do barramento CAN (este caminho nunca foi executado com um adaptador ou uma placa reais). Isto inclui a
  **leitura real da câmara térmica** - o painel "Thermal Inspection" do Tester
  Studio (`0x250`/`0x251`/`0x254`/`0x255`) consulta através de CAN o array IR MLX90640 real
  do cabeçote da ferramenta.
- **Separadores sandbox offline** - Control (catálogo de ferramentas), OLED,
  Specs/BOM e Thermal IR Inspection. Estes permitem explorar o catálogo de 25
  ferramentas, pré-visualizar os ecrãs de estado OLED, navegar pelo BOM/pinouts e
  ver uma imagem simulada de câmara térmica, tudo sem qualquer hardware ligado.
  O interruptor "FW v0.0 / v0.1" do cabeçalho só afeta estes separadores sandbox
  (que perfis de ferramenta seria desbloqueados por uma dada build de firmware) - não tem
  qualquer relação com o que uma placa real ligada reporta.
  - **Não confunda as duas vistas térmicas**: o separador autónomo "Thermal IR
    Inspection" (`ThermalCameraViewer.tsx`) é ruído `Math.random()` 100% do lado
    do cliente, sem qualquer tráfego CAN - é uma maqueta de interface, não
    uma leitura de sensor. Os dados reais do MLX9064x só aparecem dentro do painel
    "Thermal Inspection" do Tester Studio, e apenas depois de o hardware estar
    ligado.

## 🔌 Hardware de que precisa

- Um adaptador USB-CAN com firmware **SLCAN** (p. ex. um CANable com
  `candlelight`/`slcan`, ou qualquer adaptador que fale o protocolo série SLCAN
  `lawicel` padrão) - a mesma classe de adaptador que ambas as ferramentas de
  ambiente de trabalho suportam através do seu próprio transporte Serial.
- O barramento configurado a **500 kbit/s**. Ao ligar, a aplicação experimenta por ordem 500, 250, 125 kbit/s e as restantes velocidades padrão e fica com a primeira em que uma placa responde a um pedido de versão; ainda não é possível escolher a velocidade à mão nem apenas escutar sem que uma placa responda.
- Um navegador com suporte de Web Serial - **Chrome ou Edge**. O Firefox e o Safari
  não implementam Web Serial e não conseguirão ligar de todo.
- O Web Serial exige um contexto seguro (HTTPS) ou `localhost` - e não pode ser usado
  a partir do interior de uma iframe. Se estiver a pré-visualizar esta aplicação dentro de uma
  frame incorporada, abra-a primeiro no seu próprio separador.

## 🛡️ Validação de tramas CAN

Ambos os sentidos da ligação SLCAN são validados antes de qualquer coisa chegar à
UI ou ao cabo (`src/hooks/useSerialCanBus.ts`):

- **Saída** - `sendFrame()` recusa-se a serializar um comando cujo
  identificador fique fora do intervalo CAN padrão de 11 bits (`0x000`-`0x7FF`),
  cujo payload exceda 8 bytes, ou cujo payload contenha um byte fora de
  `0x00`-`0xFF`. A UI mostra "Refusing malformed CAN frame: ..." em vez de
  escrever texto inválido na porta série.
- **Entrada** - `processBuffer()` exige uma correspondência real
  `t<3-hex ID><1-hex DLC 0-8><hex payload>` antes de converter uma linha
  SLCAN recebida num `CanFrame`; um DLC fora de `0`-`8` ou um payload mais curto
  do que o seu próprio comprimento declarado é registado na consola e descartado em vez de
  ser entregue a um painel de ferramenta como um byte `NaN`. Um timestamp
  opcional do adaptador no final continua a ser aceite depois de um payload válido.

## ⚡ Flasher Studio - cobertura real de funcionalidades

Portado a partir do próprio `flasher_protocol.py` do `URTC-FLASHER`, contra os mesmos
CAN IDs:

- **Atualização CAN-OTA da placa principal** (`0x7F0`-`0x7F7`): acionador de
  entrada no bootloader, HMAC-SHA256 de chave partilhada (testado apenas contra um simulador), transferência paginada com controlo de
  fluxo por ACK de página e retry/backoff, CRC32 + END_UPDATE com versão declarada,
  e tratamento do estado terminal (incluindo a recuperação de uma trama de
  confirmação perdida da mesma forma que a ferramenta de ambiente de trabalho - volta a
  consultar a versão em vez de reportar uma falsa falha).
- **Atualização CAN-OTA do slave de expansão** (`0x210`-`0x219`, retransmitida através da
  própria ponte I2C da placa principal) - mesmo esquema de assinatura/CRC, sem ACK de página
  nem heartbeat neste caminho (corresponde ao protocolo real; o progresso é consultado por
  polling, não empurrado).
- **Autorização de downgrade** (`0x7FD`) - uma caixa de seleção protegida por confirmação
  que autoriza a tentativa atual a contornar a verificação anti-rollback do bootloader,
  para uma reversão deliberada para uma versão mais antiga.
- **Apagamento da F-RAM antes de gravar** (`0x192`), opcional, apenas na placa principal.
- **Consulta do contador de erros CAN** (`0x7FB`/`0x7FC`, TEC/REC lidos diretamente
  dos próprios registos de erro do controlador CAN) - distingue um problema genuíno
  do barramento de um problema do lado da aplicação/bootloader.
- **Leitura de volta / cópia de segurança do firmware por CAN** (`0x7FE`/`0x7FF`) - lê o conteúdo
  atual do slot principal antes de o sobrescrever, a um ritmo de 2KB/página
  com ACKs do host, e guarda-o como uma transferência `.bin`.
- **Consulta da versão da placa em direto** (`0x7F8`/`0x7F9`/`0x7FA`/`0x7E9`) - mostra o
  respondedor real (app ou bootloader), o HardwareID e a versão, não um interruptor
  simulado.
- **Assinatura e digest publicados** - cada imagem da build do URTC traz
  `<file>.manifest.json` (versão, `sha256` e o valor `hmac_sha256` que o bootloader espera, um HMAC-SHA256 de chave partilhada e não uma assinatura assimétrica) e `<file>.sha256`. A aplicação envia essa assinatura publicada,
  um `sha256` do manifesto que não corresponda ao ficheiro **bloqueia** a gravação,
  e a versão do manifesto é a que é comunicada ao bootloader. Um ficheiro escolhido
  a partir do disco não tem manifesto: só pode ser gravado com uma chave de assinatura
  introduzida para essa gravação (placas de bancada), a não ser que o seu
  `.manifest.json` seja escolhido em conjunto.
- **Número de patch do firmware** (`0x7E9`, e o `0x218` alargado do escravo) -
  o firmware instalado e a imagem selecionada são mostrados como
  maior.menor.patch. O patch só entra na comparação quando os dois lados o
  trazem, uma placa anterior (não envia `0x7E9`) continua a funcionar com
  maior.menor, e o patch só vai em END_UPDATE para um bootloader que o tenha
  anunciado. O registo diz se a imagem é mais antiga, igual ou mais recente do
  que o comunicado pela placa.
- **Firmware da release mais recente do GitHub** - os binários são anexos da
  release de cada versão do URTC, não ficheiros no git. A lista vem da API de
  releases de `JuanenRac/URTC` (apenas as imagens de aplicação da placa
  selecionada, cada uma com o seu `.sha256` e o seu `.manifest.json`); uma
  imagem transferida tem de corresponder aos digests que a release publica, e
  mantêm-se as verificações de imagem, manifesto e assinatura. O GitHub serve os
  ficheiros a partir de um anfitrião que não envia cabeçalhos CORS, pelo que um
  navegador pode não os conseguir transferir: o registo di-lo, e a imagem pode
  ser tirada da pasta incluída, ou transferida da página da release e escolhida
  com Procurar em conjunto com o seu `.manifest.json`.
- **Configuração da placa**: tipo de placa de expansão / variante do sensor MLX9064x /
  configuração livre de ferramenta (pinos de ID `11111`) / informação de periféricos e
  número de série - `0x1A0`-`0x1A7`.

### SWD/JTAG - não disponível a partir de um navegador, por design

Não existe nenhuma Web API capaz de controlar uma sonda de depuração SWD/JTAG - o Web Serial
só comunica com dispositivos de framing série (como um adaptador USB-CAN), não com o
protocolo próprio de uma sonda, e o STM32CubeProgrammer/pyOCD são subprocessos nativos
que a ferramenta de ambiente de trabalho invoca. Esta é uma limitação estrutural de
correr numa sandbox de navegador, não uma funcionalidade em falta aqui. O separador
SWD/JTAG do Flasher Studio explica os comandos exatos que a ferramenta de ambiente de
trabalho `URTC Flasher` executaria localmente, para referência - use essa ferramenta
diretamente para programação de chip completo, verificações de option-byte/RDP, ou uma
cópia de segurança completa da flash antes de um apagamento total.

## 🧰 Tester Studio - cobertura real de funcionalidades

Portado a partir dos próprios `tester_tool_panels.py` /
`tester_common_panels.py` do `URTC-TESTER`, contra os mesmos CAN IDs:

- Um painel por ferramenta (ferro de soldar + alimentador de fio, ferramentas de
  movimento de motor de passo simples partilhadas, recolha por vácuo, broca, AOI,
  laser, aquecedor/movimento/ventoinhas de impressora 3D, sonda de digitalização,
  eletroíman, soldadora por pontos/ultrassons, sonda voadora incl. o caminho
  avançado ADS1115, cura UV, retrabalho com ar quente, crimpagem, inspeção
  térmica, projeção de pasta), cada um enviando os bytes de comando reais da
  ferramenta e descodificando a sua telemetria real.
- **Caixa de seleção ativa + keepalive** para todas as ferramentas com um watchdog de
  comunicação do lado do firmware (ferro de soldar, laser, cura UV, retrabalho com
  ar quente, bico de impressora 3D - reenvio a cada 150ms sob um watchdog de
  250ms; ventoinha de camada da impressora 3D - reenvio a cada 400ms sob o seu próprio
  watchdog de 1000ms), com os mesmos intervalos de reenvio da ferramenta de
  ambiente de trabalho. Ao desmarcá-la, mudar de painel ou de separador, desligar ou
  fechar a página é enviado o comando de desligar da ferramenta.
- **Global Controls** (`0x100`), passthrough SPI da **Expansion Board** + consulta
  TMC DIAG0 (`0x180`-`0x183`), consulta/apagamento da **F-RAM** (`0x190`-`0x192`),
  **Self-Test** (verificações seguras, em repouso, por ferramenta), um
  **Raw Bus Monitor** com exportação de traço `.trc`/`.asc`, e um injetor de
  **Custom Frame** com um intervalo de repetição opcional - validado como o
  próprio injetor de tramas do CAN Bus Protocol Analyzer: um identificador fora de
  `0`-`7FF`, um byte de dados inválido ou mais de 8 bytes é recusado com uma
  mensagem, nunca mascarado, descartado nem cortado. Os identificadores que só a
  placa transmite são recusados, e as escritas na memória da placa, os comandos do
  bootloader e os dos atuadores são confirmados antes.
- **Detect Hardware** consulta a ferramenta ativa real (`0x110`/`0x111`) e a
  versão da placa (`0x7F8`/`0x7F9`), e um erro crítico declarado (`0x111` byte 1)
  surge como um banner de falha em direto.

### Separação do simulador e confirmações (verificações de software, não funções de segurança)

- Os separadores de sandbox (Control, OLED, Thermal IR) não transmitem nada. As suas tramas levam a marca SIM e, enquanto há uma placa ligada, não produzem nenhuma resposta simulada. Das mensagens predefinidas do analisador de protocolo só são enviadas a uma placa ligada as consultas simples; as restantes continuam simuladas.
- O Tester Studio mostra um painel de ferramenta apenas para a ferramenta que a própria placa comunicou (`0x111`), e nenhum antes de a placa responder.
- Laser, berbequim, cura UV, soldadura, aquecedores, movimento, projeção de pasta, escritas na memória da placa e tramas escritas à mão que envolvam risco pedem confirmação antes.
- **PARAR TUDO** no cabeçalho (visível com a ligação ativa) desliga todos os atuadores que esta página mantém ativos; fechar a página e desligar fazem o mesmo. É um comando de software, não uma paragem de emergência.
- Gravar uma imagem assinada com a chave de desenvolvimento pública pede antes uma confirmação, porque essa chave não prova quem fez a imagem.
- Quando a placa declara um erro crítico, o aviso indica também o motivo da proteção contra fuga térmica, se a placa o comunicar.

### Ainda não coberto

- Os contadores de erro da inspeção térmica (`0x1AA`/`0x1AB`).
- Um modo só de escuta e a escolha da velocidade à mão: não é possível entrar num barramento em que nenhuma placa responde.
- A leitura da imagem térmica não verifica antes se o sensor está pronto nem repete um bloco perdido.
- Transferir um ficheiro de firmware diretamente da release do GitHub dentro do navegador: o GitHub serve os ficheiros de uma release a partir de um anfitrião sem cabeçalhos CORS, pelo que a transferência pode ser bloqueada (a imagem incluída, ou um ficheiro escolhido do disco com o seu `.manifest.json`, funcionam sempre).

## 🔐 Nota de segurança: nenhuma chave de assinatura nesta aplicação

Desde a 0.2.3 esta aplicação **não** contém nenhuma chave de assinatura HMAC-SHA256.
A build do URTC assina ela própria cada imagem de aplicação (com uma chave privada apenas nas builds de release; as imagens publicadas usam a chave pública de desenvolvimento) e publica a assinatura a seu lado; o Flasher
Studio apenas transporta essa assinatura - o mesmo modelo do `URTC Flasher` de
ambiente de trabalho. Nada secreto é incluído no bundle JS, pelo que a página pode
ser alojada publicamente.

A única exceção é uma imagem compilada por si, sem manifesto, para uma placa de
bancada: a aplicação pede então a chave de assinatura, mantém-na em memória
apenas para essa gravação e nunca a armazena. As imagens compiladas com a
chave de desenvolvimento PÚBLICA (`signing_key_kind: "dev"` no manifesto)
só se instalam em placas cujo bootloader tenha sido compilado da mesma forma - o
registo indica-o. Consulte o `docs/FIRMWARE_SIGNING.TXT` do URTC.

A pasta **não está no git**: cria-a `npm run sync-firmware` (a CI e a compilação do Pages executam-no antes dos testes e da compilação). Enquanto não existir uma release oficial, o «latest» do GitHub responde 404 e `firmware-release.json` indica a release usada em seu lugar (hoje a pré-release de bancada); apague-o, ou mude a sua etiqueta, quando for publicada uma oficial. **Segurança da página**: os scripts, os estilos, os tipos de letra e as imagens vêm da própria página (os tipos de letra vão empacotados com a aplicação, nenhum pedido vai para um servidor de tipos de letra), só são permitidos em linha os atributos de estilo que o React escreve, e a página só alcança a sua própria origem e os servidores do GitHub que servem as releases (Content-Security-Policy no `index.html` compilado). Um servidor que possa enviar cabeçalhos usa `public/_headers` (a mesma política, `Permissions-Policy: serial=(self)` e nada mais poderoso); o GitHub Pages não pode enviar cabeçalhos, por isso aí só vale a política que a própria página leva.

`public/firmware/` contém exatamente os ficheiros que o URTC publicou (mesmos
nomes, mesmos bytes, com os seus ficheiros auxiliares). Os binários do URTC não
estão no git: são anexos da release de cada versão no GitHub.
`npm run sync-firmware` transfere a release mais recente
(`npm run sync-firmware -- --tag v0.3.5` para uma em concreto), ou recebe uma
pasta local como argumento (`npm run sync-firmware -- ../URTC/firmware` para
uma build de bancada). Em ambos os casos verifica cada digest e os campos de
assinatura antes de tocar em `public/firmware/`, e regenera
`src/lib/bundledFirmware.ts`; um teste verifica o pacote contra os seus
manifestos.

Cada ficheiro de uma release oficial tem uma assinatura de release (`<ficheiro>.sig`, Ed25519): a sincronização verifica-a quando existe e recusa uma errada; um conjunto sem assinaturas (uma pré-release de bancada ou uma compilação local) precisa de `--allow-unsigned`. A página verifica a mesma assinatura no navegador (Web Crypto) antes de enviar uma imagem incluída ou uma imagem de uma release do GitHub para uma placa, e pára se não for válida.

## 🚀 Primeiros passos

### Pré-requisitos
- Node.js 20 LTS+
- npm

### Instalação

```bash
git clone https://github.com/JuanenRac/URTC-WEB-STUDIO.git
cd URTC-WEB-STUDIO
npm install
```

### Modo de desenvolvimento

Executa a aplicação com o servidor de desenvolvimento do Vite e recarregamento em direto:
- **Windows:** faça duplo clique em `dev.bat` ou execute `npm run dev`
- **Linux/Mac:** execute `./dev.sh` ou `npm run dev`

Depois abra `http://localhost:3000` no Chrome ou no Edge.

O servidor de desenvolvimento escuta apenas em `localhost`: o Web Serial funciona com https ou em localhost, por isso abri-lo à rede não traria nada.

### Build estático

Compila para um bundle estático e otimizado em `dist/`:
- **Windows:** faça duplo clique em `build.bat` ou execute `npm run build`
- **Linux/Mac:** execute `./build.sh` ou `npm run build`

Este é um site estático simples - não existe nenhum componente de servidor incluído (ao
contrário do próprio `server.ts` do `HYDRA-UMC STUDIO`). Pré-visualize localmente a pasta
`dist/` compilada com:

```bash
npm run preview
```

ou sirva o `dist/` com qualquer alojamento de ficheiros estáticos à sua escolha. O `npm run lint`
executa o compilador de TypeScript em modo de apenas verificação.

A página compilada declara uma política de segurança de conteúdo (scripts só da própria página; ligações só a si mesma e ao GitHub) e carrega cada separador quando é aberto pela primeira vez. Ainda não foi experimentada num navegador real.

### GitHub Pages (ferramenta de bancada)

O repositório pode publicar o site compilado no GitHub Pages (fluxo `.github/workflows/pages.yml`: `npm ci`, verificação de tipos, testes, `npm run build` com o caminho base do projeto, e depois `upload-pages-artifact` e `deploy-pages`). É oferecido como **ferramenta de bancada**: as imagens de firmware incluídas são assinadas com a chave pública de desenvolvimento, que qualquer pessoa pode usar; por isso a página publicada mostra um aviso e não é uma fonte de firmware de confiança para uma máquina em serviço. Para o ativar, o proprietário do repositório abre Settings > Pages e define Source como "GitHub Actions"; até lá o fluxo termina sem publicar. O Web Serial precisa de um navegador baseado em Chromium e de https, que o Pages fornece.

### Versionamento

A `version` do `package.json` (e a `version` correspondente em `urtc.project.json`) só sobe com o passo explícito `python bump.py` (executa o `bump_manifest_version.py`, que lê a versão atual do `package.json`, incrementa-a, volta a escrevê-la, sincroniza o manifesto e acrescenta uma entrada mínima ao CHANGELOG se essa versão ainda não tiver uma). `build.bat`/`build.sh` apenas compilam e nunca tocam na versão. O `npm run
build` (`vite build`) por si só é deliberadamente apenas de compilação e
nunca toca na versão - o `scripts/bump-version.mjs` fazia este trabalho num
desenho anterior com um hook `prebuild`, mas esse script é hoje legado, mantido apenas
como referência (veja o seu próprio comentário de cabeçalho); o `npm run dev`/`lint`/`preview`
também nunca tocam na versão. Isto não é Semantic Versioning: é um
conta-quilómetros em base 10. O dígito de patch sobe de um em um; quando passaria de
9, volta a 0 e o dígito de minor sobe no seu lugar (`0.1.9` -> `0.2.0`,
nunca `0.1.10`); o mesmo transporte propaga-se de minor para major. Consulte o
`CHANGELOG.md` para o histórico de versões e um resumo do trabalho passado neste
projeto.

## 📖 Mais documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — como a UI, as definições
  persistidas e a autoridade do transporte externo se mantêm separadas, e porque
  é que os separadores sandbox têm de expor estados offline/indisponível em vez de
  apresentar dados simulados como reais.
- [`docs/BUILD_AND_RUN.md`](docs/BUILD_AND_RUN.md) — o caminho de validação
  não mutante `build-test.bat`/`.sh` (TypeScript + testes, sem alterações de versão
  nem de CHANGELOG), `dev.bat`/`.sh` para desenvolvimento local, e porque é que o
  material de assinatura OTA nunca pertence à configuração do navegador.
- [`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md) — o que este
  cliente deve fazer perante um esquema desconhecido, uma identidade de destino
  em falta ou um resultado de API malformado, e porque é que a autoridade real de
  gravação permanece no servidor ou nas ferramentas de ambiente de trabalho dedicadas.

## 🛠️ Stack tecnológica
- **Linguagem:** TypeScript
- **Framework de frontend:** React 18
- **Ferramenta de build:** Vite
- **Estilos:** Tailwind CSS
- **Ícones:** Lucide React
- **CRC32:** `crc-32` - verificação de integridade da imagem de firmware, espelha
  o próprio cálculo de CRC32 do bootloader
- **Transporte de hardware:** Web Serial API + framing SLCAN (sem dependências
  nativas, sem servidor backend companheiro)

## 📂 Estrutura do repositório

```
/
├── src/
│   ├── App.tsx                     Componente raiz - estado dos separadores, estado do hardware, CAN
│   │                                registo de tramas, e os handlers ligados a cada
│   │                                separador abaixo (incluindo o início/leitura de volta de CAN OTA e
│   │                                o próprio injetor de tramas do CAN Bus Analyzer)
│   ├── main.tsx                    Ponto de entrada do Vite/React
│   ├── i18n.ts                     Configuracao do i18next - en/es/de/fr/it/zh/ja/pt, persistido
│   │                                em localStorage
│   ├── index.css                   Ponto de entrada do Tailwind
│   ├── types.ts                    Tipos TypeScript partilhados (CanFrame, HardwareState,
│   │                                FlasherState, ExpansionBoardType, ...)
│   ├── vite-env.d.ts                Declaracoes de tipos ambientais proprias do Vite
│   ├── components/
│   │   ├── Header.tsx               Barra superior: botao ligar/desligar, nome da
│   │   │                            ferramenta ativa, interruptor sandbox FW v0.0/v0.1
│   │   ├── Sidebar.tsx              Navegacao esquerda - os 7 separadores descritos neste README
│   │   ├── ToolCatalog.tsx          Separador sandbox: o catalogo de 25 ferramentas, selecao
│   │   │                            de ferramenta, controlo de setpoint
│   │   ├── OledDisplay.tsx          Separador sandbox: pre-visualizacao do ecra de estado OLED
│   │   ├── SpecsAndBomViewer.tsx    Separador sandbox: navegador de BOM/pinouts
│   │   ├── ThermalCameraViewer.tsx  Separador sandbox: feed simulado do MLX90640 - 100%
│   │   │                            Math.random(), sem qualquer trafego CAN (ver
│   │   │                            "O que e real e o que e uma sandbox" acima)
│   │   ├── HardwarePanel.tsx        Painel sandbox de controlo de jumpers/LED/placa de expansao,
│   │   │                            usado dentro dos separadores Control e OLED
│   │   ├── CanBusAnalyzer.tsx       Separador real: registo de tramas CAN em bruto, injetor
│   │   │                            de tramas personalizadas, acionadores de comandos predefinidos
│   │   ├── FlasherStudio.tsx        Separador real: interface CAN-OTA (principal + slave de
│   │   │                            expansao) e o explicador da capacidade SWD/JTAG
│   │   ├── TesterStudio.tsx         Separador real: controlo/telemetria em direto por
│   │   │                            ferramenta, construido a partir da pasta tester/ abaixo
│   │   └── tester/
│   │       ├── ToolPanels.tsx       Um painel por perfil de ferramenta - bytes de comando reais,
│   │       │                        descodificacao de telemetria real, keepalive de watchdog por ferramenta
│   │       ├── GlobalPanels.tsx     Global Controls, Expansion Board, F-RAM,
│   │       │                        Self-Test, Raw Bus Monitor, injetor de Custom Frame
│   │       └── shared.tsx           Primitivas de UI partilhadas (Section, Field, classes de botao/input,
│   │                                safeInt)
│   ├── data/
│   │   └── toolsData.ts             Os 25 TOOL_PROFILES - nomes, valores predefinidos, icones para
│   │                                os separadores sandbox
│   ├── hooks/
│   │   ├── useSerialCanBus.ts       Transporte Web Serial + SLCAN - ligar/desligar,
│   │   │                            TX/RX de tramas, waitForFrame por ID com um buffer rx
│   │   │                            limitado e um limite de fila de 500 tramas
│   │   ├── useFlasher.ts            Maquina de estados de CAN-OTA (placa principal + slave de
│   │   │                            expansao), espelha flasher_protocol.py
│   │   └── useKeepalive.ts          Hook de reenvio a intervalo fixo que suporta o keepalive
│   │                                de watchdog da caixa de selecao ativa de cada ferramenta
│   ├── lib/
│   │   ├── flasher.ts               Constantes do protocolo OTA, auxiliares CRC32/HMAC,
│   │   │                            leitura de manifestos (sem chave de assinatura)
│   │   ├── boardVersion.ts          Consultas de versão: 0x7F9/0x7FA/0x7E9 e 0x217/0x218 do escravo
│   │   ├── githubRelease.ts         Imagens da release mais recente do GitHub e a sua transferência
│   │   ├── firmwareImage.ts         Verificações da imagem, destino do manifesto e versão (com patch)
│   │   ├── firmwareSignature.ts     Escolhe a assinatura a enviar: a publicada,
│   │   │                            ou uma chave introduzida para uma gravacao; verificacao sha256
│   │   ├── quickState.ts            Descodificacao de 0x111 (falha termica, causa de reset)
│   │   ├── bundledFirmware.ts       Gerado por scripts/sync-firmware.mjs
│   │   └── canIds.ts                Constantes de CAN ID para o Tester Studio - espelha
│   │                                 tester_config.py byte a byte
│   └── locales/                     Cadeias da UI - en.json, es.json, de.json, fr.json,
│                                     it.json, ja.json, zh.json, pt.json
├── scripts/
│   ├── bump-version.mjs             Script de subida de versao sem dependencias; legado
│   │                                 hoje, mantido apenas como referencia - substituido
│   │                                 por bump_manifest_version.py (ver "Versionamento")
│   └── sync-firmware.mjs            Copia os ficheiros da release do URTC (ou uma
│                                     pasta local) para public/firmware/, digests
│                                     verificados - npm run sync-firmware
├── public/
│   └── firmware/                    .bin/.elf/.hex incluidos para a aplicacao principal,
│                                     o bootloader principal, a aplicacao do slave de expansao,
│                                     e o bootloader do slave de expansao
├── images/
│   ├── URTC_WEB_STUDIO_BANNER.svg   Banner de logotipo completo (mostrado no topo deste README)
│   ├── URTC_APP_ICON_NEW.svg        Icone da aplicacao
│   ├── urtc_custom_icon.svg         Icone da aplicacao, mesma arte
│   └── urtc_icon.ico                Favicon
├── index.html                       HTML de entrada do Vite
├── vite.config.ts                   Configuracao do Vite + plugin do Tailwind
├── tsconfig.json                    Configuracao do TypeScript
├── .env.example                     A aplicacao nao le nenhuma variavel
├── dev.bat / dev.sh                 Instala dependencias + inicia o servidor de desenvolvimento do Vite
├── build.bat / build.sh             Instala dependencias + produz a build estatica de dist/
├── tools/
│   └── ci_validate.py               Validacao de manifesto/CHANGELOG/docs usada pela CI
├── bump.py                          Comando explícito para subir a versão (compilar nunca a sobe)
├── bump_manifest_version.py         Subida de versão, iniciada apenas por `bump.py` (package.json + manifesto, ver "Versionamento"); o modo `--sync` também existe para aceitar uma subida nativa anterior
├── package.json
├── CHANGELOG.md                     Histórico de versões e um resumo do trabalho passado
├── LICENSE
├── NOTICE                      Aviso de direitos de autor e licença da documentação
├── README.md                        Este ficheiro
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BUILD_AND_RUN.md
│   └── INTEGRATION_CONTRACT.md
└── README_spa.md / README_ita.md / README_fra.md / README_deu.md / README_zho.md / README_jpn.md  <- traduções
```

## 📜 LICENÇA

O URTC Web Studio é (c) 2026 JuanenRac (Electro Hobby 3D). Este aviso deve
ser incluído em quaisquer distribuições deste projeto ou de trabalhos derivados.

Este projeto é composto por código-fonte e pela sua própria documentação, disponibilizados
sob licenças diferentes - cada uma adequada ao que realmente cobre:

1. O código-fonte (tudo o que está em `src/`, mais a configuração de
   Vite/TypeScript que o compila) está disponível sob a **GNU General Public
   License v3.0 (GPL-3.0-or-later)**. Texto completo em
   https://www.gnu.org/licenses/gpl-3.0.html.

2. A documentação (este README e as suas próprias traduções -
   `README_spa.md`, `README_ita.md`, `README_fra.md`, `README_deu.md`,
   `README_zho.md`, `README_jpn.md`) está
   disponível sob **Creative Commons Attribution-ShareAlike 4.0
   International (CC BY-SA 4.0)**. Texto completo em
   https://creativecommons.org/licenses/by-sa/4.0/.

Esta ferramenta é o companheiro baseado no navegador do projeto
[URTC (Universal Robot Tool Controller)](https://github.com/JuanenRac/URTC)
- consulte o repositório próprio desse projeto para o firmware da placa, os desenhos
de hardware e a documentação completa do protocolo contra o qual esta ferramenta
foi implementada. O firmware do próprio URTC é GPL-3.0-or-later e os seus desenhos de hardware são
CERN-OHL-S v2; a licença desta ferramenta aqui não se estende a esse projeto
separado, e vice-versa. Existem também duas alternativas nativas de ambiente de trabalho
que cobrem o mesmo terreno: [URTC Flasher](https://github.com/JuanenRac/URTC-FLASHER)
e [URTC Tester](https://github.com/JuanenRac/URTC-TESTER).

Se construir sobre este projeto, tenha em conta a divisão de licenças: as alterações
de código devem manter-se GPL-3.0-or-later, os derivados da documentação devem manter-se CC
BY-SA - cada um com atribuição a este projeto e ao seu autor.

**Separadores Caixa negra, Funções opcionais, Bancada do rack e Vista térmica (novos, verificados apenas com simulações):** o Tester Studio lê o registador de falhas (`0x1A8` / `0x1A9`) e descarrega-o em CSV ou JSON, automaticamente uma vez por cada erro indicado pela placa quando essa opção está ativa; liga as funções opcionais do firmware (`0x1AE` / `0x1AF`, desligadas por predefinição, após uma confirmação; atuam após o próximo arranque); simula o rack de ferramentas na página, com a identidade de cada cabeça (tipo e número de série); e desenha a imagem de inspeção térmica em falsa cor (uma imagem simulada di-lo). O catálogo de ferramentas vem agora dos perfis de ferramenta partilhados do URTC-COMMON. Nada disto foi experimentado com uma placa real.

## 🔗 Projetos Relacionados

Este projeto faz parte do ecossistema de robótica HYDRA-UMC do mesmo autor (JuanenRac / Electro Hobby 3D). Vale a pena conhecê-los, uma vez que um pedido pode, na verdade, dizer respeito a um destes e não a este repositório.

**Projeto Principal**
- **[URTC](https://github.com/JuanenRac/URTC)** — firmware para a PCB física do Universal Robot Tool Controller, mais de 25 perfis de ferramenta sobre barramento CAN; o projeto principal de que este repositório é uma ferramenta específica, dentro da sua própria família de ferramentas de barramento CAN.

**Projetos Irmãos** — as outras ferramentas da própria família de ferramentas de barramento CAN do URTC
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — ferramenta de gravação com GUI para ambiente de trabalho para placas URTC, CAN-OTA mais SWD/JTAG de chip completo — mesmo protocolo SLCAN/CAN que esta aplicação baseada no navegador, que é a alternativa sem instalação a essa ferramenta.
- **[URTC-GATEWAY](https://github.com/JuanenRac/URTC-GATEWAY)** — uma gateway à frente do barramento CAN que só deixa passar identificadores de uma lista, limita a sua taxa e pede uma chave de sessão.
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — ferramenta de diagnóstico de barramento CAN em direto para ambiente de trabalho, para placas URTC, um painel por perfil de ferramenta — mesmo protocolo SLCAN/CAN que esta aplicação baseada no navegador, que é a alternativa sem instalação a essa ferramenta.

**Diretamente Relacionados**
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — CLI de frota com um contrato de códigos de saída real e estável, um cliente real e em direto da própria API do HYDRA-UMC-SERVER — uma alternativa de terminal/linha de comandos a esta ferramenta baseada no navegador.

**Também Faz Parte do Ecossistema**

*Hardware Central e Plataforma*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — o desenho da placa-mãe do braço robótico: anfitrião CM5 + STM32H745 de dois núcleos, pensado para orquestrar até 8 braços de ferramenta por CAN-OTA/SPI-OTA (firmware numa fase inicial; ainda sem placa montada).
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — camada de produto reprodutível sobre o Raspberry Pi OS para o CM5: agente só de leitura, config/perfis validados, aprovisionamento Wi-Fi de primeiro contacto.
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — o contrato JSON-Schema partilhado e a fronteira de software de controlo de trabalhos contra a qual cada bridge valida os seus comandos (não é uma função de segurança certificada).
- **[HYDRA-UMC-CONNECTOR-HUB](https://github.com/JuanenRac/HYDRA-UMC-CONNECTOR-HUB)** — registo declarativo e validador de manifestos de adaptador para conectores de máquinas externas; estende a própria ideia de contrato do SDK a máquinas externas sem substituir os projetos de gateway industrial.

*Backend Central e Clientes*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — o backend headless real (REST/WebSocket) com o qual todos os clientes de controlo comunicam de facto.
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — painel de controlo web com visualização 3D multi-robô em tempo real.
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — centro de comando de enxame para ambiente de trabalho (PySide6) para vários servidores em simultâneo, empacotado como executável autónomo.
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — aplicação nativa de controlo para Android com início de sessão biométrico e uma aplicação companheira Wear OS emparelhada.
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — aplicação de controlo para iOS/iPadOS (Flutter) com sincronização WebSocket em tempo real.
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — interface tátil nativa para o ecrã tátil DSI de 7" a bordo, embebida no próprio CM5.
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — criador/editor gráfico de URDF para ambiente de trabalho que envia os modelos concluídos para o próprio catálogo do STUDIO.
- **[HYDRA-UMC-EDITOR-STL](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-STL)** — editor de modelos STL para ambiente de trabalho, que transforma/substitui/remove/acrescenta peças reais no mesmo catálogo de modelos que o HYDRA-UMC-EDITOR-URDF também edita.
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — fronteira de coordenação para frotas AGV/AMR através de um publicador MQTT VDA 5050 (testado apenas contra uma frota emulada).
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — coordenador de células CNC de alto nível com acesso ao estado GRBL e aos bytes de controlo (testado apenas contra um emulador).
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — fronteira de coordenação para droides com patas/humanoides, com um emissor de comandos para o Boston Dynamics Spot (testado apenas contra um emulador).
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — coordenador de células laser que lê 3 sinais GPIO (chave, caixa e interlock) (testado apenas contra um chip simulado; não pode armar nem disparar um laser).
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — coordenador seguro de alto nível do fluxo de placas para o pick-and-place OpenPnP.
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — fronteira de coordenação segura para impressoras 3D Moonraker/Klipper, com comandos de trabalho reais e controlados.
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — coordenador com um transporte ROS 2 baseado em rclpy importado sob demanda (ainda não executado contra uma instalação ROS 2).
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — fronteira de coordenação para UAV com câmara, com um emissor de comandos MAVLink (testado apenas contra um emulador).

*Nó de IA de Visão (Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — hub de integração para o pipeline de visão Hailo-8, com uma verificação real de prontidão de hardware por fase.
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — registo real de modelos compilados com verificação de carregamento seguro por arquitetura Hailo/checksum.
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — pipeline GStreamer real + gerador de configuração MediaMTX, com uma fronteira de integração HailoRT real.
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — lei de correção de servovisão baseada em posição com autorização condicionada ao estado da zona; ainda sem estimativa de pose por câmara.
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — lógica v0 de violação de zonas, atualidade da calibração e pedido de E-STOP que lê as posições dos objetos de um ficheiro; nenhum detetor a alimenta e ainda não há E-STOP físico ligado.

*Nó de IA Cognitivo (Hailo-10)*
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — hub de integração para o pipeline cognitivo Hailo-10 (orquestração de LLM/VLA/voz).
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — codificação/descodificação real de tokens de ação e geração de trajetórias para um modelo Vision-Language-Action.
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — front-end de voz real (VAD + analisador de intenções) com um relé para o Watch limitado e sujeito a confirmação.
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — decomposição real de tarefas baseada em regras e recuperação semântica de erros sobre códigos de erro do MCU.
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — pesquisa real de documentos TF-IDF apenas com a biblioteca padrão sobre os documentos Markdown do próprio ecossistema.
- **[HYDRA-UMC-LOCAL-TECHNICIAN](https://github.com/JuanenRac/HYDRA-UMC-LOCAL-TECHNICIAN)** — técnico de manutenção com IA local e controlado por políticas para o próprio ecossistema - observa, diagnostica e propõe correções; os dois níveis de risco mais elevados não estão deliberadamente implementados por enquanto.

*Orquestração e Enxame*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — hub de integração com um contrato real de relatório de saúde gRPC/Protobuf e uma máquina de estados de missão.
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — fila de trabalhos real baseada em prioridade com deduplicação, sobre uma API HTTP real.
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — watchdog real de saúde da frota baseado em gRPC, com retry/backoff e deteção de incompatibilidade de identidade.
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — planeador de trajetos 3D real baseado em RRT, com validação real de colisões com obstáculos/espaço de trabalho.
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — sincronização de estado real com CRDT LWW-Element-Map, testada por propriedades para convergência multicélula.

*Gémeo Digital e Simulação*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — hub de integração para o motor de gémeo digital, com um contrato real de sincronização por compatibilidade de versões.
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — encaminhador hardware-in-the-loop com um interlock de software de colisão entre a simulação e o hardware real (testado sem hardware real).
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — cinemática direta real e validação de limites de juntas sobre um subconjunto real de URDF.
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — gerador real de cenas 2D procedimentais com exportação de anotações YOLO/COCO.

*Dados e Análise*
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — armazenamento real de séries temporais assente em sqlite3, com uma API HTTP real de ingestão/consulta.
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — detetor de anomalias real baseado em FFT + linha de base estatística, com monitorização de deriva.
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — cálculo real de OEE/disponibilidade sobre o histórico do DATALAKE, com exportação CSV reprodutível.
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — pipeline real de ingestão CAN/WebSocket para o DATALAKE, com deduplicação por sequência.

*Gateway Industrial*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — hub de integração que retransmite para protocolos industriais, com uma camada real de lista de comandos permitidos/contrapressão.
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — espaço de endereços OPC-UA real, verificado com uma sessão real de cliente do protocolo binário.
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — broker MQTT real com autenticação opcional por cliente e ACLs de tópicos.
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — endpoints XML reais `/probe` e `/current` do MTConnect, com saída em modo degradado.

*Ferramentas Complementares e Operações do Ecossistema*
- **[HYDRA-UMC-DASHBOARD-AI](https://github.com/JuanenRac/HYDRA-UMC-DASHBOARD-AI)** — painéis de Resumos Inteligentes e Destaque de Anomalias sobre o DATALAKE/ANOMALY-DETECTOR, com um recurso estatístico honesto.
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — aplicação companheira WearOS com padrões de alerta tátil e um relé de voz para o telemóvel emparelhado (ainda não executada num relógio físico).
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — firmware para um rack de montagem de placas com descodificação real do ID de ferramenta e lógica de pré-aquecimento Smart Idle.
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — firmware mais um companheiro de visão real em Python para um cabeçote de ferramenta de inspeção térmica/RGB.
- **[URTC-UPDATER](https://github.com/JuanenRac/URTC-UPDATER)** — ferramenta de ambiente de trabalho que deteta, instala e atualiza os repositórios da família URTC, uma ação explícita de cada vez.
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — ferramenta administrativa para ambiente de trabalho que descobre, clona e atualiza todos os repositórios deste ecossistema.
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** — ferramenta de ambiente de trabalho Windows/Linux que constrói uma imagem do CM5 pronta a gravar, pré-carregada com as versões mais atuais do ecossistema, com configuração de Wi-Fi/utilizador/SSH no primeiro arranque ao estilo do Raspberry Pi Imager.
- **[HYDRA-UMC-OPS-AGENT](https://github.com/JuanenRac/HYDRA-UMC-OPS-AGENT)** — coordenador de incidentes de manutenção: um papel edge de baixo privilégio recolhe um snapshot de inventário/saúde higienizado, um papel control-plane apresenta-o só de leitura e pede a um fornecedor de IA que sugira um diagnóstico - nunca aplica um patch nem implanta nada.
- **[HYDRA-UMC-DEV-SERVER](https://github.com/JuanenRac/HYDRA-UMC-DEV-SERVER)** — host de desenvolvimento reprodutível (Raspberry Pi 5 / CM5) que armazena o código-fonte do ecossistema e executa tarefas limitadas de build/teste sob uma fila durável; um papel de desenvolvimento dedicado, explicitamente não um CM5 operacional.

---

## 📚 Documentação e Comunidade

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — stack tecnológica e diretrizes de codificação para um pull request.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — as normas de comportamento esperadas nesta comunidade.
- **[SECURITY.md](SECURITY.md)** — como reportar uma vulnerabilidade, e as áreas reais de foco em segurança deste projeto.
- **[SUPPORT.md](SUPPORT.md)** — onde colocar questões e reportar erros.
- **[LICENSE.md](LICENSE.md)** — a licença própria deste projeto.

## 👤 AUTOR

**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)
