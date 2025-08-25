
# BNCC Avançado v2.3

Aplicativo estático (SPA) para montar planos de aula alinhados à BNCC com **Modo TEA**, **exportação real em PDF**, **persistência completa**, **PWA offline** e **reordenação** via SortableJS.

## Como usar

- **Local**: abra `index.html` no navegador (alguns recursos de PWA exigem servidor HTTP).  
- **GitHub Pages**: publique a pasta inteira; URL ficará `https://seuusuario.github.io/bncc-advanced-v2_3/`.  
- **Vercel**: importe o repositório; Framework: *Other*; Build Command: vazio; Output: `/`.

## Recursos
- Biblioteca BNCC com filtros (Ano, Componente, Busca).
- Arraste cards para o Workspace **ou** use botões de adicionar.
- Quatro zonas: Objetivos, Atividades, Jogos, Avaliações.
- **Exportar → PDF** captura o Workspace (paginação automática).
- **Exportar JSON / Importar JSON** do estado completo.
- **Persistência**: localStorage (workspace, atividades, preferências).
- **PWA**: `manifest` + `service-worker` com *stale-while-revalidate* e precache de CDNs.
- **Acessibilidade**: tabs com ARIA e foco visível.

## Substituir dataset BNCC
O arquivo `bncc.json` é um **stub**. Substitua pelo seu conjunto completo mantendo o formato:
```json
{
  "5º ano": {
    "Matemática": [
      {"codigo":"EF05MA03","tema":"Multiplicação","descricao":"...", "tags":["..."]}
    ]
  }
}
```

## Licença
Uso livre para fins educacionais.
