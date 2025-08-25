# Guia de Deploy na Vercel

Olá! Aqui estão as instruções passo a passo para fazer o deploy da sua aplicação na Vercel.

---

### Etapa 1: Preparação (no seu computador)

Antes de ir para a Vercel, precisamos gerar os ícones que eu não consegui criar no meu ambiente.

1.  **Instale as dependências:** Abra o terminal na pasta do projeto e rode o seguinte comando:
    ```bash
    npm install
    ```
2.  **Gere os ícones:** Depois, rode este comando para gerar os ícones:
    ```bash
    npm run build:icons
    ```
3.  **Envie as alterações:** Após os comandos rodarem, você verá novos arquivos de ícone na pasta `public/icons`. Envie essas alterações para o seu repositório no GitHub.
    ```bash
    git add .
    git commit -m "feat: Add generated PWA icons"
    git push
    ```

---

### Etapa 2: Deploy na Vercel

1.  **Importe o Projeto:** Acesse sua conta na Vercel e clique em **"Add New... -> Project"**. Importe o seu repositório do GitHub.
2.  **Configure o Projeto:** A Vercel deve detectar as configurações automaticamente por causa do arquivo `vercel.json`.
    *   **Framework Preset:** Deve ser "Other".
    *   **Output Directory:** Deve ser `public`.
    *   **Build Command:** Pode deixar em branco.
3.  **Deploy:** Clique em **"Deploy"**.

---

### Etapa 3: Configurar a Chave da IA (O Passo Mais Importante)

Após o primeiro deploy, precisamos adicionar a chave da OpenAI para que o assistente de IA funcione.

1.  **Acesse as Configurações:** No painel do seu projeto na Vercel, vá para a aba **"Settings"**.
2.  **Variáveis de Ambiente:** Clique em **"Environment Variables"** no menu lateral.
3.  **Crie a Variável:**
    *   **Name:** `OPENAI_API_KEY`
    *   **Value:** Cole aqui a sua chave secreta da OpenAI (aquela que começa com `sk-...`).
4.  **Salve** a variável.
5.  **Redeploy:** Volte para a aba **"Deployments"**, clique nos três pontinhos (`...`) ao lado do último deploy e selecione **"Redeploy"**. Isso é crucial para que a Vercel aplique a nova variável de ambiente.

---

E é isso! Após o redeploy, sua aplicação estará no ar, completa e com todas as funcionalidades prontas para usar.
