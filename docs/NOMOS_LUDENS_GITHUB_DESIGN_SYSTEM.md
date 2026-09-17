# Nomos Ludens — GitHub Design System v1

> **Positioning:** Technology for human agency.  
> **Principle:** **Empower, not replace.**

This document defines the editorial and visual grammar for Nomos Ludens repositories on GitHub. It is intentionally GitHub-native: typography, hierarchy and spacing do most of the work; imagery is used as evidence or orientation, not decoration.

---

## 1. Design intent

Nomos Ludens should look **editorial + technical**, not like a generic AI startup.

The identity is built around a tension:

- **Nomos** → structure, rule, explicit authority, verifiability;
- **Ludens** → play, experimentation, creative agency, invention.

The result should feel precise without becoming sterile, and distinctive without becoming ornamental.

### Primary message

> **Technology should extend what people can create, understand, operate and decide — without hiding where human authority lives.**

---

## 2. Above-the-fold formula

Every flagship repository should communicate five things before the first major scroll:

1. **mark / product identity**
2. **product name**
3. **one strong claim**
4. **one sentence explaining the relation with the user**
5. **3–5 navigation links**

Canonical structure:

```html
<p align="center">
  <img src="<mark>" width="112" alt="<product> mark" />
</p>

<h1 align="center"><PRODUCT></h1>

<p align="center"><strong>Empower, not replace.</strong></p>

<p align="center">
  <one-sentence product relation>
</p>

<p align="center">
  <a href="#why">Why</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="./EMPOWER_NOT_REPLACE.md">Principles</a> ·
  <a href="./LICENSE">License</a>
</p>
```

### Rule

**No badge wall above the fold.**

Build, test, package and license badges belong near technical sections if they materially help evaluation.

---

## 3. Visual grammar

### Typography

Use GitHub-native typography. Do not fight the platform with custom font hacks.

Hierarchy should come from:

- short headings;
- strong opening sentences;
- whitespace;
- horizontal rules;
- concise tables;
- callouts;
- diagrams only where they explain authority or flow.

### Color

README content must survive both GitHub light and dark themes.

Therefore:

- no hard-coded colored text as a core identity device;
- avoid screenshots whose information disappears in dark mode;
- use transparent-background marks;
- when a hero is introduced, provide light/dark variants with `<picture>`;
- reserve one accent color per product inside images, not in Markdown chrome.

### Image policy

Images must do one of four jobs:

1. establish identity;
2. demonstrate the product;
3. explain a system relationship;
4. provide proof of real operation.

If an image does none of these, omit it.

Recommended sizes:

| Asset | Size / ratio | Notes |
|---|---:|---|
| Product mark | 256×256 or larger | transparent PNG/SVG |
| README mark render | 96–128 px | centered |
| Wordmark | ~4:1 | transparent |
| Hero | 1600×720 | provide light/dark when needed |
| Screenshot | ≥1440 px wide | crop to the claim being demonstrated |
| Diagram | 1600×900 max | readable on mobile |

### Avoid

- neon AI gradients;
- brains + circuits;
- humanoid robots;
- decorative cyberpunk motifs;
- walls of stack logos;
- screenshots used only to fill space.

Nomos Ludens should not visually identify itself with “AI” as an industry category.

---

## 4. Content architecture for project READMEs

Flagship repositories should converge on this sequence:

### 1. Identity

Product mark + name + claim + navigation.

### 2. Why this exists

A short statement of the human or operational problem.

### 3. What it does

3–6 concrete capabilities. Avoid exhaustive feature dumps.

### 4. Where authority lives

A project-specific statement explaining who/what may suggest, execute, approve, override and decide.

This is the most distinctive Nomos Ludens component.

Recommended pattern:

| Layer | May do | Does not own |
|---|---|---|
| Automation / AI | suggest, organize, execute bounded steps | final authority |
| Human role | approve, reject, override, define intent | — |
| System | enforce invariants, record state, expose evidence | human judgment |

### 5. Proof

Show one or more of:

- screenshot;
- operational smoke result;
- deterministic output;
- architecture diagram;
- reproducible command;
- test or deployment evidence.

### 6. Technical entry

Install / run / build / contribute.

### 7. Principles + license

Link to `EMPOWER_NOT_REPLACE.md` and license.

---

## 5. Reusable components

### Principle callout

```md
> **Empower, not replace.**  
> Automation can execute. AI can assist. Human authority remains visible.
```

### Authority block

```md
## Where authority lives

The system may **suggest** and **automate bounded operations**.
The human operator can **approve, reject, cancel and override**.
A generated or automated action is not treated as human confirmation unless the product explicitly records that confirmation.
```

### Evidence block

```md
## Proven in operation

This repository distinguishes automated checks from operational proof.
Claims about production behavior should point to the environment, smoke test or artifact that demonstrates them.
```

### Nomos Ludens footer

```md
---

### Nomos Ludens

**Technology for human agency.**  
**Empower, not replace.**

[Read the principle →](./EMPOWER_NOT_REPLACE.md)
```

---

## 6. Voice

The voice should be:

- declarative;
- specific;
- intellectually serious;
- occasionally playful when the product earns it;
- skeptical of inflated claims;
- comfortable saying what a system **does not** do.

### Prefer

> The assistant can propose a time. The Guardian confirms it.

### Avoid

> Our cutting-edge AI solution revolutionizes scheduling through seamless intelligent automation.

### Prefer

> If the browser can do it, the server does not need the file.

### Avoid

> Privacy-first state-of-the-art architecture ensures next-generation data sovereignty.

---

## 7. Identity hierarchy

Nomos Ludens is the **institutional layer**.

Each product keeps its own voice and visual accent.

```text
NOMOS LUDENS
│
├── principle: Empower, not replace
│
├── Kuan       → human authority in automated commercial operation
├── Héstia     → bounded, authorized, verifiable control
├── OmniTreco  → direct user capability + local execution
├── Kódice     → local-first ownership of reading/data
└── Book Composer → creative tooling without claiming authorship
```

Do **not** paste identical marketing copy into every repository. Reuse the principle and the grammar; let each product demonstrate it differently.

---

## 8. Rollout order

### First application — Kuan

Why:

- public README already has a clear product story;
- human final authority is already part of product behavior;
- current metadata is stronger than the other public repositories;
- the principle can be demonstrated without invoking authorship controversy.

### Second — OmniTreco

Apply the same system through a different proof: direct capability, local-first execution and user control.

### After production stabilization

- Héstia
- Book Composer

Do not use unstable production surfaces as flagship evidence.

### Later

- Kódice
- central Nomos Ludens profile README

---

## 9. Acceptance checklist

A README is ready when a first-time visitor can answer, within ~20 seconds:

- What is this?
- Why does it exist?
- Who is it for?
- What can the automation/AI actually do?
- Where does final authority remain?
- Is there evidence that the product works?
- Where do I go next?

If these answers require reading the whole repository, the README is not finished.

---

## 10. Version

**v1 — 2026-09-17**  
First applied to **Kuan** in branch `brand/empower-not-replace-v1`.
