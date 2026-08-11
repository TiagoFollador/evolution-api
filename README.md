<h1 align="center">Nexo API</h1>

<p align="center">
  Gateway de mensageria <strong>Meta Tech Provider</strong> — WhatsApp Cloud API, Instagram Direct e Messenger sob um contrato único.
</p>

---

## Sobre

**Nexo API** é um gateway de mensageria multi-tenant para os canais oficiais da plataforma Meta Messaging. Ele faz **transporte, roteamento e conformidade** — deliberadamente sem domínio de negócio: chatbots, CRM e regras de atendimento pertencem à aplicação consumidora.

O nome é neutro de canal por decisão de projeto: as diretrizes de marca da Meta proíbem "Meta", "WhatsApp" ou "Instagram" no nome de um produto de terceiro.

### Canais

| Canal | Status |
|---|---|
| WhatsApp Cloud API | em migração (base herdada do Evolution API) |
| Instagram Direct | planejado |
| Messenger | planejado |

O canal Baileys (WhatsApp Web) foi **removido**: o passkey "Shortcake" quebrou o pareamento por QR, e manter aquele código significaria manter ~5.600 linhas que não conseguem mais autenticar.

## Origem e atribuição

Nexo API é um **trabalho derivado do [Evolution API](https://github.com/evolution-foundation/evolution-api)** (Evolution Foundation), que por sua vez começou a partir do [CodeChat](https://github.com/code-chat-br/whatsapp-api).

> **Este sistema utiliza Evolution API.**
> *(Usage Notification Requirement — cláusula 1.b do [LICENSE](./LICENSE))*

Nexo API não é afiliado, endossado ou patrocinado pela Evolution Foundation.

## Licença

Apache License 2.0 **com duas condições adicionais** herdadas do upstream — leia o [LICENSE](./LICENSE) na íntegra. A cláusula 1.b (notificação de uso) vale inclusive para sistemas fechados e está atendida no README, no `NOTICE` e na resposta de `GET /`.

## Stack

Node.js 20+ · TypeScript 5 · Express · Prisma (PostgreSQL) · Redis · S3/MinIO · Socket.io

## Desenvolvimento

```bash
npm ci
cp env.example .env          # configure DATABASE_CONNECTION_URI e AUTHENTICATION_API_KEY
npm run db:generate
npm run db:deploy
npm run dev:server           # tsx watch
```

| Comando | O que faz |
|---|---|
| `npm run build` | `tsc --noEmit` + bundle com tsup |
| `npm run lint` / `lint:check` | ESLint (com/sem `--fix`) |
| `npm test` / `test:watch` | Vitest |
| `npm run db:studio` | Prisma Studio |
| `npm run commit` | Commit convencional via commitizen |

## Estado

Refactor em fases. Concluído: higiene do fork, harness de teste com golden-file do canal Meta, remoção do Baileys e das integrações de domínio.

Em aberto: abstração de canal tipada, criptografia de credenciais, verificação HMAC dos webhooks Meta, modelo canônico de mensagem, Instagram e Messenger.
