# Aprendizados de uso real — e o que fazer com eles na dieta

Escrito em 12/09/2026, no **dia 1** de uso do app na academia. Cada item aqui
custou um pedido no meio do treino. A dieta começa já sabendo.

---

## 1. Uso real produz mais requisito que construção

Três dias construindo não acharam o que 50 minutos de academia acharam: o ✓ não
disparava o descanso, não dava pra digitar 12,5 kg, faltava excluir série,
faltava saber que havia treino em andamento ao reabrir o app.

**Na dieta:** entregar a menor fatia que já dá pra usar — registrar UMA refeição
e ver o total do dia — e usar por uma semana antes de construir o resto.
Catálogo completo, código de barras e macros detalhados vêm depois de existir o
hábito de registrar.

## 2. Campo numérico controlado precisa guardar TEXTO

`value={numero}` come a vírgula: "12," vira `Number("12,")` = 12, o campo
redesenha "12" e o 5 nunca chega. Foi o pior bug do dia porque **bloqueava** o
registro.

**Na dieta é pior:** grama, mililitro e porção são todos decimais, e "1,5" é mais
comum ali do que na academia. Todo campo de quantidade nasce guardando o texto
digitado junto do número — ver `SerieEmAndamento.pesoTexto`.

## 3. "Repetir o de ontem" é a interação mais valiosa que existe

O ✓ com os campos vazios copia a série anterior inteira. É o que transforma
registro em um toque.

**Na dieta:** "repetir a refeição de ontem" e "repetir o café da manhã de
sempre" não são conveniência, são o produto. Antes de qualquer busca de
alimento, antes de qualquer scanner.

## 4. O rascunho tem que sobreviver a fechar o app — e se anunciar

O rascunho do treino sempre existiu, mas só era restaurado se você voltasse
na tela certa. Fechar o app no meio e reabrir caía no Início, sem sinal nenhum:
o dado estava salvo e **invisível**.

**Na dieta:** refeição sendo montada é rascunho. E a barra "tem coisa em
andamento" tem que aparecer igual.

## 5. Estado atribuído dentro do updater do setState é lido velho fora

Causa do descanso que não disparava. A decisão tem que ser tomada **antes** do
`setState`, não dentro do corpo dele.

**Na dieta:** mesma armadilha em qualquer "ao adicionar o item, faça X".

## 6. Recompensa visual imediata muda o uso

Destaque na série concluída e medalha de recorde foram pedidos com print na mão,
no meio do treino — não são enfeite, são o retorno que faz registrar valer a pena.

**Na dieta:** o equivalente é ver a barra de proteína/caloria se mexer NA HORA
de registrar o item. Não numa tela de resumo separada.

## 7. O iPhone impõe limites que não adianta brigar (ver D-021)

- `navigator.vibrate` não existe. O canal de aviso é o som.
- Áudio só toca se um gesto recente tiver liberado — preparar no toque anterior.
- App em segundo plano é **congelado**: nada de timer, nada de notificação local.
- Atalhos não lê treino do Saúde — e não vai ler.

**Na dieta:** não prometer lembrete de refeição confiável sem Web Push (D-020) ou
app nativo.

## 8. Decidir por ele custa caro; oferecer o trade-off funciona

Quando eu listei opções sem recomendar, a conversa travou. Quando eu disse
"eu faria X, e o custo de Y é este", a decisão saiu em uma mensagem.

**Na dieta:** cada escolha de produto (TACO vs. Open Food Facts, macro completo
vs. só caloria) vai com recomendação explícita e o custo aceito escrito.
