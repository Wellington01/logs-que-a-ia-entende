# 🎤 Runbook de palco — comandos em sequência (testado)

Tudo roda na **porta 3737** (stack docker). Sem juggling de porta. Cada passo tem
o comando e o que mostrar. Mantenha este arquivo aberto numa tela só sua.

> Terminais: **T1** = logs prettificados · **T2** = curls · **Browser** = Grafana ·
> **Claude** = a IA.

---

## 🧰 PRÉ-PALCO (faça ANTES de subir, com calma)

```bash
cd demo
docker compose up --build -d          # sobe app + Collector + Loki + Tempo + Grafana
docker pull mcp/grafana               # (se for usar o MCP da IA)
bash seed.sh                          # popula o Grafana com tráfego + um pico
```

Confira que está tudo no ar:
```bash
curl -s -o /dev/null -w "app %{http_code}\n" localhost:3737/health
open http://localhost:3081/d/checkout-obs   # dashboard deve ter dados
```

**MCP (opcional, pra demo de IA em linguagem natural):** crie o token e cole no
`../.mcp.json`, depois relance o `claude` nesta pasta. Passo a passo em
[`MCP-GRAFANA.md`](./MCP-GRAFANA.md).

---

## 1️⃣ Momento Pino — "olha o wide event" (bloco Pino)

**T1** — deixa os logs do app rolando, prettificados:
```bash
docker compose logs -f --no-log-prefix app | npx pino-pretty
```

**T2** — dispara um checkout que dá certo:
```bash
curl -XPOST localhost:3737/checkout -H 'content-type: application/json' \
  -d '{"userId":"u_1001"}'
```
→ aponta na T1: **uma linha**, com `event`, `user.subscription`, `trace_id`, `duration_ms`.

**Redaction ao vivo** (bloco segurança):
```bash
curl -XPOST localhost:3737/login -H 'authorization: Bearer super-secret' \
  -H 'content-type: application/json' -d '{"email":"ana@x.com","password":"123456"}'
```
→ na T1: `authorization`, `password`, `cardNumber`, `token` viram **[REDACTED]**.

---

## 2️⃣ Momento OpenTelemetry — log ↔ trace no Grafana (bloco OTel)

**Browser** → http://localhost:3081 → **Explore** → datasource **Loki**:
```logql
{service_name="checkout-service"}
```
- Clica numa linha → abre os campos (structured metadata).
- Acha o **`trace_id`** → botão **"Ver trace no Tempo"** → cai no trace.
- No trace: o span **`payment.charge`** come quase todo o tempo (o gargalo).

---

## 3️⃣ Momento IA — a IA acha o bug (ponto alto)

**T2** — dispara o BUG (cupom > subtotal):
```bash
curl -XPOST localhost:3737/checkout -H 'content-type: application/json' \
  -d '{"userId":"u_1001","coupon":"SUPER90"}'      # volta 500
```
→ na T1 (ou no Grafana): `total_cents: -4010`, `INVALID_AMOUNT`, premium, SUPER90.

**Opção A — copy/paste (à prova de falhas):** copia o JSON do log de erro e cola
no Claude com: _"Você é um SRE. Causa raiz desse log? Sugira o fix."_

**Opção B — MCP (o uau):** no Claude (com o MCP grafana ligado), pergunta:
> _"Qual erro mais aconteceu no checkout-service na última hora e quem é mais
> afetado, premium ou free? Me explique a causa raiz."_

→ a IA roda a LogQL sozinha e responde: desconto > subtotal, total negativo,
falta `Math.max(0, ...)`, premium desproporcionalmente afetado.

---

## 4️⃣ Métricas / o pico (bloco produção/alertas)

**Browser** → Explore → Loki → modo gráfico:
```logql
sum(count_over_time({service_name="checkout-service"} | outcome="error" [1m]))
```
→ o **pico** do `seed.sh` aparece. Ou abre a dash `checkout-obs` (já tem tudo).

Pra um pico AO VIVO: `bash seed.sh` de novo numa T2 e atualiza o Grafana.

---

## 🆘 Plano B (se algo falhar no palco)
- **Docker/internet caiu:** use screenshots (logs, trace no Grafana, resposta da IA).
- **MCP engasgou:** vai de copy/paste (Opção A) — mesmo resultado.
- **Grafana vazio:** janela de tempo → **"Last 15 minutes"**; rode `bash seed.sh`.
- **Porta 3737/3081 ocupada:** ajuste no `docker-compose.yml`.

---

## 🧹 ENCERRAMENTO (depois da palestra)
```bash
docker compose down        # derruba a stack
```
