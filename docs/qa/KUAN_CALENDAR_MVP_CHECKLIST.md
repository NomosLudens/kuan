# KUAN_CALENDAR_MVP_CHECKLIST.md

Checklist de controle de qualidade (QA) para validação do Guardian Calendar MVP e a revisão de agendamentos.

---

## 1. Fluxo de Solicitação Pública de Horário

- [ ] Acessar a página pública de um guardião `/g/:guardianSlug` (ou `/g/$guardianId`).
- [ ] Preencher o formulário de agendamento de horário informando os dados obrigatórios (Nome, Serviço e Data/Hora).
- [ ] Enviar a solicitação.
- [ ] **Critério de Aceitação (Copywriting)**:
  - O alerta de sucesso deve exibir exatamente a seguinte mensagem:
    `"Solicitação de horário recebida. O Guardião precisa confirmar antes de o horário estar reservado."`
  - Nenhuma mensagem ou prompt de resposta automática de chat do visitante ou do assistente deve sugerir que o horário foi reservado ou confirmado automaticamente.

---

## 2. Garantia de que o Cliente Não Confirma

- [ ] Confirmar que, no banco de dados (`kuanyin_appointments`), as solicitações de horários recebidas via página pública nascem estritamente com o status `proposed`.
- [ ] Verificar que não há nenhum gatilho de auto-confirmação habilitado no fluxo público ou nos resolvedores de intenção conversational.

---

## 3. Decisão do Guardião (Confirmar/Rejeitar)

- [ ] Acessar o ambiente autenticado do Guardião.
- [ ] Visualizar o item pendente na Agenda (`/kuan/agendamentos`) ou no Centro de Revisão (`/kuan/revisao`).
- [ ] **Ação de Confirmação**:
  - Clicar em **Confirmar** no item pendente.
  - Verificar se o status transiciona corretamente de `proposed` para `confirmed`.
  - Confirmar que a mensagem de feedback postada no chat público associado é exatamente:
    `"Horário confirmado pelo Guardião."`
- [ ] **Ação de Rejeição**:
  - Criar um novo agendamento público de teste.
  - Clicar em **Rejeitar** no item.
  - Verificar se o status transiciona corretamente para `rejected`.
  - Confirmar que a mensagem de feedback postada no chat público associado é exatamente:
    `"Solicitação rejeitada pelo Guardião."`

---

## 4. Visualização e Gestão na Agenda

- [ ] Acessar `/kuan/agendamentos` sob um perfil autenticado.
- [ ] Confirmar que o painel exibe contadores corretos:
  - **Pendentes** (agendamentos em estado `proposed`).
  - **Confirmados Hoje** (agendamentos confirmados cuja data de início seja o dia corrente).
  - **Próximos 7 Dias** (todos os agendamentos nos próximos 7 dias).
- [ ] Testar os chips/tabs de filtro rápido (Hoje, Próximos 7 Dias, Pendentes, Confirmados, Todos) e certificar que a filtragem reage instantaneamente sem recarregar a página.
- [ ] Garantir que agendamentos confirmados mostram botões para:
  - **Concluir** (transiciona para `completed`).
  - **Cancelar** (transiciona para `cancelled`).
  - **Copiar Resumo** (copia a ficha de dados para a área de transferência).
  - **Baixar .ics** (gera arquivo iCal client-side válido).

---

## 5. Agendamento Manual do Guardião

- [ ] Na Agenda, clicar em **Novo Agendamento**.
- [ ] Preencher o formulário informando nome, serviço, data/hora e observações.
- [ ] **Critério de Aceitação**:
  - O agendamento manual deve nascer diretamente com o status `confirmed` (pois foi criado ativamente pelo próprio Guardião).
  - O sistema deve tentar deduplicar o cliente na tabela `kuanyin_clients` procurando por e-mail ou telefone antes de criar um novo perfil.
  - A mensagem descritiva do modal deve ser estritamente:
    `"Crie um agendamento direto. Ele nascerá como confirmado na Agenda do Guardião."`
  - Nenhuma promessa de sincronização automática com calendários externos é vendida ao usuário final na UI.

---

## 6. Integridade de Rotas e Segurança de Acesso

- [ ] **Rotas Públicas**:
  - Validar que a rota de agendamento do guardião `/g/:guardianSlug` (ou `/g/$guardianId`) continua perfeitamente pública e acessível sem qualquer sessão iniciada.
- [ ] **Rotas Autenticadas**:
  - Validar que qualquer tentativa de acessar sub-rotas sob `/kuan/*` (ex: `/kuan/agendamentos`, `/kuan/revisao`) sem autenticação válida redireciona o usuário para o fluxo de login de forma segura.

---

## 7. Não-Regressão do Fluxo de Convites (PR #27)

- [ ] Acessar `/convite?token=...` ou simular o fluxo de convites para garantir que os mecanismos de proteção implementados no PR #27 (como limite de taxa de requisições, proteção contra redirecionamentos abertos, e isolamento de sessão) continuam 100% íntegros e funcionais.
- [ ] Executar a suíte de testes de convite:
      `bun test src/lib/invite-security.test.ts`
      E verificar que todos os testes de segurança passam com sucesso.
