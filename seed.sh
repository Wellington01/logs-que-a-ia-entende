#!/usr/bin/env bash
# Gera tráfego com padrão de incidente: baseline saudável -> pico de erro -> recuperação.
# Deixa o Grafana com dados bonitos (e um pico visível) pra demo.
#
#   bash seed.sh                 # app em localhost:3737 (docker)
#   bash seed.sh localhost:3939  # outra porta

U=${1:-localhost:3737}
H='content-type: application/json'

ok()  { curl -s -XPOST "$U/checkout" -H "$H" -d "{\"userId\":\"$1\"}" -o /dev/null & }
bug() { curl -s -XPOST "$U/checkout" -H "$H" -d '{"userId":"u_1001","coupon":"SUPER90"}' -o /dev/null & }
nf()  { curl -s -XPOST "$U/checkout" -H "$H" -d '{"userId":"u_9999"}' -o /dev/null & }
lg()  { curl -s -XPOST "$U/login" -H 'authorization: Bearer secret' -H "$H" -d '{"password":"123456"}' -o /dev/null & }

echo "baseline saudável (~15s)..."
for w in $(seq 1 8); do ok u_1001; ok u_1002; ok u_1001; [ $((w % 4)) -eq 0 ] && nf; [ $((w % 5)) -eq 0 ] && lg; wait; sleep 1; done

echo "🔥 pico de incidente (~12s)..."
for w in $(seq 1 8); do bug; bug; bug; ok u_1001; bug; wait; sleep 1; done

echo "recuperação (~12s)..."
for w in $(seq 1 8); do ok u_1001; ok u_1002; ok u_1001; wait; sleep 1; done

echo "✅ pronto — veja no Grafana (janela 'Last 15 minutes')"
