# Fila — o que ficou pra depois

Pedido enquanto o app está em uso real. **Nada aqui entra no meio de um treino.**

---

## 1. Miniatura do exercício na tela de sessão ativa
**Pedido em 12/09/2026 · viável, e é o próximo**

No Heavy, cada exercício tem uma imagem redonda pequena ao lado do nome, dentro
do treino em andamento. O app já tem o mapa de ilustrações
(`lib/treino/ilustracoes.ts`, duas fotos por exercício) e usa ele na tela de
detalhe do exercício — falta trazer a mesma imagem, pequena, pro cabeçalho de
cada exercício em `app/sessao/sessao-ativa.tsx`.

**Cuidados:**
- **Uma foto só, estática.** A alternância de duas fotos é animação e não pode
  rodar sete vezes na mesma tela enquanto se treina.
- Exercício sem ilustração precisa de espaço reservado que não quebre a linha
  (`aprox: true` continua valendo).
- O service worker já cacheia `/ex/`, então isso não custa rede na academia.

## 2. Treino na tela de bloqueio, como o Heavy
**Pedido em 12/09/2026 · ⚠ NÃO é possível como PWA**

O Heavy mostra o treino em andamento na tela de bloqueio, com exercício atual,
série e um botão de concluir. Isso é **Live Activity** (ActivityKit): API
nativa do iOS, disponível só pra app do App Store. **Não existe API web** —
nem no app instalado na tela de início. O mesmo vale pra widget de tela de
início e pra Dynamic Island.

**O que dá pra fazer, e não é a mesma coisa:**
- **Notificação persistente** durante o treino, atualizada a cada série. Aparece
  na lista de notificações, não como painel vivo, e depende do Web Push (já
  montado, ver D-020).
- Manter a tela acesa no treino (`navigator.wakeLock`, já implementado).

**O que seria preciso pra ter de verdade:** o plano B do D-001 — empacotar em
Expo/React Native. É a troca que o D-001 já previa, e o custo continua sendo o
mesmo: deixar de ser web.
