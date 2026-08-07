# Onde o projeto parou e o que falta

## Situação atual (verificada)

A integração com a Mystifly (o sistema de voos que permite buscar, reservar
e emitir bilhetes) já está construída no projeto:

- Cliente de comunicação com sessão automática, novas tentativas, limite de
  requisições e registro de todas as chamadas.
- 15 operações implementadas: busca de tarifas, revalidação, regras, reserva,
  emissão, detalhes, cancelamento, faturas, pós-emissão, alterações de malha e
  notas de crédito.
- Telas de administração: painel em Admin → Mystifly e console de testes em
  Admin → Testes Mystifly.
- Documentação técnica com checklist de homologação em `docs/mystifly.md`.
- O erro de "permissão negada" na verificação de plano premium já foi
  corrigido e o registro de monitoramento foi encerrado.

O que impede avançar: **nenhuma credencial da Mystifly está cadastrada**. A
lista de segredos do projeto hoje tem Daily, Duffel, ElevenLabs, Stripe e
Push — nenhum item `MYSTIFLY_*`. Sem isso, qualquer chamada retorna
"Credenciais da Mystifly não configuradas".

## Próximos passos

### Passo 1 — Cadastrar as credenciais (depende de você)
Abro o formulário seguro para você colar os valores enviados pela Mystifly:

- `MYSTIFLY_BASE_URL_SANDBOX` — endereço do ambiente de testes
- `MYSTIFLY_USERNAME` — usuário
- `MYSTIFLY_PASSWORD` — senha
- `MYSTIFLY_ACCOUNT_NUMBER` (opcional) — número da conta/agência
- `MYSTIFLY_API_KEY` (opcional) — se a Mystifly exigir
- `MYSTIFLY_BASE_URL_PRODUCTION` — pode ficar para depois da homologação

Os valores ficam apenas no servidor; nunca aparecem no navegador nem no banco.

### Passo 2 — Teste de conexão
Executar o botão "Testar conexão" no painel, que cria uma sessão real na
Mystifly e grava o resultado no status da integração.

### Passo 3 — Bateria de testes de homologação
Rodar, pelo console de testes, a sequência exigida pela Mystifly: busca ida,
busca ida e volta, tarifas com marca, regras, revalidação, reserva em hold,
detalhes do PNR, emissão, notas, faturas, pós-emissão, cancelamento,
alteração de malha e nota de crédito. Cada chamada fica registrada com tempo,
status e referência.

### Passo 4 — Relatório de conformidade
Gerar um resumo em `docs/mystifly.md` com o resultado de cada item do
checklist (aprovado / pendente / erro), pronto para enviar à Mystifly.

### Passo 5 — Produção
Depois do aval da Mystifly: cadastrar a Base URL de produção e alternar o
ambiente na tela de configuração, sem novo deploy.

## Alternativa enquanto a Mystifly não libera

Voos e hospedagens já operam em modo "busca + redirecionamento" para
parceiros públicos. Esse modo continua ativo e não é afetado pela
homologação; a troca para reserva direta é uma mudança de configuração
quando a Mystifly aprovar.

## Detalhes técnicos

- Credenciais lidas somente dentro de handlers de servidor
  (`src/lib/mystifly/client.server.ts`), via `process.env`.
- Configurações não sensíveis (ambiente, timeout, retries, TTL de sessão)
  ficam em `mystifly_settings`, com RLS restrito a administradores.
- Logs em `mystifly_api_logs`, com dados sensíveis redigidos.
- Acesso às telas e às server functions exige papel `admin` em `user_roles`.
