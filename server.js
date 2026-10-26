const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { run, get, all, initDatabase, seedInitialData, seedTurmasAluno } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO DE DADOS
// ============================================================================

function validarCPF(cpfStr) {
  if (!cpfStr) return false;
  const digits = cpfStr.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10))) return false;

  return true;
}

function formatarCPF(cpfStr) {
  const d = cpfStr.replace(/\D/g, '');
  if (d.length !== 11) return cpfStr;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function validarNomeUsuario(nome) {
  if (!nome || typeof nome !== 'string') return false;
  const limpo = nome.trim();
  if (limpo.length < 5 || limpo.length > 100) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(limpo)) return false;
  const partes = limpo.split(/\s+/);
  return partes.length >= 2;
}

function validarEmail(email) {
  if (!email || email.length > 100) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarSenha(senha) {
  if (!senha || senha.length < 8 || senha.length > 32) return false;
  const temMaiuscula = /[A-Z]/.test(senha);
  const temMinuscula = /[a-z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);
  return temMaiuscula && temMinuscula && temNumero;
}

function validarSemestreIngresso(sem) {
  if (!sem) return false;
  const match = /^(\d{4})\.([12])$/.exec(sem.trim());
  if (!match) return false;
  const ano = parseInt(match[1], 10);
  return ano >= 2015 && ano <= 2026;
}

// ============================================================================
// AUTENTICAÇÃO DE USUÁRIOS (authService)
// ============================================================================
const authService = {
  async login(req, res) {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ erro: 'Informe seu e-mail e sua senha para entrar.' });
      }
      const user = await get(
        `SELECT u.*, c.nome as curso_nome, c.codigo as curso_codigo, cur.codigo as curriculo_codigo
         FROM TB_USUARIO u
         LEFT JOIN TB_CURSO c ON u.curso_id = c.id
         LEFT JOIN TB_CURRICULO cur ON u.curriculo_id = cur.id
         WHERE LOWER(u.email) = LOWER(?)`,
        [email.trim()]
      );

      if (!user || !bcrypt.compareSync(senha, user.senha_hash)) {
        return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
      }

      const { senha_hash, ...userSemSenha } = user;
      return res.json({
        mensagem: 'Login realizado com sucesso!',
        usuario: userSemSenha
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
};

app.post('/api/auth/login', authService.login);

// ============================================================================
// GESTÃO DE USUÁRIOS E PERFIL (usuarioController)
// ============================================================================
const usuarioController = {
  async incluir(req, res) {
    try {
      const {
        nome,
        cpf,
        email,
        senha,
        perfil,
        matricula,
        curso_id,
        curriculo_id,
        semestre_ingresso
      } = req.body;

      if (!validarNomeUsuario(nome)) {
        return res.status(400).json({
          erro: 'Informe o nome completo (nome e sobrenome, entre 5 e 100 letras, sem números).'
        });
      }
      if (!validarCPF(cpf)) {
        return res.status(400).json({
          erro: 'CPF inválido. Informe um CPF válido com 11 dígitos.'
        });
      }
      if (!validarEmail(email)) {
        return res.status(400).json({
          erro: 'E-mail inválido. Digite no formato nome@dominio.com.'
        });
      }
      if (!validarSenha(senha)) {
        return res.status(400).json({
          erro: 'A senha deve ter entre 8 e 32 caracteres, contendo letra maiúscula, minúscula e número.'
        });
      }
      if (!['Aluno (Discente)', 'Administrador'].includes(perfil)) {
        return res.status(400).json({
          erro: 'Selecione um tipo de conta válido.'
        });
      }

      const cpfFormatado = formatarCPF(cpf);

      const existeCpf = await get('SELECT id FROM TB_USUARIO WHERE cpf = ?', [cpfFormatado]);
      if (existeCpf) {
        return res.status(400).json({ erro: 'Já existe uma conta cadastrada com este CPF.' });
      }
      const existeEmail = await get('SELECT id FROM TB_USUARIO WHERE LOWER(email) = LOWER(?)', [email.trim()]);
      if (existeEmail) {
        return res.status(400).json({ erro: 'Já existe uma conta cadastrada com este e-mail.' });
      }

      let matFinal = null;
      let cursoFinal = null;
      let currFinal = null;
      let semFinal = null;

      if (perfil === 'Aluno (Discente)') {
        if (!matricula || !/^\d{10}$/.test(String(matricula).trim())) {
          return res.status(400).json({
            erro: 'O número de matrícula deve conter exatamente 10 dígitos numéricos (ex: 2023001234).'
          });
        }
        matFinal = String(matricula).trim();
        const existeMat = await get('SELECT id FROM TB_USUARIO WHERE matricula = ?', [matFinal]);
        if (existeMat) {
          return res.status(400).json({ erro: 'Já existe um aluno cadastrado com este número de matrícula.' });
        }

        if (!curso_id) {
          return res.status(400).json({ erro: 'Selecione o seu curso de graduação.' });
        }
        if (!curriculo_id) {
          return res.status(400).json({ erro: 'Selecione a matriz curricular do seu curso.' });
        }
        if (!validarSemestreIngresso(semestre_ingresso)) {
          return res.status(400).json({
            erro: 'Informe o semestre de ingresso no formato AAAA.1 ou AAAA.2 (ex: 2024.1).'
          });
        }
        cursoFinal = Number(curso_id);
        currFinal = Number(curriculo_id);
        semFinal = semestre_ingresso.trim();
      }

      const senhaHash = bcrypt.hashSync(senha, 10);
      const result = await run(
        `INSERT INTO TB_USUARIO (nome, cpf, email, senha_hash, perfil, matricula, curso_id, curriculo_id, semestre_ingresso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome.trim(), cpfFormatado, email.trim(), senhaHash, perfil, matFinal, cursoFinal, currFinal, semFinal]
      );

      if (perfil === 'Aluno (Discente)') {
        await run(
          `INSERT INTO TB_GRADE_ALUNO (usuario_id, codigo_disciplina, situacao) VALUES (?, ?, ?)`,
          [result.lastID, 'SDES06', 'Pendente']
        );
        await seedTurmasAluno(result.lastID);
      }

      return res.status(201).json({
        mensagem: 'Conta cadastrada com sucesso!',
        id: result.lastID
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async consultar(req, res) {
    try {
      const { nome, perfil, curso_id } = req.query;
      let sql = `
        SELECT u.id, u.nome, u.cpf, u.email, u.perfil, u.matricula,
               u.curso_id, u.curriculo_id, u.semestre_ingresso,
               COALESCE(c.nome, 'Coordenação / Administração') as curso_nome,
               c.codigo as curso_codigo,
               cur.codigo as curriculo_codigo
        FROM TB_USUARIO u
        LEFT JOIN TB_CURSO c ON u.curso_id = c.id
        LEFT JOIN TB_CURRICULO cur ON u.curriculo_id = cur.id
        WHERE 1=1
      `;
      const params = [];

      if (nome && nome !== 'TODOS') {
        sql += ` AND LOWER(u.nome) LIKE LOWER(?)`;
        params.push(`%${nome.trim()}%`);
      }
      if (perfil && perfil !== 'TODOS') {
        sql += ` AND u.perfil = ?`;
        params.push(perfil);
      }
      if (curso_id && curso_id !== 'TODOS') {
        sql += ` AND u.curso_id = ?`;
        params.push(Number(curso_id));
      }

      sql += ` ORDER BY curso_nome ASC, u.nome ASC`;

      const usuarios = await all(sql, params);
      return res.json(usuarios);
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async alterar(req, res) {
    try {
      const { id } = req.params;
      const { nome, email, senha, perfil, curso_id, curriculo_id, semestre_ingresso, cpf, matricula } = req.body;

      const atual = await get('SELECT * FROM TB_USUARIO WHERE id = ?', [id]);
      if (!atual) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      if (cpf && formatarCPF(cpf) !== atual.cpf) {
        return res.status(400).json({ erro: 'O CPF não pode ser alterado após o cadastro.' });
      }
      if (matricula && atual.matricula && String(matricula).trim() !== atual.matricula) {
        return res.status(400).json({ erro: 'O número de matrícula não pode ser alterado.' });
      }

      if (!validarNomeUsuario(nome)) {
        return res.status(400).json({
          erro: 'Informe o nome completo (nome e sobrenome, entre 5 e 100 letras).'
        });
      }
      if (!validarEmail(email)) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
      }

      const emailDuplicado = await get(
        'SELECT id FROM TB_USUARIO WHERE LOWER(email) = LOWER(?) AND id != ?',
        [email.trim(), id]
      );
      if (emailDuplicado) {
        return res.status(400).json({ erro: 'Este e-mail já está em uso por outra conta.' });
      }

      let novaSenhaHash = atual.senha_hash;
      if (senha && senha.trim() !== '') {
        if (!validarSenha(senha)) {
          return res.status(400).json({
            erro: 'A nova senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.'
          });
        }
        novaSenhaHash = bcrypt.hashSync(senha, 10);
      }

      const novoPerfil = perfil || atual.perfil;
      let cursoFinal = atual.curso_id;
      let currFinal = atual.curriculo_id;
      let semFinal = atual.semestre_ingresso;

      if (novoPerfil === 'Aluno (Discente)') {
        if (!curso_id || !curriculo_id || !validarSemestreIngresso(semestre_ingresso)) {
          return res.status(400).json({
            erro: 'Selecione o curso, a matriz curricular e o semestre de ingresso (ex: 2024.1).'
          });
        }
        cursoFinal = Number(curso_id);
        currFinal = Number(curriculo_id);
        semFinal = semestre_ingresso.trim();
      } else {
        cursoFinal = null;
        currFinal = null;
        semFinal = null;
      }

      await run(
        `UPDATE TB_USUARIO
         SET nome = ?, email = ?, senha_hash = ?, perfil = ?, curso_id = ?, curriculo_id = ?, semestre_ingresso = ?
         WHERE id = ?`,
        [nome.trim(), email.trim(), novaSenhaHash, novoPerfil, cursoFinal, currFinal, semFinal, id]
      );

      return res.json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async remover(req, res) {
    try {
      const { id } = req.params;
      const atual = await get('SELECT * FROM TB_USUARIO WHERE id = ?', [id]);
      if (!atual) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      if (atual.perfil === 'Administrador') {
        const qtdAdmins = await get(
          `SELECT COUNT(*) as total FROM TB_USUARIO WHERE perfil = 'Administrador'`
        );
        if (qtdAdmins.total <= 1) {
          return res.status(400).json({
            erro: 'Não é permitido remover o único administrador ativo do sistema.'
          });
        }
      }

      await run('DELETE FROM TB_TURMA_ALUNO WHERE usuario_id = ?', [id]);
      await run('DELETE FROM TB_GRADE_ALUNO WHERE usuario_id = ?', [id]);
      await run('DELETE FROM TB_USUARIO WHERE id = ?', [id]);

      return res.json({ mensagem: 'Conta removida com sucesso!' });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
};

app.post('/api/usuarios', usuarioController.incluir);
app.get('/api/usuarios', usuarioController.consultar);
app.put('/api/usuarios/:id', usuarioController.alterar);
app.delete('/api/usuarios/:id', usuarioController.remover);

// ============================================================================
// CATÁLOGO DE CURSOS DE GRADUAÇÃO (cursoController)
// ============================================================================
const INSTITUTOS_VALIDOS = ['IESTI', 'IMC', 'IEPG', 'IEM', 'IEE', 'IRN', 'IFE', 'ICET'];
const GRAUS_VALIDOS = ['Bacharelado', 'Licenciatura', 'Tecnólogo'];
const TURNOS_VALIDOS = ['Integral', 'Noturno', 'Matutino', 'Vespertino'];

const cursoController = {
  async incluir(req, res) {
    try {
      const { codigo, nome, instituto, grau, turno, duracao_padrao, duracao_maxima } = req.body;

      if (!codigo || !/^[A-Z0-9]{3,10}$/.test(String(codigo).trim())) {
        return res.status(400).json({
          erro: 'O código do curso deve ter de 3 a 10 letras maiúsculas ou números (ex: CCO, SIN).'
        });
      }
      if (!nome || String(nome).trim().length < 5 || String(nome).trim().length > 100) {
        return res.status(400).json({
          erro: 'O nome do curso deve ter entre 5 e 100 caracteres.'
        });
      }
      if (!INSTITUTOS_VALIDOS.includes(instituto)) {
        return res.status(400).json({ erro: 'Selecione um instituto válido da UNIFEI.' });
      }
      if (!GRAUS_VALIDOS.includes(grau)) {
        return res.status(400).json({ erro: 'Selecione um grau acadêmico válido.' });
      }
      if (!TURNOS_VALIDOS.includes(turno)) {
        return res.status(400).json({ erro: 'Selecione um turno válido.' });
      }

      const dPadrao = Number(duracao_padrao);
      const dMaxima = Number(duracao_maxima);
      if (!Number.isInteger(dPadrao) || dPadrao < 4 || dPadrao > 12) {
        return res.status(400).json({
          erro: 'A duração ideal deve ser entre 4 e 12 semestres.'
        });
      }
      if (!Number.isInteger(dMaxima) || dMaxima < 6 || dMaxima > 18 || dMaxima < dPadrao) {
        return res.status(400).json({
          erro: 'O prazo máximo deve ser entre 6 e 18 semestres e maior ou igual à duração ideal.'
        });
      }

      const existeCod = await get('SELECT id FROM TB_CURSO WHERE codigo = ?', [codigo.trim()]);
      if (existeCod) {
        return res.status(400).json({
          erro: 'Já existe um curso cadastrado com este código.'
        });
      }

      const existeNomeTurno = await get(
        'SELECT id FROM TB_CURSO WHERE LOWER(nome) = LOWER(?) AND turno = ?',
        [nome.trim(), turno]
      );
      if (existeNomeTurno) {
        return res.status(400).json({
          erro: 'Já existe um curso com este nome no mesmo turno.'
        });
      }

      const result = await run(
        `INSERT INTO TB_CURSO (codigo, nome, instituto, grau, turno, duracao_padrao, duracao_maxima)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [codigo.trim(), nome.trim(), instituto, grau, turno, dPadrao, dMaxima]
      );

      await run(
        `INSERT INTO TB_CURRICULO (codigo, curso_id, ano_semestre, status) VALUES (?, ?, ?, ?)`,
        [`${codigo.trim()}-2026`, result.lastID, '2026.1', 'Ativo (Vigente)']
      );

      return res.status(201).json({
        mensagem: 'Curso cadastrado com sucesso!',
        id: result.lastID
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async consultar(req, res) {
    try {
      const { instituto, turno, busca } = req.query;
      let sql = `SELECT * FROM TB_CURSO WHERE 1=1`;
      const params = [];

      if (instituto && instituto !== 'TODOS') {
        sql += ` AND instituto = ?`;
        params.push(instituto);
      }
      if (turno && turno !== 'TODOS') {
        sql += ` AND turno = ?`;
        params.push(turno);
      }
      if (busca && busca !== 'TODOS') {
        sql += ` AND (LOWER(nome) LIKE LOWER(?) OR LOWER(codigo) LIKE LOWER(?))`;
        params.push(`%${busca.trim()}%`, `%${busca.trim()}%`);
      }

      sql += ` ORDER BY instituto ASC, nome ASC`;

      const cursos = await all(sql, params);
      return res.json(cursos);
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async alterar(req, res) {
    try {
      const { id } = req.params;
      const { codigo, nome, instituto, grau, turno, duracao_padrao, duracao_maxima } = req.body;

      const atual = await get('SELECT * FROM TB_CURSO WHERE id = ?', [id]);
      if (!atual) {
        return res.status(404).json({ erro: 'Curso não encontrado.' });
      }

      if (codigo && codigo.trim() !== atual.codigo) {
        return res.status(400).json({ erro: 'O código do curso não pode ser alterado.' });
      }

      if (!nome || String(nome).trim().length < 5 || String(nome).trim().length > 100) {
        return res.status(400).json({ erro: 'O nome do curso deve ter entre 5 e 100 caracteres.' });
      }
      if (!INSTITUTOS_VALIDOS.includes(instituto)) {
        return res.status(400).json({ erro: 'Instituto inválido.' });
      }
      if (!GRAUS_VALIDOS.includes(grau)) {
        return res.status(400).json({ erro: 'Grau acadêmico inválido.' });
      }
      if (!TURNOS_VALIDOS.includes(turno)) {
        return res.status(400).json({ erro: 'Turno inválido.' });
      }

      const dPadrao = Number(duracao_padrao);
      const dMaxima = Number(duracao_maxima);
      if (!Number.isInteger(dPadrao) || dPadrao < 4 || dPadrao > 12) {
        return res.status(400).json({ erro: 'A duração ideal deve ser entre 4 e 12 semestres.' });
      }
      if (!Number.isInteger(dMaxima) || dMaxima < 6 || dMaxima > 18 || dMaxima < dPadrao) {
        return res.status(400).json({
          erro: 'O prazo máximo deve ser entre 6 e 18 semestres e maior ou igual à duração ideal.'
        });
      }

      await run(
        `UPDATE TB_CURSO
         SET nome = ?, instituto = ?, grau = ?, turno = ?, duracao_padrao = ?, duracao_maxima = ?
         WHERE id = ?`,
        [nome.trim(), instituto, grau, turno, dPadrao, dMaxima, id]
      );

      return res.json({ mensagem: 'Curso atualizado com sucesso!' });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async remover(req, res) {
    try {
      const { id } = req.params;
      const atual = await get('SELECT * FROM TB_CURSO WHERE id = ?', [id]);
      if (!atual) {
        return res.status(404).json({ erro: 'Curso não encontrado.' });
      }

      const alunosDep = await get('SELECT COUNT(*) as total FROM TB_USUARIO WHERE curso_id = ?', [id]);
      const currDep = await get('SELECT COUNT(*) as total FROM TB_CURRICULO WHERE curso_id = ?', [id]);

      if (alunosDep.total > 0) {
        return res.status(400).json({
          erro: `Não é possível excluir o curso ${atual.codigo} pois existem ${alunosDep.total} aluno(s) e ${currDep.total} matriz(es) vinculados a ele.`
        });
      }

      await run('DELETE FROM TB_CURRICULO WHERE curso_id = ?', [id]);
      await run('DELETE FROM TB_CURSO WHERE id = ?', [id]);

      return res.json({ mensagem: 'Curso removido com sucesso!' });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
};

app.post('/api/cursos', cursoController.incluir);
app.get('/api/cursos', cursoController.consultar);
app.put('/api/cursos/:id', cursoController.alterar);
app.delete('/api/cursos/:id', cursoController.remover);

app.get('/api/curriculos', async (req, res) => {
  try {
    const { curso_id } = req.query;
    let sql = 'SELECT * FROM TB_CURRICULO WHERE 1=1';
    const params = [];
    if (curso_id) {
      sql += ' AND curso_id = ?';
      params.push(Number(curso_id));
    }
    const rows = await all(sql, params);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// ============================================================================
// GRADE CURRICULAR: CRUD DE DISCIPLINAS (disciplinaController)
// ============================================================================
const disciplinaController = {
  async incluir(req, res) {
    try {
      const { codigo, nome, curso_id, semestre_ideal, ch_total, docente, sala, horarios, cor } = req.body;

      if (!codigo || !/^[A-Z0-9]{4,10}$/.test(String(codigo).trim().toUpperCase())) {
        return res.status(400).json({
          erro: 'O código da disciplina deve ter de 4 a 10 letras/números (ex: SDES06, COM210).'
        });
      }
      if (!nome || String(nome).trim().length < 4 || String(nome).trim().length > 100) {
        return res.status(400).json({ erro: 'Informe o nome completo da disciplina.' });
      }
      if (!curso_id) {
        return res.status(400).json({ erro: 'Selecione o curso da disciplina.' });
      }
      if (!horarios || String(horarios).trim() === '') {
        return res.status(400).json({ erro: 'Informe os horários da disciplina (ex: SEG-M1,SEG-M2).' });
      }

      const codFormatado = String(codigo).trim().toUpperCase();
      const existe = await get('SELECT id FROM TB_DISCIPLINA WHERE codigo = ?', [codFormatado]);
      if (existe) {
        return res.status(400).json({ erro: 'Já existe uma disciplina cadastrada com este código.' });
      }

      const result = await run(
        `INSERT INTO TB_DISCIPLINA (codigo, nome, curso_id, semestre_ideal, ch_total, docente, sala, horarios, cor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          codFormatado,
          String(nome).trim(),
          Number(curso_id),
          Number(semestre_ideal) || 1,
          Number(ch_total) || 64,
          docente ? String(docente).trim() : 'Docente a definir',
          sala ? String(sala).trim() : 'Sala a definir',
          String(horarios).trim().toUpperCase(),
          cor || '#2563eb'
        ]
      );

      return res.status(201).json({
        mensagem: 'Disciplina adicionada à grade curricular!',
        id: result.lastID
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async consultar(req, res) {
    try {
      const { curso_id, busca } = req.query;
      let sql = `
        SELECT d.*, c.codigo as curso_codigo, c.nome as curso_nome
        FROM TB_DISCIPLINA d
        LEFT JOIN TB_CURSO c ON d.curso_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (curso_id && curso_id !== 'TODOS') {
        sql += ` AND d.curso_id = ?`;
        params.push(Number(curso_id));
      }
      if (busca && busca.trim() !== '') {
        sql += ` AND (LOWER(d.nome) LIKE LOWER(?) OR LOWER(d.codigo) LIKE LOWER(?))`;
        params.push(`%${busca.trim()}%`, `%${busca.trim()}%`);
      }

      sql += ` ORDER BY d.semestre_ideal ASC, d.codigo ASC`;
      const rows = await all(sql, params);
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async alterar(req, res) {
    try {
      const { id } = req.params;
      const { nome, curso_id, semestre_ideal, ch_total, docente, sala, horarios, cor } = req.body;

      const atual = await get('SELECT * FROM TB_DISCIPLINA WHERE id = ?', [id]);
      if (!atual) {
        return res.status(404).json({ erro: 'Disciplina não encontrada.' });
      }
      if (!nome || String(nome).trim().length < 4) {
        return res.status(400).json({ erro: 'Informe um nome válido para a disciplina.' });
      }
      if (!horarios || String(horarios).trim() === '') {
        return res.status(400).json({ erro: 'Informe os horários da disciplina.' });
      }

      const novoNome = String(nome).trim();
      const novoCursoId = curso_id ? Number(curso_id) : atual.curso_id;
      const novoSem = Number(semestre_ideal) || atual.semestre_ideal;
      const novaCh = Number(ch_total) || atual.ch_total;
      const novoDocente = docente ? String(docente).trim() : atual.docente;
      const novaSala = sala ? String(sala).trim() : atual.sala;
      const novosHorarios = String(horarios).trim().toUpperCase();
      const novaCor = cor || atual.cor;

      await run(
        `UPDATE TB_DISCIPLINA
         SET nome = ?, curso_id = ?, semestre_ideal = ?, ch_total = ?, docente = ?, sala = ?, horarios = ?, cor = ?
         WHERE id = ?`,
        [novoNome, novoCursoId, novoSem, novaCh, novoDocente, novaSala, novosHorarios, novaCor, id]
      );

      // Atualiza também os registros vinculados dos alunos para refletir alterações de sala/docente/horário
      await run(
        `UPDATE TB_TURMA_ALUNO
         SET nome = ?, ch_total = ?, docente = ?, sala = ?, horarios = ?, cor = ?
         WHERE disciplina_id = ?`,
        [novoNome, novaCh, novoDocente, novaSala, novosHorarios, novaCor, id]
      );

      return res.json({ mensagem: 'Disciplina atualizada com sucesso!' });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  },

  async remover(req, res) {
    try {
      const { id } = req.params;
      const atual = await get('SELECT * FROM TB_DISCIPLINA WHERE id = ?', [id]);
      if (!atual) {
        return res.status(404).json({ erro: 'Disciplina não encontrada.' });
      }

      await run('DELETE FROM TB_TURMA_ALUNO WHERE disciplina_id = ?', [id]);
      await run('DELETE FROM TB_DISCIPLINA WHERE id = ?', [id]);
      return res.json({ mensagem: 'Disciplina removida da grade curricular!' });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }
};

app.post('/api/disciplinas', disciplinaController.incluir);
app.get('/api/disciplinas', disciplinaController.consultar);
app.put('/api/disciplinas/:id', disciplinaController.alterar);
app.delete('/api/disciplinas/:id', disciplinaController.remover);

// ============================================================================
// DISCIPLINAS, HORÁRIOS E PROGRESSO DO ALUNO (turmaAlunoController)
// ============================================================================
app.get('/api/turmas', async (req, res) => {
  try {
    const usuarioId = Number(req.query.usuario_id);
    if (!usuarioId) {
      return res.status(400).json({ erro: 'Informe o identificador do aluno.' });
    }
    await seedTurmasAluno(usuarioId);
    const turmas = await all(
      `SELECT * FROM TB_TURMA_ALUNO WHERE usuario_id = ? AND situacao = 'Cursando' ORDER BY codigo ASC`,
      [usuarioId]
    );
    return res.json(turmas);
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// Retorna o panorama completo da grade do aluno: Finalizadas, Fazendo no semestre e Ainda faltam
app.get('/api/aluno/progresso', async (req, res) => {
  try {
    const usuarioId = Number(req.query.usuario_id);
    if (!usuarioId) {
      return res.status(400).json({ erro: 'Informe o identificador do aluno.' });
    }
    await seedTurmasAluno(usuarioId);

    const aluno = await get('SELECT * FROM TB_USUARIO WHERE id = ?', [usuarioId]);
    const cursoId = aluno && aluno.curso_id ? aluno.curso_id : 1;

    const catalogoCurso = await all(
      'SELECT * FROM TB_DISCIPLINA WHERE curso_id = ? ORDER BY semestre_ideal ASC, codigo ASC',
      [cursoId]
    );
    const turmasAluno = await all(
      'SELECT * FROM TB_TURMA_ALUNO WHERE usuario_id = ? ORDER BY codigo ASC',
      [usuarioId]
    );

    const fazendo = turmasAluno.filter((t) => t.situacao === 'Cursando');
    const finalizadas = turmasAluno.filter((t) => t.situacao === 'Finalizada');

    const codigosVinculados = new Set(turmasAluno.map((t) => t.codigo));
    const faltam = catalogoCurso.filter((d) => !codigosVinculados.has(d.codigo));

    return res.json({
      fazendo,
      finalizadas,
      faltam
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// Aluno adiciona uma disciplina da grade curricular para cursar no semestre atual
app.post('/api/turmas', async (req, res) => {
  try {
    const { usuario_id, disciplina_id } = req.body;
    if (!usuario_id || !disciplina_id) {
      return res.status(400).json({ erro: 'Selecione uma disciplina da sua grade para adicionar.' });
    }

    const disc = await get('SELECT * FROM TB_DISCIPLINA WHERE id = ?', [disciplina_id]);
    if (!disc) {
      return res.status(404).json({ erro: 'Disciplina não encontrada na grade curricular.' });
    }

    const existente = await get(
      'SELECT * FROM TB_TURMA_ALUNO WHERE usuario_id = ? AND codigo = ?',
      [usuario_id, disc.codigo]
    );

    if (existente) {
      if (existente.situacao === 'Cursando') {
        return res.status(400).json({ erro: 'Esta disciplina já está na sua grade deste semestre.' });
      }
      await run(
        `UPDATE TB_TURMA_ALUNO SET situacao = 'Cursando', faltas_horas = 0 WHERE id = ?`,
        [existente.id]
      );
      return res.json({ mensagem: `Disciplina ${disc.codigo} adicionada ao seu semestre!` });
    }

    const result = await run(
      `INSERT INTO TB_TURMA_ALUNO (usuario_id, disciplina_id, codigo, nome, docente, sala, ch_total, faltas_horas, horarios, cor, situacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Cursando')`,
      [
        Number(usuario_id),
        disc.id,
        disc.codigo,
        disc.nome,
        disc.docente,
        disc.sala,
        disc.ch_total,
        disc.horarios,
        disc.cor
      ]
    );

    return res.status(201).json({
      mensagem: `Disciplina ${disc.codigo} adicionada ao seu semestre!`,
      id: result.lastID
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

app.post('/api/turmas/:id/falta', async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    const incremento = Number.isInteger(Number(delta)) && Number(delta) !== 0 ? Number(delta) : 1;

    const turma = await get('SELECT * FROM TB_TURMA_ALUNO WHERE id = ?', [id]);
    if (!turma) {
      return res.status(404).json({ erro: 'Disciplina não encontrada.' });
    }

    const novasFaltas = Math.max(0, Math.min(turma.ch_total, turma.faltas_horas + incremento));
    await run('UPDATE TB_TURMA_ALUNO SET faltas_horas = ? WHERE id = ?', [novasFaltas, id]);

    const atualizada = await get('SELECT * FROM TB_TURMA_ALUNO WHERE id = ?', [id]);
    return res.json({
      mensagem: incremento > 0 ? 'Falta adicionada na disciplina.' : 'Falta removida da disciplina.',
      turma: atualizada
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// Aluno marca a disciplina como Finalizada (concluída)
app.post('/api/turmas/:id/finalizar', async (req, res) => {
  try {
    const { id } = req.params;
    const turma = await get('SELECT * FROM TB_TURMA_ALUNO WHERE id = ?', [id]);
    if (!turma) {
      return res.status(404).json({ erro: 'Disciplina não encontrada.' });
    }

    await run(`UPDATE TB_TURMA_ALUNO SET situacao = 'Finalizada' WHERE id = ?`, [id]);
    return res.json({
      mensagem: `Parabéns! ${turma.codigo} foi movida para suas disciplinas finalizadas.`
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

// Aluno retira a disciplina do semestre atual (volta para "Ainda falta")
app.delete('/api/turmas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const turma = await get('SELECT * FROM TB_TURMA_ALUNO WHERE id = ?', [id]);
    if (!turma) {
      return res.status(404).json({ erro: 'Disciplina não encontrada.' });
    }

    await run('DELETE FROM TB_TURMA_ALUNO WHERE id = ?', [id]);
    return res.json({
      mensagem: `Disciplina ${turma.codigo} retirada do semestre atual.`
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

app.post('/api/test/reset', async (req, res) => {
  try {
    await run('DELETE FROM TB_TURMA_ALUNO');
    await run('DELETE FROM TB_GRADE_ALUNO');
    await run('DELETE FROM TB_DISCIPLINA');
    await run('DELETE FROM TB_USUARIO');
    await run('DELETE FROM TB_CURRICULO');
    await run('DELETE FROM TB_CURSO');
    await seedInitialData();
    return res.json({ mensagem: 'Dados restaurados com sucesso.' });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Desenrola Aluno rodando em http://localhost:${PORT}`);
  });
});
