# IA + Grafana via MCP — o loop da palestra, de verdade

Conecta um agente (Claude) ao Grafana pelo **MCP server oficial** (`mcp/grafana`).
O agente ganha ferramentas pra consultar Loki, Tempo e Prometheus **em linguagem
natural** — ele escreve a LogQL/TraceQL sozinho.

## Pré-requisito
A stack tem que estar no ar (`cd demo && docker compose up -d`) e a imagem do MCP
baixada (`docker pull mcp/grafana`).

## Passo 1 — criar o token (você roda, é a sua credencial)

No prompt do Claude Code, digite com o prefixo `!` (roda no seu terminal):

```bash
! SAID=$(curl -s -XPOST http://localhost:3081/api/serviceaccounts \
  -H 'content-type: application/json' \
  -d '{"name":"mcp-ai","role":"Viewer"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])') \
  && curl -s -XPOST http://localhost:3081/api/serviceaccounts/$SAID/tokens \
  -H 'content-type: application/json' -d '{"name":"mcp-token"}' \
  | python3 -c 'import sys,json;print("TOKEN:",json.load(sys.stdin)["key"])'
```

Copia o `glsa_...` que aparecer.

> Role **Viewer** já basta (o MCP só lê). Se alguma query for negada, recrie com
> `"role":"Editor"`.

## Passo 2 — colar o token

Abre `.mcp.json` (na raiz da pasta `palestra/`) e troca `glsa_COLE_SEU_TOKEN_AQUI`
pelo token. **Não commita esse arquivo** (tem credencial).

## Passo 3 — reiniciar o Claude Code nessa pasta

O `.mcp.json` é lido ao iniciar a sessão. Saia e rode `claude` de novo dentro de
`palestra/`. O servidor `grafana` aparece nas ferramentas MCP.

(Claude Desktop: cole o mesmo bloco `mcpServers` em `claude_desktop_config.json` e
reinicie o app.)

## Passo 4 — perguntar em linguagem natural (o momento da palestra)

Exemplos pra demonstrar ao vivo:

- _"Qual erro mais aconteceu no checkout-service na última hora e quem é mais
  afetado, premium ou free?"_
- _"Pega um evento de checkout.failed e me explica a causa raiz pelos campos."_
- _"A taxa de erro teve algum pico? Quando começou?"_
- _"Me dá o trace de uma requisição que falhou e diz onde gastou tempo."_

O agente traduz pra LogQL/TraceQL, roda no Grafana e responde — **sem você
escrever query nenhuma.** É a tese da palestra fechando o ciclo.

## Plano B (se MCP der ruim no palco)
Copia o JSON de um log de erro do Grafana e cola direto no Claude com:
_"Você é um SRE. Causa raiz desse log? Sugira o fix."_ — mesmo resultado, zero setup.

## Ferramentas que o agente ganha (principais)
`query_loki_logs` · `query_loki_stats` · `list_loki_label_names/values` ·
`query_prometheus` · `query_tempo` (traces) · `search_dashboards` ·
`list_datasources` · `get_dashboard_by_uid`
