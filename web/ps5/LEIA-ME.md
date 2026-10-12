# Overdrive no PS5

Rode os comandos abaixo de dentro de `web/`.

`pkg/Overdrive-OVRD00011.pkg` ("Overdrive") abre `http://127.0.0.1:8080/fs/data/overdrive/index.html`: o app servido
pelo [websrv](https://github.com/ps5-payload-dev/websrv) no próprio console, com o `param.json` no formato do Homebrew
Launcher. Exige o `websrv-ps5.elf` carregado (Payload Manager, a cada boot ou no auto-load) e o `dist-ps5/` copiado para
`/data/overdrive`. Atualizar o app é só copiar a pasta de novo. O caminho `file:///app0/web/index.html` não carrega no
console ("network error"). Instale pelo ps5upload.

O sistema abre o app numa janela do navegador; o build do PS5 pede tela cheia no primeiro botão pressionado.

**Por que tem `padding.bin` (24 MB aleatórios):** o ps5upload encerra a sessão de instalação quando os bytes
servidos passam do tamanho do pacote. Num pacote de poucos KB, as leituras de cabeçalho do console já passam
disso, a sessão fecha antes do conteúdo e o console recebe HTTP 410 (instala incompleto → `CE-100022-5` ao abrir).
Com o preenchimento incompressível, o pacote fica maior que essas leituras e a instalação termina.

`src/OVRD00011/` tem o conteúdo do pacote: `sce_sys/param.json`, `sce_sys/icon0.png`,
`eboot.bin` (16 bytes zerados, exigido pelo montador), `padding.bin` e `web/` (o build `npm run build:ps5`).

Remontar o pacote (o `fpkg_build` é um exemplo do crate `engine/crates/ps5upload-fpkg` de `phantomptr/ps5upload`:
`cargo build --release -p ps5upload-fpkg --example fpkg_build`):

    npm run build:ps5
    rm -rf ps5/src/OVRD00011/web && cp -R dist-ps5 ps5/src/OVRD00011/web
    rm ps5/pkg/Overdrive-OVRD00011.pkg
    fpkg_build ps5/src/OVRD00011 ps5/pkg --name Overdrive-OVRD00011
