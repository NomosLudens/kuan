# QA Checklist — Guardian Availability Rules & Public Slot Guardrails

Este documento descreve os fluxos de teste manuais e automatizados para validar as regras de disponibilidade do Guardião e as barreiras de proteção para solicitação de horários públicos introduzidas no PR #29.

---

## 1. Fluxo de Configuração de Regras (/kuan/config)

### Cenário 1.1: Visualização do Painel de Configuração

- [ ] Acessar `/kuan/config` como Guardião logado.
- [ ] Certificar-se de que a nova seção **"Regras de Disponibilidade"** está visível.
- [ ] Validar que os dias da semana atuais, horários de início/fim, antecedência mínima e mensagens customizadas são exibidos corretamente de acordo com o estado do banco.

### Cenário 1.2: Edição e Persistência de Regras

- [ ] Alterar os dias de atendimento (ex: desmarcar Segunda-feira, marcar Sábado).
- [ ] Ajustar o horário de início para `10:00` e término para `17:00`.
- [ ] Configurar a antecedência mínima para `48h`.
- [ ] Adicionar uma nota pública: _"Atendimento presencial no consultório principal."_
- [ ] Definir uma mensagem de indisponibilidade customizada: _"Por favor, selecione outro horário comercial."_
- [ ] Clicar em **"Salvar Configurações"**.
- [ ] Validar que a notificação de sucesso é exibida e que a página recarrega os novos valores salvos corretamente.

---

## 2. Página Pública (/g/:guardianSlug)

### Cenário 2.1: Exibição do Resumo de Disponibilidade

- [ ] Acessar a página pública de um Guardião (ex: `/g/marcos-silva`).
- [ ] Rolar até a seção de agendamento.
- [ ] Verificar que o texto descritivo elegante contendo o resumo das regras ativas (ex: _"Atendimento de segunda a sexta, das 09:00 às 18:00. Solicite com pelo menos 24h de antecedência."_) é exibido perfeitamente sob a descrição.

### Cenário 2.2: Solicitação dentro das Regras (Sucesso)

- [ ] Escolher um dia e horário que atenda perfeitamente aos critérios de disponibilidade (ex: uma quarta-feira às `14:00`, respeitando as horas de antecedência mínima).
- [ ] Preencher nome, e-mail, telefone e observações.
- [ ] Clicar em **"Solicitar Horário"**.
- [ ] Validar que o fluxo de submissão ocorre com sucesso e a mensagem canônica é exibida:
  > **"Solicitação recebida. O Guardião precisa confirmar antes de o horário estar reservado."**
- [ ] Validar que o agendamento foi salvo no banco de dados com o status `proposed`.

### Cenário 2.3: Tentativa em Horário Passado (Bloqueio)

- [ ] Tentar selecionar ou submeter um horário no passado.
- [ ] Validar que o sistema exibe o alerta:
  > **"Esse horário já passou. Escolha uma data futura."**

### Cenário 2.4: Tentativa sem Antecedência Mínima (Bloqueio)

- [ ] Tentar selecionar ou submeter um horário para daqui a 2 horas, quando a regra exige 24h.
- [ ] Validar que o sistema exibe o alerta:
  > **"Esse horário está muito próximo. Escolha outro horário respeitando a antecedência mínima do Guardião."**

### Cenário 2.5: Tentativa Fora dos Dias/Horários Permitidos (Bloqueio)

- [ ] Tentar selecionar ou submeter um horário fora dos dias permitidos (ex: Sábado quando configurado Seg-Sex) ou fora das horas permitidas (ex: `21:00`).
- [ ] Validar que o sistema exibe a mensagem de indisponibilidade do Guardião (ou a customizada configurada por ele).

---

## 3. Agenda Interna (/kuan/agendamentos)

### Cenário 3.1: Card de Regras Ativas

- [ ] Acessar o dashboard `/kuan/agendamentos`.
- [ ] Validar que um banner elegante é renderizado logo abaixo do cabeçalho da página resumindo as regras ativas de agendamento.
- [ ] Clicar no link _"Configurar Regras"_ no banner e garantir que ele redireciona perfeitamente para `/kuan/config`.

### Cenário 3.2: Agendamento Manual Direto (Sem bloqueio público)

- [ ] No dashboard `/kuan/agendamentos`, clicar em **"Novo Agendamento"**.
- [ ] Validar que o texto explicativo do formulário diz:
  > _"Crie um agendamento direto. Ele nascerá como confirmado na Agenda do Guardião."_
- [ ] Preencher um horário qualquer (mesmo fora das regras de disponibilidade pública, por ser uma criação administrativa direta do Guardião).
- [ ] Enviar o formulário.
- [ ] Validar que o agendamento é criado imediatamente com status `confirmed` e sem erros de restrição pública.

---

## 4. Testes Automatizados

Para garantir que não haja regressões nas regras centrais, execute a suíte de testes:

```bash
npm run test
```

A suíte cobre:

- Normalização de regras estruturadas e legadas em `normalizeAvailabilityRules`.
- Validações de limites de horário e dias em `isWithinAvailabilityRules`.
- Regras de antecedência e passado em `isPastOrTooSoon`.
- Geração de mensagens canônicas e amigáveis em `getAvailabilityViolationMessage`.
