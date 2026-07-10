# Kuan PR 2: Lacunas e Limitações Conhecidas

Durante a auditoria e correção do endurecimento da superfície pública para o PR 2, algumas lacunas foram mantidas para respeitar a regra de "nenhuma nova feature e nenhuma migration" imposta no Modo Ponytail.

Abaixo, as lacunas técnicas identificadas:

### 1. Quebra de Link ao alterar Public Slug (`kuan-yin.config.tsx`)
- **Problema**: O arquivo `/kuan-yin/config` permite a alteração do campo `public_slug`. Entretanto, não há um sistema de histórico de aliases nem redirecionamentos (301) para slugs antigos. Se o Guardião já compartilhou seu link `/g/antigo-slug` no Instagram e depois o renomear para `/g/novo-slug`, o link antigo passará a renderizar um erro 404/not found.
- **Impacto**: Usuários finais que clicarem em links antigos não encontrarão a página pública de atendimento.
- **Por que não foi corrigido**: Implementar redirects exigiria uma tabela adicional (`public_slug_aliases`), e possivelmente complexidade extra no router e funções de lookup. Isso violaria a regra de não introduzir novas integrações ou migrations neste PR.
- **Ação Futura**: Recomendado para um PR focado em *SEO & Link Persistence*, introduzindo um ledger imutável de aliases.

### 2. Ocultação do Pix Público
- **Problema**: O campo `pix_chave` foi categoricamente removido da *whitelist* pública de `getGuardianPublicPage` e omitido do contexto do LLM em `sendGuardianPublicMessage`. Atualmente, o cliente não consegue ver a chave via frontend para pagamentos sem passar pelo processo de `payment.proof`.
- **Impacto**: O cliente não terá acesso à chave pix do Guardião ao pedir valores.
- **Por que não foi corrigido**: Não há decisão de design/produto documentada atestando se a chave deve ser pública (o que expõe os dados bancários/CPF ao acesso irrestrito, sujeito a scraping) ou revelada somente após o pedido formal na interface. Preferimos pecar pelo excesso de restrição e não vazar este dado.
- **Ação Futura**: Um PR focado na *Fase 3: Fluxo de Pagamento* deve decidir como revelar as chaves transacionais com segurança (ex: gerar QRCodes on-demand via provedor de pagamentos, ou emitir apenas em um componente *Server Component* no momento exato do checkout).
