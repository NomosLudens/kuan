# Kuan-Yin — Canonical Identity, Security & Operations

> **Atribuição obrigatória:** este repositório pode ser usado, estudado, adaptado e redistribuído, inclusive em projetos comerciais, desde que a fonte seja citada de forma visível: **Kuan, por Nomos Ludens — [github.com/NomosLudens/kuan](https://github.com/NomosLudens/kuan)**. Consulte a [licença CPAL-1.0](./LICENSE).

Kuan-Yin é a solução comercial canônica integrada à plataforma para gerenciamento de atendimento, agendamento de horários, pedidos de orçamentos, confirmações de pagamentos e operação automatizada com inteligência artificial.

## Objetivo deste repositório

Este repositório existe como vitrine pública do Kuan: apresenta seu propósito, sua experiência, suas superfícies e os princípios que orientam o produto. O código, as telas e a documentação aqui presentes são uma amostra do trabalho e não constituem uma instalação pública ou uma autorização para operar os serviços do Kuan.

## Arquitetura de Papéis (Regra Canônica)

- **Administrador**: Gerencia Guardiões, analisa convites e monitora a governança global do sistema.
- **Guardião**: Configura as regras de atendimento, gerencia sua agenda, define serviços/preços, atende os clientes e toma decisões finais (confirma ou cancela).
- **Cliente Público**: Interage de forma anônima ou identificada, consulta preços, solicita agendamentos/pedidos de orçamento e envia comprovantes de pagamento.

---

## Funcionalidades e Escopo do PR #31

Este repositório consolidou a infraestrutura de integridade, isolamento e fuso horário para o Kuan-Yin comercial:

1. **Segurança de Autorização de Plataforma (Admin Security)**:
   - Validações rígidas em rotas e operações administrativas com middlewares TanStack dedicados.
   - Proteção de links de convite e URLs de redirecionamento utilizando hosts canônicos.

2. **Temporalidade e Calendário Resiliente (Timezone Enforcement)**:
   - Mecanismo nativo e robusto de gerenciamento de fuso horário (`America/Sao_Paulo` por padrão).
   - Validação estrita de conflitos baseada em intervalos temporais calculados e indexados de forma isolada por contexto de negócio.
   - Formatação e exportação segura de arquivos ICS para agendas externas.

3. **Garantia de Isolamento de Recursos (Workspace Isolation)**:
   - Filtros profundos garantindo que Guardiões tenham acesso estritamente aos seus próprios contextos de negócio, clientes, ordens e compromissos.

4. **Transições de Estado Comerciais Concorrentes (Strict State Transitions)**:
   - Salvaguardas em todas as alterações de estados de agendamentos, ordens e pagamentos utilizando verificações otimistas de estado anterior.

5. **Privacidade Pública & Transparência**:
   - Mecanismos de consentimento explícito para cookies/localStorage, opção de limpeza de dados e identificação anônima única via `crypto.randomUUID()`.
   - Copy de comunicação claro: solicitações não são confirmações até a intervenção e decisão humana do Guardião.

## Aviso autoral e licença

© 2026 Nomos Ludens. O código deste repositório é disponibilizado sob a [Common Public Attribution License 1.0 (CPAL-1.0)](./LICENSE). Em cópias, forks, demonstrações e derivados, mantenha o aviso de copyright e a atribuição visível indicada no início deste README, incluindo o link para o repositório original.

Marcas, logotipos, nomes, textos, imagens e materiais de terceiros podem estar sujeitos a direitos e condições próprios; a licença do código não transfere esses direitos. Dependências de terceiros permanecem sujeitas às respectivas licenças.
