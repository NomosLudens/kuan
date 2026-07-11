# Kuan Demo Checklist — PR #26 (QA & Sellable Package)

Este guia serve como roteiro oficial para homologação, demonstração interna e validação comercial da plataforma **Kuan** em ambientes de staging e produção. Ele cobre a preparação do cenário, os fluxos do cliente final e do Guardião, o uso do showroom para experimentação visual, técnicas de vendas recomendadas e o plano de contingência (rollback).

---

## 📋 1. Preparação do Cenário

Antes de iniciar qualquer demonstração ou validação, certifique-se de que os seguintes pré-requisitos estão cumpridos:

### Requisitos Técnicos
- [ ] Banco de dados Supabase conectado e migrações aplicadas.
- [ ] Usuário **Admin** e pelo menos um **Guardião** criados/autenticados em `/auth`.
- [ ] Build de produção testado e sem falhas de linter ou de compilação do TypeScript (`bun run lint && bun run typecheck && bun run build`).

### Configuração Inicial da Presença Pública (Guardião)
1. Acesse o painel autenticado em `/kuan` com uma conta de Guardião.
2. Navegue até **Configurar** (`/kuan/config`) ou use o onboarding.
3. Preencha os detalhes mínimos exigidos para uma presença comercial sólida:
   - Nome do Negócio (ex: *Kuan Cuidados Holísticos*)
   - Slug Pública (ex: `cuidados-kuan`)
   - Serviços prestados, faixas de preços e chave Pix.
4. Mude o status do Guardião para **Publicado** na Central de Guardiões (`/kuan/guardioes`).

---

## 👥 2. Fluxo do Cliente Público (Visitor Journey)

Este fluxo simula a jornada de um cliente final (sem login) que entra em contato através do link público.

- [ ] **Acesso:** Abra uma janela anônima do navegador e acesse a URL pública: `/g/cuidados-kuan`.
- [ ] **Análise de Dados:** Verifique se as informações de Serviços, Preços, Formas de Pagamento e Agenda inseridas pelo Guardião na etapa de preparação aparecem de forma organizada na tela.
- [ ] **Segurança de Expectativa (Aviso de Pendência):** Verifique se o banner de aviso em destaque está visível: *"Pedidos, agendamentos e pagamentos dependem de aprovação e confirmação manual do Guardião. O envio de comprovante indica apenas solicitação em análise."*
- [ ] **Chat com Kuan-Yin:** Envie uma mensagem livre no chat (ex: *"Vocês aceitam Pix?"* ou *"Quero saber os horários"*). A inteligência integrada responderá de acordo com as regras de governança e audiência comercial (sem desviar de assunto ou sofrer injeção de prompts).
- [ ] **Solicitação de Agendamento:**
  1. Clique em **📅 Agendar Horário**.
  2. Preencha o formulário (Nome, Telefone, Serviço, Data/Hora).
  3. Envie e verifique se a mensagem exibida confirma o estado não-vinculativo: *"Solicitação de agendamento enviada! Ela está pendente de aprovação pelo Guardião."*
- [ ] **Solicitação de Orçamento:**
  1. Clique em **📝 Pedir Orçamento**.
  2. Preencha a descrição do pedido e os dados de contato.
  3. Envie e verifique o feedback seguro: *"Solicitação de orçamento registrada! Ela está pendente de revisão."*
- [ ] **Envio de Comprovante de Pagamento:**
  1. Clique em **💵 Enviar Comprovante**.
  2. Preencha o valor, forma (ex: Pix) e ID da transação.
  3. Envie e certifique-se do texto explícito: *"Recebi as informações do comprovante e deixei registrado para conferência do Guardião. Isso ainda não confirma o pagamento."*
- [ ] **Registro de Contato:**
  1. Clique em **📞 Deixar Contato**.
  2. Preencha Nome, Telefone e E-mail.
  3. Envie e valide a resposta: *"Recebi seu contato e deixei registrado nesta conversa para o Guardião revisar."*

---

## 🛡️ 3. Fluxo do Guardião (Commercial Review)

Este fluxo valida o lado operacional, onde o Guardião gerencia o negócio e decide sobre as solicitações pendentes do cliente final.

- [ ] **Acesso ao Painel:** Volte para a aba do navegador autenticada como Guardião e acesse `/kuan`.
- [ ] **Caixa de Entrada:** Vá em **Atendimentos** (`/kuan/inbox`) e encontre a thread de conversa correspondente ao cliente anônimo da etapa anterior. Verifique se as mensagens enviadas no chat público aparecem de forma sincronizada.
- [ ] **Central de Revisão:** Acesse a **Central de Revisão** (`/kuan/revisao`) para analisar as ações geradas de forma não-automatizada pelas solicitações do cliente:
  - [ ] **Validar Agendamento:** Clique em **Confirmar** ou **Rejeitar** na solicitação de agendamento correspondente.
  - [ ] **Validar Pedido/Orçamento:** Clique em **Confirmar** ou **Rejeitar** no pedido proposto.
  - [ ] **Validar Comprovante:** Clique em **Confirmar** ou **Rejeitar** no comprovante enviado.
- [ ] **Sincronismo de Tela:** Verifique se as solicitações saem da lista de pendências da Central de Revisão imediatamente após serem resolvidas, e se os botões correspondentes são desativados durante o envio para evitar disparos duplos.
- [ ] **Portal Público do Cliente:** O cliente final que fez a solicitação pode acessar o link único de portal enviado para visualizar as atualizações (como o status alterado de *pending* para *confirmed* pelo Guardião), validando o fluxo de ponta a ponta sem necessidade de criar conta no sistema.

---

## 🌐 4. Showroom e Rascunho Interativo (HTML Sandbox)

Validação do mostruário estático e experimentação visual para novos layouts comerciais.

- [ ] **Acesso:** Acesse o painel autenticado e clique em **Showroom** (`/kuan/showroom`).
- [ ] **Aba Mostruário Oficial:** Verifique se o iframe do mostruário vivo carrega a página estática global de demonstração corretamente.
- [ ] **Aba Rascunho HTML (Sandbox):**
  1. Clique na aba **Rascunho HTML**.
  2. Verifique a presença do banner em destaque: *"Este HTML é um rascunho visual. Ele ainda não está publicado na página pública."*
  3. Clique em **Inserir HTML** e cole um código básico de exemplo (ex: `<h1>Minha nova presença</h1><p>Teste</p>`).
  4. Clique em **Usar este HTML** e certifique-se de que a visualização é atualizada dentro do iframe sandboxing.
  5. Recarregue a página e verifique se o rascunho permanece salvo no navegador através da persistência em `localStorage`.
  6. Teste os botões **Importar .html**, **Exportar HTML** e **Limpar rascunho** para garantir isolamento e integridade de arquivo.

---

## 💬 5. Frases de Venda Recomendadas (Pitch Comercial)

Frases de impacto prontas para uso em apresentações comerciais e pitches para novos clientes (Guardióes) interessados na plataforma:

> *"Com o Kuan, você transforma conversas informais em propostas de negócio estruturadas de forma automática, mas mantém o controle absoluto de cada aprovação e fechamento."*

> *"Diga adeus à perda de dados em históricos de chat bagunçados. Deixe que a inteligência comercial da Kuan-Yin qualifique o interesse do seu cliente enquanto você foca exclusivamente em entregar valor."*

> *"Sua presença comercial na internet ativa em menos de 5 minutos, integrada a uma central de revisão intuitiva e um assistente digital focado única e exclusivamente no seu cardápio de serviços."*

> *"Mantenha sua integridade e profissionalismo: o Kuan protege sua marca contra conteúdos inapropriados e tentativas de engenharia social, garantindo um canal de atendimento sempre elegante."*

---

## ⏪ 6. Plano de Contingência (Rollback)

Se durante a homologação ocorrerem instabilidades graves na camada de persistência (Supabase) ou no motor de inferência da assistente, siga o plano abaixo para restabelecer a operação saudável dos ambientes:

### Passos de Restauração de Código
1. Identifique o último commit estável conhecido (marcado com a entrega do PR #25).
2. Se necessário, reverta a branch atual no Git local ou na nuvem:
   ```bash
   git reset --hard origin/main
   ```
3. Para restaurar modificações locais de estilo ou layout indesejadas que violaram as regras de lint:
   ```bash
   git restore src/routes/_authenticated/kuan.agendamentos.tsx \
               src/routes/_authenticated/kuan.clientes.tsx \
               src/routes/_authenticated/kuan.guardioes.tsx \
               src/routes/_authenticated/kuan.pagamentos.tsx \
               src/routes/_authenticated/kuan.pedidos.tsx
   ```

### Isolamento de Falhas de Terceiros (Supabase & LLM)
- Se a API de IA falhar ou exceder limites de quota de tokens, oriente o Guardião a gerenciar as transações exclusivamente pela interface administrativa da **Central de Revisão** (`/kuan/revisao`) e pelos portais estáticos do cliente final (`/portal/:token`), que funcionam independentemente da inteligência artificial active no chat de conversas.
- Se o banco de dados Supabase sofrer indisponibilidade temporária, as visões públicas do cliente avisarão de forma amigável sobre instabilidade de rede via mensagens salvas nos componentes de erro (`RouteErrorBoundary`), sem revelar credenciais ou stack traces sensíveis.
