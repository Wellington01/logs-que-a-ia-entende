#!/usr/bin/env bash
# Acha (ou cria) o service account 'mcp-ai' (Viewer) no Grafana local e gera um
# token pro MCP server. Roda sem dependência de python — só curl + grep/sed.
#
#   bash get-mcp-token.sh
#
# Copie o glsa_... impresso e cole no .mcp.json (raiz da palestra/).

G="${GRAFANA_URL:-http://localhost:3081}"

# 1) acha o id do mcp-ai (se já existe) ou cria
SAID=$(curl -s "$G/api/serviceaccounts/search?query=mcp-ai" \
  | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')

if [ -z "$SAID" ]; then
  SAID=$(curl -s -XPOST "$G/api/serviceaccounts" \
    -H 'content-type: application/json' \
    -d '{"name":"mcp-ai","role":"Viewer"}' \
    | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
fi

if [ -z "$SAID" ]; then
  echo "❌ não consegui achar/criar o service account mcp-ai. Grafana no ar em $G?"
  exit 1
fi
echo "service account mcp-ai → id $SAID"

# 2) gera um token (nome único pra não colidir)
RESP=$(curl -s -XPOST "$G/api/serviceaccounts/$SAID/tokens" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"mcp-token-$RANDOM\"}")
KEY=$(echo "$RESP" | grep -o '"key":"[^"]*"' | sed 's/.*"key":"//;s/"$//')

if [ -n "$KEY" ]; then
  echo
  echo "TOKEN: $KEY"
  echo
  echo "→ cole esse glsa_... no .mcp.json (raiz da palestra/),"
  echo "  no lugar de glsa_COLE_SEU_TOKEN_AQUI"
else
  echo "❌ falhou ao gerar token. Resposta do Grafana:"
  echo "$RESP"
fi
