# Coach — contexto, não código

Os arquivos que o coach lê. **Nenhum deles é versionado** (ver `.gitignore`):
são dado pessoal de treino, e este repositório é público.

| arquivo | quem escreve | quando muda |
|---|---|---|
| `retrato.md` | `scripts/retrato-coach.ts` | semanal, automático |
| `sobre-mim.md` | você, uma vez | raramente |
| `principios.md` | destilado das transcrições | quando entram vídeos novos |
| `transcricoes/` | legendas baixadas do YouTube | fonte, não é lido direto |

## Gerar o retrato

```bash
npx tsx scripts/retrato-coach.ts
```

Lê o banco e escreve `coach/retrato.md` — rotinas, volume por músculo nas
últimas 8 semanas, carga e estagnação por exercício, últimos treinos. Umas duas
páginas, porque tem que caber no contexto de uma conversa.

## Como o coach usa

Não existe conexão ao vivo com o banco. **O elo é o arquivo.** Duas formas:

- **Aqui no Claude Code:** eu leio direto da pasta, sempre atualizado
- **No celular:** os três arquivos vão pro Google Drive, e um Projeto no
  claude.ai lê de lá pelo conector oficial. Uma semana de defasagem é aceitável
  — carga e frequência não mudam de um dia pro outro

No sentido contrário — coach escrevendo na sua rotina — **nada é automático**:
ele responde em bloco, você cola no app, o app mostra o que muda e você
confirma. Escrita no banco não sai de uma janela de chat.

## `sobre-mim.md` — o que escrever

É o arquivo que mais muda a qualidade da resposta, e só você pode escrever.
Modelo em `sobre-mim.exemplo.md`.
