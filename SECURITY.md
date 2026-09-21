# Segurança

Não envie chaves comerciais, tokens, senhas ou identificadores brutos em issues públicas.

## Princípios do projeto

- ações permitidas em lista fechada;
- `contextIsolation` e sandbox do Electron ativados;
- renderer sem acesso direto ao Node.js;
- comandos do sistema sem interpolação de texto enviado pelo usuário;
- nenhuma prioridade de processo acima de `High`;
- quarentena antes de exclusão;
- restauração e auditoria local.

## Antes da revenda

A versão comercial precisa de assinatura de código do Windows, HTTPS obrigatório na API, rotação de chaves, rate limiting, logs de revogação e testes em máquinas limpas com Windows 10 e Windows 11.
