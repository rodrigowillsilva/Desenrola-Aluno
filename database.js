const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'desenrola.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS TB_CURSO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      instituto TEXT NOT NULL,
      grau TEXT NOT NULL,
      turno TEXT NOT NULL,
      duracao_padrao INTEGER NOT NULL,
      duracao_maxima INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS TB_CURRICULO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      curso_id INTEGER NOT NULL,
      ano_semestre TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Ativo (Vigente)',
      ch_obrigatoria INTEGER NOT NULL DEFAULT 2400,
      ch_optativa INTEGER NOT NULL DEFAULT 240,
      ch_complementar INTEGER NOT NULL DEFAULT 160,
      FOREIGN KEY (curso_id) REFERENCES TB_CURSO(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS TB_USUARIO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL,
      matricula TEXT UNIQUE,
      curso_id INTEGER,
      curriculo_id INTEGER,
      semestre_ingresso TEXT,
      FOREIGN KEY (curso_id) REFERENCES TB_CURSO(id),
      FOREIGN KEY (curriculo_id) REFERENCES TB_CURRICULO(id)
    )
  `);

  // Catálogo Oficial de Disciplinas da Grade Curricular (gerenciado pelo Administrador)
  await run(`
    CREATE TABLE IF NOT EXISTS TB_DISCIPLINA (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      curso_id INTEGER NOT NULL,
      semestre_ideal INTEGER NOT NULL DEFAULT 1,
      ch_total INTEGER NOT NULL DEFAULT 64,
      docente TEXT NOT NULL,
      sala TEXT NOT NULL,
      horarios TEXT NOT NULL,
      cor TEXT NOT NULL DEFAULT '#2563eb',
      FOREIGN KEY (curso_id) REFERENCES TB_CURSO(id)
    )
  `);

  // Vínculo de Disciplinas do Aluno no Semestre Atual e Histórico
  // situacao: 'Cursando' | 'Finalizada'
  await run(`
    CREATE TABLE IF NOT EXISTS TB_TURMA_ALUNO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      disciplina_id INTEGER,
      codigo TEXT NOT NULL,
      nome TEXT NOT NULL,
      docente TEXT NOT NULL,
      sala TEXT NOT NULL,
      ch_total INTEGER NOT NULL DEFAULT 64,
      faltas_horas INTEGER NOT NULL DEFAULT 0,
      horarios TEXT NOT NULL,
      cor TEXT NOT NULL DEFAULT '#2563eb',
      situacao TEXT NOT NULL DEFAULT 'Cursando',
      FOREIGN KEY (usuario_id) REFERENCES TB_USUARIO(id) ON DELETE CASCADE,
      FOREIGN KEY (disciplina_id) REFERENCES TB_DISCIPLINA(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS TB_GRADE_ALUNO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      codigo_disciplina TEXT NOT NULL,
      situacao TEXT NOT NULL DEFAULT 'Pendente',
      semestre_cursado TEXT,
      nota_final REAL,
      FOREIGN KEY (usuario_id) REFERENCES TB_USUARIO(id) ON DELETE CASCADE
    )
  `);

  // Release 02: Tabela relacional de pre-requisitos entre disciplinas (N:N)
  await run(`
    CREATE TABLE IF NOT EXISTS TB_PRE_REQUISITO (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      disciplina_id INTEGER NOT NULL,
      prerequisito_id INTEGER NOT NULL,
      UNIQUE (disciplina_id, prerequisito_id),
      FOREIGN KEY (disciplina_id) REFERENCES TB_DISCIPLINA(id) ON DELETE CASCADE,
      FOREIGN KEY (prerequisito_id) REFERENCES TB_DISCIPLINA(id) ON DELETE CASCADE
    )
  `);

  await adicionarColunaSeNaoExistir('TB_DISCIPLINA', 'tipo', "TEXT NOT NULL DEFAULT 'Obrigatória'");
  await adicionarColunaSeNaoExistir('TB_CURRICULO', 'ch_total', 'INTEGER NOT NULL DEFAULT 3200');

  await seedInitialData();
}


async function adicionarColunaSeNaoExistir(tabela, coluna, definicao) {
  const colunas = await all(`PRAGMA table_info(${tabela})`);
  if (!colunas.some((c) => c.name === coluna)) {
    await run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}
async function seedInitialData() {
  const countCursos = await get('SELECT COUNT(*) as total FROM TB_CURSO');
  let sinId = null;
  let ccoId = null;

  if (countCursos.total === 0) {
    const sin = await run(
      `INSERT INTO TB_CURSO (codigo, nome, instituto, grau, turno, duracao_padrao, duracao_maxima)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['SIN', 'Sistemas de Informação', 'IESTI', 'Bacharelado', 'Integral', 8, 12]
    );
    const cco = await run(
      `INSERT INTO TB_CURSO (codigo, nome, instituto, grau, turno, duracao_padrao, duracao_maxima)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['CCO', 'Ciência da Computação', 'IESTI', 'Bacharelado', 'Integral', 8, 12]
    );
    const eco = await run(
      `INSERT INTO TB_CURSO (codigo, nome, instituto, grau, turno, duracao_padrao, duracao_maxima)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['ECO', 'Engenharia de Computação', 'IESTI', 'Bacharelado', 'Integral', 10, 15]
    );

    sinId = sin.lastID;
    ccoId = cco.lastID;

    const sqlCurr = `INSERT INTO TB_CURRICULO (codigo, curso_id, ano_semestre, status, ch_obrigatoria, ch_optativa, ch_complementar, ch_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    await run(sqlCurr, ['SIN-2023', sin.lastID, '2023.1', 'Ativo (Vigente)', 2720, 256, 224, 3200]);
    await run(sqlCurr, ['CCO-2023', cco.lastID, '2023.1', 'Ativo (Vigente)', 2880, 192, 200, 3272]);
    await run(sqlCurr, ['ECO-2023', eco.lastID, '2023.1', 'Ativo (Vigente)', 3360, 192, 240, 3792]);
    const cSin = await get('SELECT id FROM TB_CURSO WHERE codigo = ?', ['SIN']);
    const cCco = await get('SELECT id FROM TB_CURSO WHERE codigo = ?', ['CCO']);
    sinId = cSin ? cSin.id : 1;
    ccoId = cCco ? cCco.id : 2;
  }

  // Semeia o Catálogo da Grade Curricular (TB_DISCIPLINA)
  const countDisc = await get('SELECT COUNT(*) as total FROM TB_DISCIPLINA');
  if (countDisc.total === 0) {
    const catalogoDisciplinas = [
      // 1º e 2º Semestres (serão semeadas como Finalizadas para o aluno padrão)
      {
        codigo: 'COM110',
        nome: 'Fundamentos de Programação',
        curso_id: sinId,
        semestre_ideal: 1,
        ch_total: 64,
        docente: 'Prof. Edmilson Marmo',
        sala: 'Lab I.1.1.01 (IESTI)',
        horarios: 'SEG-M1,SEG-M2,QUA-M1,QUA-M2',
        cor: '#0284c7'
      },
      {
        codigo: 'MAT001',
        nome: 'Cálculo I',
        curso_id: sinId,
        semestre_ideal: 1,
        ch_total: 96,
        docente: 'Prof. Marcos Tadeu',
        sala: 'B.1.2.01 (IMC)',
        horarios: 'TER-M1,TER-M2,QUI-M1,QUI-M2',
        cor: '#4f46e5'
      },
      {
        codigo: 'COM111',
        nome: 'Algoritmos e Estruturas de Dados I',
        curso_id: sinId,
        semestre_ideal: 2,
        ch_total: 64,
        docente: 'Prof. Rafael Frinhani',
        sala: 'Lab I.1.1.03 (IESTI)',
        horarios: 'SEG-T3,SEG-T4,QUA-T3,QUA-T4',
        cor: '#059669'
      },
      // Semestre Atual (serão semeadas como Cursando para o aluno padrão)
      {
        codigo: 'SDES06',
        nome: 'Gerência de Projetos de Software',
        curso_id: sinId,
        semestre_ideal: 6,
        ch_total: 64,
        docente: 'Prof. Roberto Affonso',
        sala: 'I.1.2.05 (IESTI)',
        horarios: 'SEG-M1,SEG-M2,QUA-M1,QUA-M2',
        cor: '#2563eb'
      },
      {
        codigo: 'COM210',
        nome: 'Engenharia de Software II',
        curso_id: sinId,
        semestre_ideal: 5,
        ch_total: 64,
        docente: 'Prof. Adler Diniz',
        sala: 'I.1.2.03 (IESTI)',
        horarios: 'TER-M4,TER-M5,QUI-M4,QUI-M5',
        cor: '#0d9488'
      },
      {
        codigo: 'COM112',
        nome: 'Algoritmos e Estruturas de Dados II',
        curso_id: sinId,
        semestre_ideal: 3,
        ch_total: 64,
        docente: 'Prof. Vanessa Cristina',
        sala: 'Lab I.1.1.02 (IESTI)',
        horarios: 'SEG-T1,SEG-T2,QUA-T1,QUA-T2',
        cor: '#7c3aed'
      },
      {
        codigo: 'SIN310',
        nome: 'Sistemas Distribuídos',
        curso_id: sinId,
        semestre_ideal: 6,
        ch_total: 64,
        docente: 'Prof. Bruno Tardiole',
        sala: 'I.1.2.08 (IESTI)',
        horarios: 'TER-T3,TER-T4,SEX-T3,SEX-T4',
        cor: '#d97706'
      },
      {
        codigo: 'MAT013',
        nome: 'Probabilidade e Estatística',
        curso_id: sinId,
        semestre_ideal: 4,
        ch_total: 48,
        docente: 'Prof. Paulo César',
        sala: 'B.2.1.04 (IMC)',
        horarios: 'SEX-M1,SEX-M2,SEX-M3',
        cor: '#e11d48'
      },
      // Disciplinas que ainda Faltam na grade do aluno (disponíveis para adicionar no semestre)
      {
        codigo: 'COM220',
        nome: 'Banco de Dados I',
        curso_id: sinId,
        semestre_ideal: 4,
        ch_total: 64,
        docente: 'Prof. Melise Maria',
        sala: 'I.1.2.06 (IESTI)',
        horarios: 'SEG-M4,SEG-M5,QUA-M4,QUA-M5',
        cor: '#0891b2'
      },
      {
        codigo: 'COM240',
        nome: 'Redes de Computadores',
        curso_id: sinId,
        semestre_ideal: 5,
        ch_total: 64,
        docente: 'Prof. José Alberto',
        sala: 'I.1.2.09 (IESTI)',
        horarios: 'TER-M1,TER-M2,QUI-M1,QUI-M2',
        cor: '#9333ea'
      },
      {
        codigo: 'SIN412',
        nome: 'Inteligência Artificial',
        curso_id: sinId,
        semestre_ideal: 7,
        ch_total: 64,
        docente: 'Prof. Carlos Eduardo',
        sala: 'I.1.2.10 (IESTI)',
        horarios: 'QUI-T1,QUI-T2,SEX-T1,SEX-T2',
        cor: '#ea580c'
      },
      {
        codigo: 'IEPG22',
        nome: 'Empreendedorismo e Inovação',
        curso_id: sinId,
        semestre_ideal: 8,
        ch_total: 48,
        docente: 'Prof. Sandra Miranda',
        sala: 'Sala 204 (IEPG)',
        horarios: 'QUA-T3,QUA-T4,QUA-T5',
        cor: '#16a34a'
      },
      // Disciplinas Optativas do curriculo SIN (Release 02)
      {
        codigo: 'SIN430',
        nome: 'Desenvolvimento para Dispositivos Móveis',
        curso_id: sinId,
        semestre_ideal: 6,
        ch_total: 64,
        docente: 'Prof. Rafael Frinhani',
        sala: 'Lab I.1.1.04 (IESTI)',
        horarios: 'QUI-T3,QUI-T4,SEX-M4,SEX-M5',
        cor: '#0f766e',
        tipo: 'Optativa'
      },
      {
        codigo: 'SIN420',
        nome: 'Computação em Nuvem',
        curso_id: sinId,
        semestre_ideal: 7,
        ch_total: 64,
        docente: 'Prof. Bruno Tardiole',
        sala: 'Lab I.1.1.05 (IESTI)',
        horarios: 'TER-T1,TER-T2,QUI-M4,QUI-M5',
        cor: '#be123c',
        tipo: 'Optativa'
      },
      {
        codigo: 'SIN440',
        nome: 'Visão Computacional',
        curso_id: sinId,
        semestre_ideal: 8,
        ch_total: 32,
        docente: 'Prof. Carlos Eduardo',
        sala: 'I.1.2.10 (IESTI)',
        horarios: 'SEG-T3,SEG-T4',
        cor: '#a16207',
        tipo: 'Optativa'
      },
      // Disciplina de CCO para demonstrar vínculo por curso
      {
        codigo: 'COM310',
        nome: 'Compiladores',
        curso_id: ccoId,
        semestre_ideal: 6,
        ch_total: 64,
        docente: 'Prof. Luiz Olmes',
        sala: 'I.1.2.04 (IESTI)',
        horarios: 'TER-T1,TER-T2,QUI-T1,QUI-T2',
        cor: '#2563eb'
      }
    ];

    for (const d of catalogoDisciplinas) {
      await run(
        `INSERT INTO TB_DISCIPLINA (codigo, nome, curso_id, semestre_ideal, ch_total, docente, sala, horarios, cor, tipo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.codigo, d.nome, d.curso_id, d.semestre_ideal, d.ch_total, d.docente, d.sala, d.horarios, d.cor, d.tipo || 'Obrigatória']
      );
    }
  }

    // Pré-requisitos curriculares do curso SIN (Release 02)
    const preRequisitos = [
      ['COM111', 'COM110'],
      ['COM112', 'COM111'],
      ['MAT013', 'MAT001'],
      ['COM210', 'COM111'],
      ['COM220', 'COM112'],
      ['COM240', 'COM111'],
      ['SIN310', 'COM240'],
      ['SDES06', 'COM210'],
      ['SIN412', 'COM112'],
      ['SIN412', 'MAT013'],
      ['SIN430', 'COM112'],
      ['SIN420', 'SIN310'],
      ['SIN440', 'SIN412']
    ];
    for (const [cod, codPre] of preRequisitos) {
      const disc = await get('SELECT id FROM TB_DISCIPLINA WHERE codigo = ?', [cod]);
      const pre = await get('SELECT id FROM TB_DISCIPLINA WHERE codigo = ?', [codPre]);
      if (disc && pre) {
        await run('INSERT OR IGNORE INTO TB_PRE_REQUISITO (disciplina_id, prerequisito_id) VALUES (?, ?)', [disc.id, pre.id]);
      }
    }

  const countUsers = await get('SELECT COUNT(*) as total FROM TB_USUARIO');
  if (countUsers.total === 0) {
    const senhaAdmin = bcrypt.hashSync('Admin123', 10);
    const senhaAluno = bcrypt.hashSync('Aluno123', 10);

    await run(
      `INSERT INTO TB_USUARIO (nome, cpf, email, senha_hash, perfil)
       VALUES (?, ?, ?, ?, ?)`,
      ['Rodrigo William Admin', '111.444.777-35', 'admin@unifei.edu.br', senhaAdmin, 'Administrador']
    );

    const currSin = await get('SELECT id FROM TB_CURRICULO WHERE codigo = ?', ['SIN-2023']);

    const aluno = await run(
      `INSERT INTO TB_USUARIO (nome, cpf, email, senha_hash, perfil, matricula, curso_id, curriculo_id, semestre_ingresso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Lucas Margelo Discente',
        '529.982.247-25',
        'aluno@unifei.edu.br',
        senhaAluno,
        'Aluno (Discente)',
        '2022001234',
        sinId,
        currSin ? currSin.id : null,
        '2022.1'
      ]
    );

    await run(
      `INSERT INTO TB_GRADE_ALUNO (usuario_id, codigo_disciplina, situacao) VALUES (?, ?, ?)`,
      [aluno.lastID, 'SDES06', 'Pendente']
    );

    await seedTurmasAluno(aluno.lastID);
  }
}

async function seedTurmasAluno(usuarioId) {
  const existentes = await get('SELECT COUNT(*) as total FROM TB_TURMA_ALUNO WHERE usuario_id = ?', [usuarioId]);
  if (existentes.total > 0) return;

  // Semeia 3 matérias já Finalizadas e 5 matérias que o aluno está Fazendo no semestre
  const codigosFinalizadas = ['COM110', 'MAT001', 'COM111'];
  const codigosCursando = [
    { codigo: 'SDES06', faltas: 2 },
    { codigo: 'COM210', faltas: 4 },
    { codigo: 'COM112', faltas: 0 },
    { codigo: 'SIN310', faltas: 6 },
    { codigo: 'MAT013', faltas: 0 }
  ];

  for (const cod of codigosFinalizadas) {
    const disc = await get('SELECT * FROM TB_DISCIPLINA WHERE codigo = ?', [cod]);
    if (disc) {
      await run(
        `INSERT INTO TB_TURMA_ALUNO (usuario_id, disciplina_id, codigo, nome, docente, sala, ch_total, faltas_horas, horarios, cor, situacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Finalizada')`,
        [usuarioId, disc.id, disc.codigo, disc.nome, disc.docente, disc.sala, disc.ch_total, 0, disc.horarios, disc.cor]
      );
    }
  }

  for (const item of codigosCursando) {
    const disc = await get('SELECT * FROM TB_DISCIPLINA WHERE codigo = ?', [item.codigo]);
    if (disc) {
      await run(
        `INSERT INTO TB_TURMA_ALUNO (usuario_id, disciplina_id, codigo, nome, docente, sala, ch_total, faltas_horas, horarios, cor, situacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cursando')`,
        [usuarioId, disc.id, disc.codigo, disc.nome, disc.docente, disc.sala, disc.ch_total, item.faltas, disc.horarios, disc.cor]
      );
    }
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
  seedInitialData,
  seedTurmasAluno
};
