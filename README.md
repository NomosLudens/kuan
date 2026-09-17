<p align="center">
  <img src="./public/brand-assets/kuanyin-avatar.png" width="112" alt="Kuan-Yin" />
</p>

<h1 align="center">Kuan</h1>

<p align="center"><strong>Empower, not replace.</strong></p>

<p align="center">
  Automação comercial que amplia a capacidade do Guardião<br />
  sem esconder onde a autoridade humana permanece.
</p>

<p align="center">
  <a href="#por-que-kuan">Por quê</a> ·
  <a href="#o-que-o-kuan-faz">Produto</a> ·
  <a href="#onde-a-autoridade-vive">Autoridade</a> ·
  <a href="./EMPOWER_NOT_REPLACE.md">Princípios</a> ·
  <a href="./LICENSE">Licença</a>
</p>

---

> **IA pode assistir. Automação pode executar. O Guardião decide.**

Kuan é a superfície comercial da Nomos Ludens para atendimento, agendamento, orçamentos, pagamentos e operação assistida por inteligência artificial.

A proposta não é retirar a pessoa da operação. É reduzir atrito, organizar contexto e automatizar etapas delimitadas enquanto a autoridade final continua explícita.

## Por que Kuan

Sistemas comerciais automatizados tendem a misturar três coisas diferentes: **solicitação**, **execução automática** e **decisão humana**.

Kuan trata essa separação como parte do produto.

Um cliente pode solicitar um horário. O sistema pode organizar disponibilidade, detectar conflitos e preparar a operação. Mas uma solicitação não vira confirmação humana apenas porque um fluxo automático avançou.

Essa distinção orienta agenda, atendimento, pagamentos, isolamento entre contextos de negócio e transições de estado.

## O que o Kuan faz

- **Atendimento assistido por IA** para organizar contexto e apoiar a operação comercial.
- **Agendamentos e disponibilidade** com tratamento explícito de fuso horário e conflitos.
- **Orçamentos e serviços** configurados pelo Guardião.
- **Pagamentos e comprovantes** com estados controlados e verificáveis.
- **Isolamento por contexto de negócio** para impedir cruzamento indevido entre recursos.
- **Privacidade pública** com consentimento explícito e possibilidade de limpeza de dados locais.

## Onde a autoridade vive

| Camada | Pode fazer | Não substitui |
|---|---|---|
| **Kuan / IA** | atender, organizar contexto, sugerir, automatizar etapas delimitadas | decisão final do Guardião |
| **Guardião** | definir regras, preços e serviços; confirmar, cancelar, rejeitar e intervir | — |
| **Cliente** | consultar, solicitar, enviar dados e comprovantes | confirmação operacional |
| **Sistema** | aplicar invariantes, isolamento, regras temporais e transições válidas | julgamento humano |

A regra canônica é simples:

> **solicitação não é confirmação até a intervenção e decisão humana do Guardião.**

## Integridade operacional

O Kuan trata segurança e estado como parte da experiência, não como detalhe invisível de backend.

### Autorização de plataforma

Operações administrativas e fluxos de convite usam validações específicas e hosts canônicos.

### Temporalidade

O sistema trabalha com fuso horário explícito — `America/Sao_Paulo` por padrão — e valida conflitos a partir de intervalos temporais consistentes.

### Isolamento de recursos

Guardiões acessam apenas os contextos de negócio, clientes, ordens e compromissos pertencentes ao seu próprio espaço operacional.

### Transições de estado

Agendamentos, ordens e pagamentos usam estados controlados e verificações do estado anterior para evitar transições concorrentes inválidas.

### Privacidade

O fluxo público diferencia dados necessários para operação, persistência local consentida e identificação anônima quando aplicável.

## O que este repositório é

Este repositório é a **vitrine pública canônica do Kuan**.

Ele apresenta propósito, superfícies, princípios, arquitetura e uma amostra real do trabalho. Não constitui uma instalação pública nem autorização para operar os serviços internos do Kuan.

## Princípio Nomos Ludens

Kuan é a primeira aplicação pública do princípio institucional:

> **Empower, not replace.**  
> Tecnologia deve ampliar a capacidade humana sem tornar invisíveis autoria, julgamento, responsabilidade ou autoridade.

[Leia o princípio completo →](./EMPOWER_NOT_REPLACE.md)

## Atribuição e licença

Este repositório pode ser usado, estudado, adaptado e redistribuído, inclusive em projetos comerciais, desde que a fonte seja citada de forma visível:

**Kuan, por Nomos Ludens — [github.com/NomosLudens/kuan](https://github.com/NomosLudens/kuan)**

O código é disponibilizado sob a [Common Public Attribution License 1.0 (CPAL-1.0)](./LICENSE).

Marcas, logotipos, nomes, textos, imagens e materiais de terceiros podem estar sujeitos a direitos e condições próprios; a licença do código não transfere esses direitos. Dependências de terceiros permanecem sujeitas às respectivas licenças.

---

### Nomos Ludens

**Technology for human agency.**  
**Empower, not replace.**
