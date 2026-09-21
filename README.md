# Andrade Boost v0.3

Aplicativo desktop para Windows 10/11 voltado a jogadores de GTA V e FiveM. Esta versão reconstrói o projeto com foco em segurança, transparência e possibilidade real de restauração.

## O que já funciona

- painel dinâmico em Electron + React;
- leitura real de CPU, memória, disco, GPU, Windows e estado do FiveM;
- perfis Seguro, Equilibrado, Competitivo e Qualidade;
- análise antes de aplicar qualquer alteração;
- limpeza de cache do FiveM sem remover os arquivos do jogo;
- quarentena para arquivos removidos e restauração do último backup;
- ativação do Modo de Jogo e desativação reversível do Game DVR;
- renovação do cache DNS;
- prioridade Alta do FiveM apenas na sessão atual — nunca Tempo Real;
- plano de Alto Desempenho com restauração do plano anterior;
- auditoria local em JSONL;
- cliente preparado para a API online de licenças;
- pipeline que gera o instalador `.exe` pelo GitHub Actions.

## O que o aplicativo não faz

- não promete “zero input lag” ou quantidade fixa de FPS;
- não apaga `Prefetch` — isso costuma piorar o carregamento e não é uma otimização confiável;
- não desativa Windows Update, Defender, áudio, rede ou serviços essenciais;
- não altera arquivos protegidos do GTA V;
- não executa ações escondidas: toda ação aparece antes da confirmação.

## Desenvolvimento

Requisitos: Node.js 22 e Windows 10/11 para testar as otimizações reais.

```bash
npm install
npm run dev
```

Para verificar e compilar:

```bash
npm run typecheck
npm run build
```

Para gerar o instalador no Windows:

```bash
npm run dist:win
```

O instalador também é produzido automaticamente no GitHub Actions e aparece como artefato `AndradeBoost-Windows`.

## Licenças

O modo de desenvolvimento vem desbloqueado. Na distribuição comercial, configure:

- `AB_REQUIRE_LICENSE=true`
- `ANDRADE_BOOST_API_URL=https://sua-api.exemplo`

O aplicativo envia para a API somente um hash do dispositivo, nunca o nome bruto da máquina. O painel administrativo e a API online de licenças são a próxima etapa do projeto.

## Estrutura de segurança

Arquivos limpos são movidos para `%APPDATA%/Andrade Boost/optimizer/backups`. O manifesto registra o local original. Alterações de Registro e plano de energia têm o valor anterior salvo para restauração.

> Feche o FiveM antes de limpar cache. Crie também um ponto de restauração do Windows antes de usar qualquer ferramenta de otimização, inclusive esta.
