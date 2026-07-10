# PR 5 Gaps (Guardian Inbox)

Esta documentação lista as lacunas reais presentes na implementação da Caixa de Entrada do Guardião, deliberadamente mantidas pelo escopo do "Modo Ponytail".

## 1. Identificação Estrutural de Resposta Manual vs Automática

A tabela `kuanyin_public_chat_messages` **não possui uma coluna de `metadata`** e seu schema restringe o campo `role` a valores mapeados globalmente sem segmentação explícita de "quem ou o quê" respondeu por trás do papel (AI vs Humano).

Por conta disso, as respostas manuais do Guardião enviadas via `/kuan-yin/inbox` estão sendo gravadas utilizando o role `"kuanyin"` (o mesmo role usado pela Inteligência Artificial). 
Não é possível, olhando exclusivamente para os dados inseridos, diferenciar com rigor absoluto o que foi respondido pela IA do que foi respondido manualmente pelo Guardião nesta iteração. Não criamos uma migration para contornar isso (como a adição de `metadata: { source: "manual" }`) em obediência às regras de contenção de escopo.

## 2. Limitações de Operação e Experiência

- Não há notificação push/email/WhatsApp de novas mensagens no chat público.
- Não há SLA/tempo médio de resposta no inbox.
- Não há suporte a anexos ou troca de áudios no chat manual.
- Não há marcação/label (ex.: `urgente`, `pagamento`).
- Não há busca textual nas conversas, apenas ordenação temporal.
- Não há múltiplos atendentes (o Inbox assume a identidade do Guardião da conta primária logada).
