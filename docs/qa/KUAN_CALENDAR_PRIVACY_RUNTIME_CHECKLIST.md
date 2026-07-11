# QA, Calendar, Privacy & Runtime Validation Checklist

Este documento detalha o plano de testes, procedimentos de QA e garantias de conformidade do PR #31 (**Kuan Commercial Integrity Hardening**).

---

## 1. Calendar, Timezones & Availability

### Configurações de Timezone do Guardião
- [ ] Acessar `/authenticated/kuan/config` (painel de configuração do Guardião).
- [ ] Validar a presença do seletor de fuso horário (Timezone Select Box).
- [ ] Salvar o fuso horário (ex: `America/Sao_Paulo`, `Europe/London`) e garantir que a preferência seja registrada na coluna `regras_agenda` do banco de dados Supabase.
- [ ] Verificar que, ao omitir o fuso horário, o sistema herda nativamente `America/Sao_Paulo` como fallback.

### Conformidade GREGORIAN & Geração de .ics
- [ ] Acessar `/authenticated/kuan/agendamentos` e exportar o calendário no formato `.ics`.
- [ ] Validar que o cabeçalho contém `CALSCALE:GREGORIAN`.
- [ ] Validar que datas e horas estão em formato estrito UTC/ZULU ou contêm a indicação adequada de timezone.
- [ ] Validar que todos os valores especiais gerados na descrição ou localização do agendamento estão corretamente sanitizados e escapados (ex: quebras de linha `\n`, vírgulas `\,`, ponto-e-vírgula `\;`).

---

## 2. Resource Ownership Isolation (Cross-Guardian Leaks)

Garante que um guardião B não consiga ler, propor, registrar comprovantes ou interagir com clientes, agendamentos, ordens ou pagamentos pertencentes ao guardião A.

### Testes de Isolamento de Escopo (Backend)
- [ ] Executar tentativas de propor agendamento (`proposeAppointment`) utilizando um `clientId` que pertença a outra conta/guardião. Validar se o backend dispara a exceção correspondente (`assertOwnedClient` falha).
- [ ] Executar tentativas de propor pedido (`proposeOrder`) utilizando um `clientId` de outro guardião. Validar retorno de erro/exceção.
- [ ] Chamar `registerProof` informando um `orderId` associado a outro guardião. Garantir barreira total.
- [ ] Chamar `createPortalToken` informando um `clientId` pertencente a terceiros. Validar se o isolamento de escopo previne a geração do token.

---

## 3. State-Machine Transitions & Conflict Prevention

Garante integridade nas transições comerciais por meio do controle estrito de status prévios e assertividade de atualizações em linha única.

### Transições de Pedidos (`status` de `orders`)
- [ ] **Confirmar Pedido (`confirmOrder`)**:
  - Tentar confirmar a partir do estado `draft` ou `proposed`. Deve suceder.
  - Tentar confirmar a partir de outro estado (ex: `canceled`, `confirmed`). O sistema deve trapar a incompatibilidade e lançar exceção de conflito de concorrência.
- [ ] **Cancelar Pedido (`cancelOrder`)**:
  - Tentar cancelar a partir do estado `draft`, `proposed` ou `confirmed`. Deve suceder.
  - Tentar cancelar a partir de `received_proof` ou estados finalizados. Deve falhar com exceção de conflito de concorrência.

### Transições de Pagamentos (`status` de `payments`)
- [ ] **Verificar Comprovante (`verifyPayment`)**:
  - Tentar aprovar pagamento que não esteja no estado `received_proof`. Deve lançar exceção de conflito de concorrência.
- [ ] **Rejeitar Comprovante (`rejectPayment`)**:
  - Tentar rejeitar pagamento que não esteja no estado `received_proof`. Deve lançar exceção de conflito de concorrência.

---

## 4. Public Privacy & Consent Controls

Proteção da privacidade de dados públicos do cliente localizados no navegador.

### Consentimento de Dados (Opt-In Only)
- [ ] Acessar a página de chat público de um guardião (`/g/:guardianId`).
- [ ] Garantir que a caixinha "Lembrar minhas informações de contato e conversa neste navegador" inicia **desmarcada por padrão** (Opt-In estrito).
- [ ] **Sem marcar a caixinha**:
  - Recarregar a página e garantir que nenhuma informação como nome, email ou telefone seja persistida no `localStorage`.
  - Garantir que o `visitorKey` seja mantido na sessão corrente do navegador através do fallback em `sessionStorage` para evitar a perda do chat no reload imediato da página de agendamento ativo.
- [ ] **Marcando a caixinha (Opt-In)**:
  - Digitar dados de contato e conversa.
  - Recarregar a página e verificar se os dados de contato e conversa persistem através do `localStorage`.
- [ ] **Botão "Limpar dados salvos"**:
  - Clicar em "Limpar dados salvos".
  - Validar que todo o rastro local (incluindo `consent`, `visitor`, `name`, `email` e `phone`) sob o escopo do guardião correspondente foi limpo do `localStorage`.
  - Garantir que um novo `visitorKey` limpo seja imediatamente gerado usando `crypto.randomUUID()`.

---

## 5. Runtime & Server Consistency

Garantia de consistência do ecossistema e manipulação correta de payloads binários e multi-byte.

### Segurança Binária & Streaming em `serve.mjs`
- [ ] Validar que o corpo da requisição é recebido e transmitido para o Workers Handler utilizando Buffers binários puros ao invés de codificação em string.
- [ ] Validar que assets estáticos, SSR, páginas SPA e downloads dinâmicos (como `.ics`) são lidos de forma binária (`staticRes.arrayBuffer()`) e transferidos sem codificações espúrias para o fluxo de resposta do Node.js/Bun.
- [ ] Executar o comando de inicialização `bun run start` (ou `npm run start`) e verificar o carregamento saudável do servidor e das páginas sem degradação de caracteres especiais ou falhas de cabeçalho.
