# Demo — Logs que a IA entende (Pino + OpenTelemetry)

Demo rodável da palestra. Um `checkout-service` em Node.js que mostra o "antes e
depois": de `console.log` espalhado para **wide events** estruturados,
correlacionados com **OpenTelemetry** e com **redaction** de dados sensíveis.

## Rodar

```bash
npm install

# Bonito e colorido pra apresentar ao vivo (porta 3737 — a 3000 costuma estar ocupada)
PORT=3737 npm run dev

# JSON puro (jeito produção — é o que a IA/coletor consome)
PORT=3737 npm start
```

Servidor sobe em `http://localhost:3737` (porta padrão é 3000; usamos 3737 porque
a 3000 estava ocupada na máquina de teste — ajuste com `PORT=...`).

> Variáveis de ambiente úteis pra demo:
> `SERVICE_VERSION=2.3.1 COMMIT_SHA=a1b2c3d REGION=sa-east-1 NODE_ENV=production`

## Os endpoints da demo

```bash
# ✅ Sucesso — wide event com outcome:"success"
curl -XPOST localhost:3737/checkout \
  -H 'content-type: application/json' \
  -d '{"userId":"u_1001"}'

# 🐛 BUG ao vivo — cupom maior que o subtotal => total negativo => gateway recusa
curl -XPOST localhost:3737/checkout \
  -H 'content-type: application/json' \
  -d '{"userId":"u_1001","coupon":"SUPER90"}'

# ❌ Jeito ruim — console.log espalhado, sem contexto nem trace
curl -XPOST localhost:3737/checkout-ruim \
  -H 'content-type: application/json' \
  -d '{"userId":"u_1001","coupon":"SUPER90"}'

# 🔒 Redaction ao vivo — dados sensíveis saem como [REDACTED]
curl -XPOST localhost:3737/login \
  -H 'authorization: Bearer super-secret-token' \
  -H 'content-type: application/json' \
  -d '{"email":"ana@exemplo.com","password":"123456"}'
```

## O que olhar no log de erro

Uma única linha responde "quem, o quê, por quê":

```json
{
  "level": "error",
  "service": "checkout-service", "version": "2.3.1", "commit": "a1b2c3d", "region": "sa-east-1",
  "trace_id": "9d93b0f7...", "span_id": "69912b6c...",
  "request_id": "0c3a2151-...",
  "user": { "id": "u_1001", "subscription": "premium", "account_age_days": 540 },
  "coupon": { "code": "SUPER90", "discount_cents": 9000 },
  "cart": { "item_count": 2, "subtotal_cents": 4990, "total_cents": -4010 },
  "error": { "message": "invalid charge amount: -4010", "type": "Error", "code": "INVALID_AMOUNT" },
  "outcome": "error", "status_code": 500, "duration_ms": 36.88
}
```

→ Cliente **premium** não conseguiu pagar porque o **cupom (9000) > subtotal (4990)**
e o total ficou **negativo**. O bug está em `src/server.js`: falta `Math.max(0, ...)`.

## Ver o trace na tela (OTel Collector + Loki + Tempo + Grafana)

A app manda **tudo via OTLP** pro **OpenTelemetry Collector**, que roteia: logs →
Loki, traces → Tempo. Trocar de backend não toca no código.

```
app ─OTLP (logs+traces)─► OTel Collector ─┬─► Loki  (logs)
                                          └─► Tempo (traces) ─► Grafana
```

```bash
docker compose up --build -d   # app + OTel Collector + Loki + Tempo + Grafana
```

| Serviço | URL | Papel |
|---|---|---|
| App (checkout) | http://localhost:3737 | gera log+trace via OTLP |
| OTel Collector | (interno) | recebe OTLP e roteia |
| Grafana | http://localhost:3081 | visualização (anônimo = admin) |
| Loki | http://localhost:3100 | logs |
| Tempo | http://localhost:3200 | traces |

Gere tráfego (curls acima na porta **3737**) e no Grafana vá em **Explore**:

```logql
# Loki — campos vêm como structured metadata (sem | json)
{service_name="checkout-service"}                       # tudo
{service_name="checkout-service"} | outcome="error"      # só erros
{service_name="checkout-service"} | event="checkout.failed"

# Métricas derivadas do log
sum by (event)      (count_over_time({service_name="checkout-service"} | event=~".+" [1m]))
sum by (error_code) (count_over_time({service_name="checkout-service"} | error_code=~".+" [1m]))
sum(count_over_time({service_name="checkout-service"} | outcome="error" [1m]))  # taxa de erro
```

Cada log carrega `trace_id` → botão **"Ver trace no Tempo"** leva direto ao trace.
Log → trace, um clique.

```bash
docker compose down            # encerra tudo
```

> Portas 3000/3001 estavam ocupadas na máquina de teste — por isso app=3737 e
> Grafana=3081. Ajuste no `docker-compose.yml` se precisar.

## Mapa do código

| Arquivo | Papel na palestra |
|---|---|
| `src/logger.js` | Logger único: contexto de ambiente + trace_id + **redaction** |
| `src/tracing.js` | OpenTelemetry (carregado com `-r`): exporta **logs + traces** via OTLP |
| `observability/otel-collector-config.yaml` | Collector: recebe OTLP → roteia log→Loki, trace→Tempo |
| `src/wide-event.js` | Middleware que emite **um** evento por requisição |
| `src/server.js` | `/checkout` (bom) vs `/checkout-ruim` (ruim) + bug plantado |
| `src/data.js` / `src/payment.js` | Dados e gateway fake |
