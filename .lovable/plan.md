## Plano — Exportar tradução em PDF, Word, Excel e PowerPoint

### O que muda
Na página **Tradutor de Arquivos**, cada tradução concluída (tanto o resultado recém-gerado quanto cada linha do histórico) ganhará um botão **"Exportar"** com um menu suspenso com 4 opções:

- PDF
- Word (.docx)
- Excel (.xlsx)
- PowerPoint (.pptx)

A opção "Baixar" original (que entrega o .md) continua disponível como "Markdown".

### Qualidade visual

- **PDF**: usar exatamente o mesmo estilo do Planejador de Viagens (mesma fonte, mesmos títulos azuis, mesmo espaçamento, mesmo cabeçalho, impressão via janela do navegador). Resultado idêntico em qualidade ao PDF do roteiro.
- **Word**: documento profissional com título, hierarquia de cabeçalhos (H1/H2/H3), listas com marcadores, negritos preservados, margens de 1 polegada, fonte limpa.
- **Excel**: cada linha do conteúdo vira uma linha da planilha; tabelas em markdown (quando existirem) são convertidas em tabelas reais com cabeçalho destacado, larguras de coluna ajustadas e congelamento da primeira linha.
- **PowerPoint**: um slide de capa com o título + um slide por seção (quebra em cada `##`), com título, marcadores e paleta consistente.

### Onde aparece

- Cartão de resultado da tradução recém-feita: substitui o botão único "Baixar" por um menu "Exportar".
- Tabela de histórico: cada linha de status "sucesso" passa a ter o mesmo menu "Exportar".

### Como funciona por baixo (resumo técnico)

- Adicionar as bibliotecas `docx`, `xlsx` (SheetJS) e `pptxgenjs` (todas puras em JS, rodam no navegador).
- Tudo é gerado no navegador a partir do conteúdo markdown traduzido (baixado via URL assinada do armazenamento). Não há custo extra de créditos nem chamada de IA.
- O PDF usa a mesma rotina de impressão (`window.print`) com o CSS do planejador, garantindo a aparência idêntica.
- Conversor de markdown → estrutura (títulos, listas, negritos, tabelas) compartilhado entre os 4 formatos.

### Fora do escopo
- Sem alterações no fluxo de tradução, cobrança de créditos ou backend.