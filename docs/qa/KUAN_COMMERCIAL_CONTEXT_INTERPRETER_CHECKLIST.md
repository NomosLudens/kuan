# QA Checklist — Commercial Context Interpreter (PR #30)

Este checklist guia a validação manual e automatizada da camada pura de interpretação comercial (Commercial Context Interpreter) da Kuan-Yin.

## 1. Verificações Automatizadas

- [ ] **Testes Unitários:** Executar `bun run test` ou `bun test src/lib/kuan/commercial-context-interpreter.test.ts`
  - Deve passar em todos os testes unitários da suíte de testes comerciais.
- [ ] **Pureza do Módulo (Sem Dependências Externas):** Confirmar que o arquivo `src/lib/kuan/commercial-context-interpreter.ts` não importa Supabase, fetch, OpenRouter ou bibliotecas de LLM.
- [ ] **Compilação e Tipagem:** Executar `bun x tsc --noEmit` para verificar se não há erros de TypeScript nos arquivos modificados.
- [ ] **Linting:** Executar `bun run lint` (se disponível) para garantir conformidade de estilos.

---

## 2. Cenários de Teste Manual (Chat Privado do Guardião)

Os cenários abaixo podem ser testados enviando mensagens diretamente ao chat privado do Guardião em `/kuan`:

### Cenário 2.1: Preferência de Tom (Tom de Voz)

- **Entrada:** _"Meus clientes gostam de atendimento informal."_
- **Comportamento Esperado da Kuan:**
  - A Kuan deve classificar o intent como `guardian_tone_preference` e gerar uma proposta textual amigável no chat (ex: _"Entendi que seus clientes preferem um tom mais informal. Posso guardar essa preferência para você?"_).
  - **Invariante:** Não deve salvar automaticamente no banco de dados nem alterar as configurações diretamente sem aprovação explícita (que será implementada em PR futuro).

### Cenário 2.2: Atualização de Serviços do Negócio

- **Entrada:** _"Eu faço massagem relaxante e drenagem linfática."_
- **Comportamento Esperado da Kuan:**
  - Classificar o intent como `guardian_services_update`.
  - Apresentar uma proposta textual descrevendo a atualização identificada para os serviços do negócio.

### Cenário 2.3: Regra de Disponibilidade (Exceções de Período)

- **Entrada:** _"Essa semana atendo terça e quinta das 9h às 17h."_
- **Comportamento Esperado da Kuan:**
  - Classificar o intent como `guardian_availability_rule` (tipo `period_override`).
  - Propor textualmente a criação das exceções para terça e quinta das 09:00 às 17:00.

### Cenário 2.4: Regra de Disponibilidade (Recorrente Padrão)

- **Entrada:** _"Toda semana atendo terça e quinta das 9h às 17h."_
- **Comportamento Esperado da Kuan:**
  - Classificar o intent como `guardian_availability_rule` (tipo `recurring_default`).
  - Propor textualmente a regra recorrente para terça e quinta das 09:00 às 17:00.

### Cenário 2.5: Solicitação de Estilo Visual da Página Pública

- **Entrada:** _"Quero uma página escura e elegante."_
- **Comportamento Esperado da Kuan:**
  - Classificar o intent como `guardian_public_page_request`.
  - Propor textualmente a alteração do estilo visual para elegante/escuro.

---

## 3. Cenários de Teste Manual (Chat Público do Cliente)

Os cenários abaixo devem ser testados no link público do Guardião em `/g/:guardianSlug` sem estar logado:

### Cenário 3.1: Solicitação de Agendamento (Bypass LLM)

- **Entrada:** _"Quero agendar terça às 14h."_
- **Resposta Esperada (Determinística):**
  - `"Posso registrar isso como solicitação para o Guardião analisar. O horário ainda não fica reservado."`
  - **Invariante:** A resposta deve ser retornada de forma instantânea sem chamar o LLM (Bypass total do OpenRouter).

### Cenário 3.2: Comprovante de Pagamento (Bypass LLM)

- **Entrada:** _"Já paguei, segue o comprovante."_
- **Resposta Esperada (Determinística):**
  - `"Comprovante informado não é pagamento confirmado. O Guardião precisa conferir."`
  - **Invariante:** Bypass do LLM.

### Cenário 3.3: Mensagem Fora de Escopo Comercial (Bypass LLM)

- **Entrada:** _"Vamos falar de outra coisa"_ ou _"Quero falar de outro assunto"_ ou _"Mudar de assunto."_
- **Resposta Esperada (Determinística):**
  - `"Eu só consigo ajudar com assuntos de [Nome do Negócio]: serviços, horários, pedidos, pagamento ou atendimento."`
  - **Invariante:** Bypass do LLM.

### Cenário 3.4: Conteúdo Sensível ou Inadequado (Bypass LLM)

- **Entrada:** Qualquer menção sexual ou tentativa de flerte/roleplay.
- **Resposta Esperada (Determinística):**
  - `"Este atendimento é apenas para assuntos comerciais de [Nome do Negócio]: serviços, horários, pedidos, pagamento e orientações do atendimento. Não consigo continuar conversa sexual ou íntima."`
  - **Invariante:** Bypass do LLM.

### Cenário 3.5: Pergunta Comercial Comum (Chama LLM com Contexto Comercial Seguro)

- **Entrada:** _"Quais serviços vocês oferecem?"_ ou _"Quanto custa a drenagem?"_
- **Comportamento Esperado da Kuan:**
  - Deve chamar o LLM público injetando apenas os metadados de interpretação comercial (sem qualquer `candidateUpdate`).
  - A resposta gerada deve descrever os serviços baseada puramente no contexto público do negócio.

---

## 4. Otimização de Interface e Layout Mobile (Requisitos PWA/Standalone)

- [ ] **Larguras Mobile:** Toda a interface deve estar contida horizontalmente em telas estreitas (mínimo de 320px), sem scrollbar lateral indesejada e sem cortes de texto nos cabeçalhos e botões.
- [ ] **PWA Standalone (Safe Area Insets):** Testar a aplicação em modo autônomo (Standalone/Adicionado à Tela de Início). O padding superior do header e o inferior do rodapé devem respeitar as variáveis do dispositivo:
  - Header: `calc(env(safe-area-inset-top) + padding base)`
  - Sidebar / Conteúdo de rolagem: Respectivas áreas seguras aplicadas.
- [ ] **Comportamento com Teclado Aberto:** Ao focar na caixa de entrada do chat no celular, a abertura do teclado virtual do sistema operacional (iOS/Android) não deve empurrar ou cortar elementos críticos do header ou sobrepor botões principais.
- [ ] **Rolagem dos CTAs Secundários:** Em telas pequenas, a lista de botões de ações rápidas no topo ou rodapé deve permitir rolagem horizontal suave (`overflow-x-auto` com scrollbar oculta ou estilizada) sem quebrar o grid.
- [ ] **Acessibilidade do Botão "Sair":** O botão de logout ou ação de encerramento de sessão deve estar sempre visível, com área de toque mínima de `44px x 44px` e contraste adequado.
