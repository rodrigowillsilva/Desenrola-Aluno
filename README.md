# Desenrola Aluno — Release 01 (`BASELINE_R01`)

Aplicação Web (Backend Node.js/Express + Banco Relacional SQLite + Frontend SPA HTML/CSS/JS) e suíte de testes automatizados com Selenium WebDriver referente à **Release 01** da disciplina **SDES06 — Gerência de Projetos de Software (UNIFEI)**.

## Escopo Implementado na Release 01
- **[RFS36] Autenticar Usuário (Login/Logout) e Controle RBAC ([RNF07])**:
  - Administrador (`admin@unifei.edu.br` / `Admin123`): Acesso completo aos CRUDs de Usuários e Cursos.
  - Aluno / Discente (`aluno@unifei.edu.br` / `Aluno123`): Acesso ao próprio perfil e consulta ao catálogo de Cursos, além de auto-cadastro público.
- **CRUD 01 — Manter Usuários ([RFC01] / [RFS01] a [RFS04])**:
  - **[RFS01] Incluir Usuário**: Validação de Nome Completo (nome e sobrenome sem números), algoritmo oficial de CPF da Receita Federal, senha forte (`bcrypt` — [RNF06]), matrícula de 10 dígitos, vínculo com Curso/Currículo e inicialização automática da grade individual (`TB_GRADE_ALUNO`).
  - **[RFS02] Consultar Usuário**: Filtros por Nome, Perfil e Curso (default `TODOS`), agrupado por Curso Vinculado e ordenado alfabeticamente por Nome.
  - **[RFS03] Alterar Usuário**: Bloqueio de edição dos atributos `CPF` e `Número de Matrícula`.
  - **[RFS04] Remover Usuário**: Impedimento de exclusão do único Administrador ativo no sistema (RN01) e exclusão em cascata dos registros acadêmicos do aluno (RN02 / LGPD — [RNF09]).
- **CRUD 02 — Manter Cursos de Graduação ([RFC02] / [RFS05] a [RFS08])**:
  - **[RFS05] Incluir Curso**: Validação de Código único (3-10 caracteres maiúsculos), Instituto UNIFEI (`IESTI`, `IMC`, `IEPG`, `IEM`, `IEE`, `IRN`, `IFE`, `ICET`), Grau, Turno e Duração Padrão/Máxima.
  - **[RFS06] Consultar Curso**: Filtros por Instituto, Turno e Nome/Código, agrupado por Instituto e ordenado por Nome.
  - **[RFS07] Alterar Curso**: Bloqueio de alteração do `Código do Curso`.
  - **[RFS08] Remover Curso**: Impedimento de exclusão caso o curso possua alunos ou currículos vinculados.

---

## Como Executar a Aplicação Localmente

```powershell
cd app
npm install
npm start
```
Acesse no navegador: **http://localhost:3000**

---

## Como Executar os Testes Automatizados no Selenium (`CT01` a `CT08` e `CT36`)

Com o servidor rodando em um terminal (`npm start`), abra outro terminal dentro da pasta `app/` e execute usando a `venv` local:

```powershell
cd app
.\.venv\Scripts\pytest tests/test_selenium_r01.py -v
```
*(Dica: caso queira ver a janela do Chrome abrindo e clicando sozinha durante a apresentação, basta comentar a linha `options.add_argument("--headless=new")` no arquivo `tests/test_selenium_r01.py`).*

---

## Como Subir o MantisBT Localmente via Docker (Opcional)

Caso queira abrir a interface do MantisBT localmente no navegador:
```powershell
cd app
docker compose -f docker-compose.mantis.yml up -d
```
Acesse `http://localhost:8989` (credenciais iniciais do MantisBT: `administrator` / `root`).

