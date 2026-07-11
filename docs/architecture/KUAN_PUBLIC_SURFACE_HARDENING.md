# Kuan Public Surface Hardening

## Objetivo

Endurecer a superfície pública `/g/$guardianId` e corrigir a identidade operacional da Kuan-Yin.

## Identidade corrigida

A Kuan-Yin neste repositório não é mais tratada como a "Kaline pessoal" ou uma "faceta comercial" que atende sob a identidade da Kaline. Ela é um app comercial próprio. O prompt do sistema foi atualizado para instruir o LLM de que ele é a **presença comercial do Guardião** no app Kuan-Yin, e que ele não é a Kaline pessoal, tampouco a Klio, e que não deve executar ações sensíveis sem confirmação humana.

## Whitelist pública

A função `getGuardianPublicPage` implementa um payload rígido contendo exclusivamente os campos essenciais para o carregamento do frontend:

- slug
- name
- type
- tone
- services
- prices
- paymentMethods
- scheduleRules
- notes
- canonicalPath

## Campos proibidos

Foi banido o vazamento dos seguintes campos na superfície pública:

- user_id;
- ids técnicos desnecessários (como id da tabela de guardian e businessContextId);
- tokens;
- clientes;
- pagamentos privados;
- logs;
- limites_decisao;
- regras_escalonamento;
- objeto bruto do banco.

_Nota:_ O campo `pixKey` foi removido e também deve ser considerado proibido no estado atual, até que se forme uma decisão se essa chave pode ser exposta livremente ou apenas no momento do pagamento confirmado, protegendo a privacidade bancária do Guardião.

## Regras duras

- Cliente não executa ação administrativa.
- Pedido de agendamento não é agendamento confirmado (estado "proposed").
- Comprovante recebido não é pagamento confirmado (estado "received_proof").
- Guardião confirma ação sensível.
- Sem mock: Nada de valores temporários, arrays vazios falsos ou setTimeout para fingir latência/loading; os hooks carregam dados ou retornam erro real do Supabase.
- Sem dashboard falso.

## Funções públicas auditadas

Lista de funções auditadas em `src/lib/kuanyin-public.functions.ts` e seu estado de hardening:

- **getGuardianPublicPage**: Restrita à whitelist, omitindo IDs internos, status de backend e chaves.
- **getGuardianPublicConversation**: Recuperação de thread correta, dependente de keys e rate limits em memória.
- **sendGuardianPublicMessage**: Atualizada para omitir `pixKey` (`pix_chave`) da string literal injetada via LLM (business context block) caso seja chamada pela API pública. Impede vazamento indireto.
- **requestGuardianAppointment**: Usa o `findOrCreatePublicClient` com salvamento real (estado prospect) e appointment em "proposed". Mantém honeypots.
- **requestGuardianOrder**: Segue o protocolo de prospect client, order proposed e limit rate.
- **submitGuardianPublicProof**: Não liquida ordens; lança proof com status restrito pendente e vincula ao cliente encontrado.

## Lacunas conhecidas

Existem lacunas não corrigidas neste PR devido às restrições operacionais da arquitetura (não adicionar novas tabelas e nem criar features). Veja `docs/architecture/KUAN_PR2_GAPS.md` para os detalhes completos de risco e próximos passos.
