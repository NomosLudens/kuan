# Guardian Invite & Business Context Linking

## Papéis

- **Admin da plataforma**: usuário com responsabilidade de gestão. Ele cria convites, acompanha Guardiões vinculados, publica/suspende/arquiva presença pública e lê conversas públicas recebidas. Ele não vira Guardião operacional automaticamente.
- **Guardião**: usuário operacional convidado para o módulo Kuan-Yin. É a conta que configura os dados reais do próprio negócio e que fica em `kuanyin_guardians.user_id`.
- **Cliente**: visitante final que abre `/g/:slug` sem login e conversa com a presença pública publicada.

## Convite e vínculo

1. O admin acessa `/kuan/guardioes` e cria um convite Kuan-Yin.
2. O convite continua usando `workspace_invitations` com `modules = ['kuanyin']` e o aceite em `/convite`.
3. Ao aceitar, o sistema cria/atualiza `workspace_members` para registrar que aquela conta é membro do workspace do admin.
4. Para convites Kuan-Yin, o aceite também cria o vínculo operacional mínimo:
   - `business_contexts.user_id = id do Guardião`;
   - `kuanyin_guardians.user_id = id do Guardião`;
   - `kuanyin_guardians.admin_user_id = id do Admin`;
   - `kuanyin_guardians.business_context_id = contexto criado para o Guardião`;
   - `status = 'draft'` até o conteúdo real ser revisado/publicado.

Esse vínculo evita tratar o admin como Guardião e evita criar Guardião solto em `/kuan/config`.

## Quem pode configurar o negócio

A configuração real do negócio pertence ao Guardião operacional. `/kuan/config` localiza primeiro um Guardião por `kuanyin_guardians.user_id = auth.uid()`.

Como compatibilidade administrativa limitada, se a conta logada não for Guardião e gerenciar exatamente um Guardião por `kuanyin_guardians.admin_user_id = auth.uid()`, `/kuan/config` pode editar esse contexto. Se houver mais de um Guardião gerenciado, a tela exige login como Guardião operacional para não escolher silenciosamente o negócio errado.

Conta sem Guardião vinculado recebe erro claro ao salvar: `Nenhum Guardião vinculado a esta conta. Peça um convite ao admin.`

## Como `/kuan/config` salva

O fluxo de gravação não usa `upsert` com `onConflict: 'business_context_id'`, porque o schema atual só garante unicidade em `kuanyin_guardians.public_slug` e não em `business_context_id`.

A ordem é:

1. resolver o Guardião editável por `user_id` ou, de forma limitada, por `admin_user_id`;
2. atualizar/inserir explicitamente o `business_contexts` associado ao Guardião;
3. validar se o `public_slug` não pertence a outro Guardião;
4. atualizar explicitamente o registro existente em `kuanyin_guardians` com `business_context_id`, `public_slug` e `status`.

Assim o salvamento mantém dados reais em `business_contexts`, mantém `kuanyin_guardians.user_id` apontando para a conta operacional correta e não depende de uma constraint que não existe.

## Superfície pública e inbox

- `/g/:slug` resolve o Guardião publicado por `kuanyin_guardians.public_slug` e abre sem login para o Cliente.
- Conversas públicas persistem em `kuanyin_public_chat_threads` e `kuanyin_public_chat_messages` com `guardian_id`, `user_id` e `business_context_id` resolvidos do Guardião.
- `/kuan/inbox` e `/kuan/guardioes` continuam lendo as conversas reais vinculadas aos Guardiões que a conta possui ou administra.

## Pendências explícitas

Comprovante e agendamento continuam pendentes de produto. Este PR não inicia Public Client Actions, não implementa upload de comprovante, não cria agenda pública e não mexe em pagamento real. A razão é manter o fluxo menor possível: primeiro corrigir convite, vínculo e configuração real do negócio; depois, em PR separado, desenhar ações públicas com autorização e integridade próprias.

## Trilha do Guardião: três saídas

A Trilha do Guardião não existe apenas para preencher `business_contexts`. Ela deve gerar três saídas reais e revisáveis:

1. **`business_contexts`** — contexto operacional usado pela Kuan pública no atendimento ao cliente.
2. **`kuanyin_guardians.metadata.guardian_preferences`** — preferências internas do Guardião para venda, atendimento, revisão e publicação.
3. **`kuanyin_guardians.metadata.public_page_blueprint`** — proposta estruturada e segura da página pública ideal.

Neste PR não há tabela nova. `guardian_preferences` e `public_page_blueprint` ficam em `kuanyin_guardians.metadata` para manter o escopo pequeno e reversível.

Estrutura esperada:

```json
{
  "guardian_preferences": {
    "tone_preference": "string",
    "formality_level": "formal | casual | mixed",
    "visual_style": "string",
    "client_style": "string",
    "preferred_cta": "Solicitar esse horário",
    "autonomy_limits": [],
    "must_review": [],
    "avoid_terms": ["Confirmar esse horário"],
    "preferred_jargon": [],
    "notes": "string"
  },
  "public_page_blueprint": {
    "status": "draft | proposed | approved | published",
    "theme": {
      "palette": "string",
      "mood": "string",
      "typography": "string"
    },
    "journey": [
      "chegada",
      "servicos",
      "referencias",
      "agenda",
      "pagamento_pendente",
      "revisao_humana"
    ],
    "sections": [],
    "suggested_copy": {},
    "warnings": [
      "Pedido de agendamento depende de confirmação do Guardião.",
      "Comprovante recebido não é pagamento confirmado."
    ]
  }
}
```

A Kuan propõe a página ideal ao Guardião, mas não publica automaticamente. A proposta de HTML é tratada como blueprint estruturado; a página pública futura deve renderizar componentes seguros a partir dos dados aprovados, não HTML arbitrário gerado por IA.

Fluxo esperado:

Admin convida Guardião → Guardião aceita convite → Guardião conversa com Kuan → Kuan conduz a Trilha do Guardião → Kuan extrai preferências internas → Kuan preenche `business_contexts` → Kuan propõe uma página pública ideal → Guardião revisa → Guardião/Admin aprova publicação.

O modelo visual de referência é uma página mobile conversacional com chegada/pergunta inicial, escolha de serviço/estilo, referências/portfólio, solicitação de horário, pagamento pendente/comprovante e aviso de confirmação humana. O CTA correto é **“Solicitar esse horário”** porque o cliente solicita e o Guardião confirma.

## Convite de Guardião vs link público de Cliente

**Convite de Guardião**:

- é criado em `/kuan/guardioes` pelo Admin da plataforma;
- é destinado a uma pessoa que terá conta operacional;
- passa por `/convite`;
- cria ou atualiza o vínculo `admin_user_id ↔ user_id`;
- gera ou vincula `kuanyin_guardians`;
- deixa o Guardião inicial como `draft` até revisão/publicação.

**Link público de Cliente**:

- é gerado a partir de `kuanyin_guardians.public_slug`;
- aponta para `/g/:guardianSlug`;
- não cria conta;
- não exige login;
- serve para atendimento público;
- permite ao Cliente perguntar, informar dados e solicitar;
- não permite que o Cliente confirme agendamento ou pagamento.

Frase canônica: **Guardião é convidado. Cliente é atendido.**
