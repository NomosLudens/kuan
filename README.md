# Kuan-Yin — Canonical Identity, Security & Operations

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

© 2026 Nomos Ludens.

É permitido usar, estudar, adaptar e redistribuir o conteúdo deste repositório, inclusive em projetos próprios ou comerciais, desde que a fonte seja citada de forma visível e o repositório original seja vinculado:

> Kuan, por Nomos Ludens — https://github.com/NomosLudens/kuan

Essa atribuição deve permanecer em cópias, forks, demonstrações e derivados substancialmente baseados neste material. A permissão não transfere a titularidade das marcas Kuan/Kuan-Yin, logotipos, nomes, textos, imagens ou outros materiais identificados como pertencentes a terceiros; esses elementos permanecem sujeitos às suas próprias condições de uso.

Dependências de terceiros permanecem sujeitas às respectivas licenças. O material é fornecido sem garantia de funcionamento, adequação ou suporte.
