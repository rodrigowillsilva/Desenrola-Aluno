// Estado global da sessão no aplicativo
let usuarioLogado = null;
let modoAutoCadastro = false;
let listaCursosCache = [];
let listaUsuariosCache = [];
let listaDisciplinasCatalogoCache = [];
let turmasAlunoCache = [];
let progressoAlunoCache = { fazendo: [], finalizadas: [], faltam: [] };
let disciplinaSelecionada = null;

// ============================================================================
// DEFINIÇÃO DOS HORÁRIOS OFICIAIS DA UNIFEI (Aulas de 55 min - Seg a Sex)
// ============================================================================
const DIAS_SEMANA = [
  { id: 'SEG', label: 'Seg' },
  { id: 'TER', label: 'Ter' },
  { id: 'QUA', label: 'Qua' },
  { id: 'QUI', label: 'Qui' },
  { id: 'SEX', label: 'Sex' }
];

const SLOTS_UNIFEI = [
  { id: 'M1', hora: '07:00 - 07:55', inicio: '07:00', fim: '07:55' },
  { id: 'M2', hora: '07:55 - 08:50', inicio: '07:55', fim: '08:50' },
  { id: 'M3', hora: '08:50 - 09:45', inicio: '08:50', fim: '09:45' },
  { tipo: 'intervalo', texto: 'Intervalo • 09:45 às 10:10 (25 min)' },
  { id: 'M4', hora: '10:10 - 11:05', inicio: '10:10', fim: '11:05' },
  { id: 'M5', hora: '11:05 - 12:00', inicio: '11:05', fim: '12:00' },
  { tipo: 'intervalo', texto: 'Almoço • 12:00 às 13:30' },
  { id: 'T1', hora: '13:30 - 14:25', inicio: '13:30', fim: '14:25' },
  { id: 'T2', hora: '14:25 - 15:20', inicio: '14:25', fim: '15:20' },
  { tipo: 'intervalo', texto: 'Intervalo • 15:20 às 15:45 (25 min)' },
  { id: 'T3', hora: '15:45 - 16:40', inicio: '15:45', fim: '16:40' },
  { id: 'T4', hora: '16:40 - 17:35', inicio: '16:40', fim: '17:35' },
  { id: 'T5', hora: '17:35 - 18:30', inicio: '17:35', fim: '18:30' }
];

// ============================================================================
// FEEDBACK E NAVEGAÇÃO MOBILE
// ============================================================================
function exibirMensagem(texto, tipo = 'success') {
  const box = document.getElementById('feedback-alert');
  box.textContent = texto;
  box.className = `toast-alert ${tipo === 'error' ? 'alert-error' : 'alert-success'}`;
  box.classList.remove('hidden');
}

function limparMensagem() {
  const box = document.getElementById('feedback-alert');
  box.classList.add('hidden');
  box.textContent = '';
}

function preencherDemo(email, senha) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-senha').value = senha;
}

function ocultarTodasAsViews() {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-aluno-home').classList.add('hidden');
  document.getElementById('view-disciplina-detalhe').classList.add('hidden');
  document.getElementById('view-aluno-progresso').classList.add('hidden');
  document.getElementById('view-app').classList.add('hidden');
}

function irParaTelaInicialSeLogado() {
  if (!usuarioLogado) return;
  if (usuarioLogado.perfil === 'Administrador') {
    mostrarAba('usuarios');
  } else {
    voltarParaHomeAluno();
  }
}

function mostrarAba(aba) {
  limparMensagem();
  ocultarTodasAsViews();
  document.getElementById('view-app').classList.remove('hidden');

  const abaDisciplinas = document.getElementById('aba-disciplinas');
  const abaCursos = document.getElementById('aba-cursos');
  const abaUsuarios = document.getElementById('aba-usuarios');

  const tabDisciplinas = document.getElementById('tab-disciplinas');
  const tabCursos = document.getElementById('tab-cursos');
  const tabUsuarios = document.getElementById('tab-usuarios');

  abaDisciplinas.classList.add('hidden');
  abaCursos.classList.add('hidden');
  abaUsuarios.classList.add('hidden');

  tabDisciplinas.classList.remove('active');
  tabCursos.classList.remove('active');
  tabUsuarios.classList.remove('active');

  if (aba === 'disciplinas') {
    abaDisciplinas.classList.remove('hidden');
    tabDisciplinas.classList.add('active');
    consultarDisciplinasCatalogo();
  } else if (aba === 'cursos') {
    abaCursos.classList.remove('hidden');
    tabCursos.classList.add('active');
    consultarCursos();
  } else {
    abaUsuarios.classList.remove('hidden');
    tabUsuarios.classList.add('active');
    consultarUsuarios();
  }
}

// ============================================================================
// LOGIN, LOGOUT E SESSÃO
// ============================================================================
async function submeterLogin(event) {
  event.preventDefault();
  limparMensagem();

  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const dados = await resp.json();

    if (!resp.ok) {
      exibirMensagem(dados.erro || 'Não foi possível entrar.', 'error');
      return;
    }

    usuarioLogado = dados.usuario;
    modoAutoCadastro = false;
    await iniciarSessaoAutenticada();
  } catch (err) {
    exibirMensagem('Falha de conexão com o servidor.', 'error');
  }
}

async function iniciarSessaoAutenticada() {
  ocultarTodasAsViews();
  document.getElementById('btn-logout').classList.remove('hidden');

  const iniciais = usuarioLogado.nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  document.getElementById('user-avatar').textContent = iniciais;
  document.getElementById('logged-user-info').textContent =
    `${usuarioLogado.nome} (${usuarioLogado.perfil})`;
  document.getElementById('logged-user-sub').textContent = usuarioLogado.email;

  const isAdmin = usuarioLogado.perfil === 'Administrador';

  if (isAdmin) {
    // Visão da Coordenação: gerencia Disciplinas da Grade, Cursos e Contas
    document.getElementById('user-session-bar').classList.remove('hidden');
    document.getElementById('btn-meu-perfil').classList.add('hidden');
    document.getElementById('student-bottom-nav').classList.add('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    document.getElementById('btn-voltar-aluno-perfil').classList.add('hidden');
    document.getElementById('btn-novo-usuario').classList.remove('hidden');
    document.getElementById('card-filtros-usuario').classList.remove('hidden');
    document.getElementById('btn-novo-curso').classList.remove('hidden');
    document.getElementById('titulo-secao-usuarios').textContent = 'Contas Cadastradas';
    document.getElementById('subtitulo-secao-usuarios').textContent = 'Gerencie alunos e coordenadores';
    await carregarSelectsDeCursos();
    mostrarAba('usuarios');
  } else {
    // Visão do Aluno: Meu Semestre (Disciplinas + Grade Seg-Sex) e Minha Grade (Finalizadas/Fazendo/Faltam)
    document.getElementById('user-session-bar').classList.add('hidden');
    document.getElementById('btn-meu-perfil').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('student-bottom-nav').classList.remove('hidden');
    document.getElementById('btn-novo-usuario').classList.add('hidden');
    document.getElementById('card-filtros-usuario').classList.add('hidden');
    document.getElementById('btn-novo-curso').classList.add('hidden');
    await carregarSelectsDeCursos();
    await carregarTelaInicialAluno();
  }
}

function fazerLogout() {
  usuarioLogado = null;
  modoAutoCadastro = false;
  disciplinaSelecionada = null;
  document.getElementById('form-login').reset();
  document.getElementById('user-session-bar').classList.add('hidden');
  document.getElementById('btn-meu-perfil').classList.add('hidden');
  document.getElementById('btn-logout').classList.add('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('student-bottom-nav').classList.add('hidden');
  ocultarTodasAsViews();
  document.getElementById('view-login').classList.remove('hidden');
  fecharFormUsuario();
  fecharFormCurso();
  fecharFormDisciplina();
  limparMensagem();
}

// ============================================================================
// TELA INICIAL DO ALUNO E TELA ESPECÍFICA DA DISCIPLINA
// ============================================================================
function formatarResumoHorarios(horariosStr) {
  if (!horariosStr) return '';
  const codigos = horariosStr.split(',').map((s) => s.trim()).filter(Boolean);
  const porDia = {};
  codigos.forEach((item) => {
    const [dia, slot] = item.split('-');
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(slot);
  });

  const nomesDia = { SEG: 'Seg', TER: 'Ter', QUA: 'Qua', QUI: 'Qui', SEX: 'Sex' };
  const partes = Object.keys(porDia).map((dia) => {
    const slots = porDia[dia];
    const primeiro = SLOTS_UNIFEI.find((s) => s.id === slots[0]);
    const ultimo = SLOTS_UNIFEI.find((s) => s.id === slots[slots.length - 1]);
    if (primeiro && ultimo) {
      return `${nomesDia[dia] || dia} (${primeiro.inicio}–${ultimo.fim})`;
    }
    return `${nomesDia[dia] || dia}`;
  });

  return partes.join(' • ');
}

async function atualizarDadosProgressoAluno() {
  const resp = await fetch(`/api/aluno/progresso?usuario_id=${usuarioLogado.id}`);
  progressoAlunoCache = await resp.json();
  turmasAlunoCache = progressoAlunoCache.fazendo || [];

  // Atualiza o select de disciplinas que faltam para o aluno poder adicionar no semestre
  const selDisp = document.getElementById('select-disc-disponivel');
  if (selDisp) {
    selDisp.innerHTML = '<option value="">Selecione a disciplina...</option>';
    (progressoAlunoCache.faltam || []).forEach((d) => {
      selDisp.innerHTML += `<option value="${d.id}">${d.codigo} - ${d.nome} (${d.semestre_ideal}º sem.)</option>`;
    });
  }
}

async function carregarTelaInicialAluno() {
  limparMensagem();
  ocultarTodasAsViews();
  document.getElementById('view-aluno-home').classList.remove('hidden');
  document.getElementById('tab-aluno-semestre').classList.add('active');
  document.getElementById('tab-aluno-grade').classList.remove('active');

  await atualizarDadosProgressoAluno();
  renderizarListaDisciplinasAluno();
  renderizarGradeHorarios('grade-horarios-geral', turmasAlunoCache, true);
}

function alternarBoxAdicionarDisciplinaAluno() {
  const box = document.getElementById('box-add-disciplina-semestre');
  box.classList.toggle('hidden');
}

async function adicionarDisciplinaNoSemestrePeloSelect(event) {
  event.preventDefault();
  const discId = document.getElementById('select-disc-disponivel').value;
  if (!discId) return;

  await adicionarDisciplinaAoSemestre(Number(discId));
  document.getElementById('box-add-disciplina-semestre').classList.add('hidden');
}

async function adicionarDisciplinaAoSemestre(disciplinaId, permanecerNaGrade = false) {
  limparMensagem();
  const resp = await fetch('/api/turmas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioLogado.id, disciplina_id: disciplinaId })
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível adicionar a disciplina.', 'error');
    return;
  }

  await atualizarDadosProgressoAluno();
  if (permanecerNaGrade) {
    renderizarTelaProgressoAluno();
  } else {
    renderizarListaDisciplinasAluno();
    renderizarGradeHorarios('grade-horarios-geral', turmasAlunoCache, true);
  }
  exibirMensagem(dados.mensagem, 'success');
}

function renderizarListaDisciplinasAluno() {
  const container = document.getElementById('lista-disciplinas-aluno');
  container.innerHTML = '';

  if (turmasAlunoCache.length === 0) {
    container.innerHTML = `
      <div class="mobile-card" style="text-align: center; color: #64748b;">
        Nenhuma disciplina ativa neste semestre. Toque em "+ Adicionar" para puxar matérias da sua grade.
      </div>
    `;
    return;
  }

  turmasAlunoCache.forEach((t) => {
    const maxFaltas = Math.floor(t.ch_total * 0.25);
    const alertaFalta = t.faltas_horas >= maxFaltas * 0.75 ? 'alerta' : '';
    const resumoHorario = formatarResumoHorarios(t.horarios);

    container.innerHTML += `
      <article class="disc-card" data-disciplina-codigo="${t.codigo}" style="border-left-color: ${t.cor}" onclick="abrirDetalheDisciplina(${t.id})">
        <div class="disc-card-main">
          <div class="disc-card-top">
            <span class="disc-code" style="color: ${t.cor}; background: ${t.cor}15;">${t.codigo}</span>
            <span class="disc-room">${t.sala}</span>
          </div>
          <span class="disc-name">${t.nome}</span>
          <span class="disc-schedule-summary">${resumoHorario}</span>
        </div>
        <div class="disc-card-right">
          <span class="disc-faltas-pill ${alertaFalta}">${t.faltas_horas}h faltas</span>
          <span class="disc-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
        </div>
      </article>
    `;
  });
}

function renderizarGradeHorarios(containerId, listaDisciplinas, clicavel = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const mapaSlots = {};
  listaDisciplinas.forEach((disc) => {
    const slots = (disc.horarios || '').split(',').map((s) => s.trim()).filter(Boolean);
    slots.forEach((chave) => {
      mapaSlots[chave] = disc;
    });
  });

  let html = `
    <table class="unifei-timetable">
      <thead>
        <tr>
          <th class="col-time">Horário</th>
          ${DIAS_SEMANA.map((d) => `<th>${d.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  SLOTS_UNIFEI.forEach((slot) => {
    if (slot.tipo === 'intervalo') {
      html += `
        <tr class="break-row">
          <td colspan="6">${slot.texto}</td>
        </tr>
      `;
      return;
    }

    html += `<tr>`;
    html += `<td class="time-label">${slot.hora}</td>`;

    DIAS_SEMANA.forEach((dia) => {
      const chave = `${dia.id}-${slot.id}`;
      const disc = mapaSlots[chave];
      if (disc) {
        const acaoClick = clicavel ? `onclick="abrirDetalheDisciplina(${disc.id})"` : '';
        html += `
          <td data-slot="${chave}">
            <span class="slot-chip" style="background-color: ${disc.cor};" ${acaoClick} title="${disc.nome} (${disc.sala})">
              ${disc.codigo}
            </span>
          </td>
        `;
      } else {
        html += `<td data-slot="${chave}"><span class="slot-empty">-</span></td>`;
      }
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function abrirDetalheDisciplina(turmaId) {
  limparMensagem();
  const turma = turmasAlunoCache.find((t) => t.id === Number(turmaId));
  if (!turma) return;

  disciplinaSelecionada = turma;
  ocultarTodasAsViews();
  document.getElementById('view-disciplina-detalhe').classList.remove('hidden');
  atualizarDadosTelaDisciplina(turma);
  window.scrollTo(0, 0);
}

function atualizarDadosTelaDisciplina(turma) {
  const pillCod = document.getElementById('detalhe-codigo');
  pillCod.textContent = turma.codigo;
  pillCod.style.backgroundColor = turma.cor;

  document.getElementById('detalhe-ch').textContent = `${turma.ch_total}h`;
  document.getElementById('detalhe-nome').textContent = turma.nome;
  document.getElementById('detalhe-horarios-texto').textContent = formatarResumoHorarios(turma.horarios);
  document.getElementById('detalhe-sala').textContent = turma.sala;
  document.getElementById('detalhe-docente').textContent = turma.docente;

  const limiteFaltas = Math.floor(turma.ch_total * 0.25);
  document.getElementById('detalhe-faltas-sub').textContent =
    `Limite máximo permitido: ${limiteFaltas}h (25% de ${turma.ch_total}h)`;
  document.getElementById('detalhe-faltas-badge').textContent =
    `${turma.faltas_horas}h / ${limiteFaltas}h`;

  const percentual = Math.min(100, Math.round((turma.faltas_horas / limiteFaltas) * 100));
  const barra = document.getElementById('detalhe-faltas-barra');
  barra.style.width = `${percentual}%`;
  barra.style.backgroundColor = percentual >= 80 ? '#dc2626' : turma.cor;

  renderizarGradeHorarios('grade-horarios-individual', [turma], false);
}

async function alterarFaltaDisciplinaAtual(delta) {
  if (!disciplinaSelecionada) return;
  limparMensagem();

  const resp = await fetch(`/api/turmas/${disciplinaSelecionada.id}/falta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta })
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível atualizar as faltas.', 'error');
    return;
  }

  disciplinaSelecionada = dados.turma;
  const idx = turmasAlunoCache.findIndex((t) => t.id === disciplinaSelecionada.id);
  if (idx !== -1) {
    turmasAlunoCache[idx] = disciplinaSelecionada;
  }

  atualizarDadosTelaDisciplina(disciplinaSelecionada);
  renderizarListaDisciplinasAluno();
}

async function finalizarDisciplinaAtual() {
  if (!disciplinaSelecionada) return;
  limparMensagem();

  const resp = await fetch(`/api/turmas/${disciplinaSelecionada.id}/finalizar`, {
    method: 'POST'
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível finalizar a disciplina.', 'error');
    return;
  }

  await carregarTelaInicialAluno();
  exibirMensagem(dados.mensagem, 'success');
}

async function retirarDisciplinaDoSemestreAtual() {
  if (!disciplinaSelecionada) return;
  limparMensagem();

  const resp = await fetch(`/api/turmas/${disciplinaSelecionada.id}`, {
    method: 'DELETE'
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível retirar a disciplina.', 'error');
    return;
  }

  await carregarTelaInicialAluno();
  exibirMensagem(dados.mensagem, 'success');
}

function voltarParaHomeAluno() {
  limparMensagem();
  disciplinaSelecionada = null;
  ocultarTodasAsViews();
  document.getElementById('view-aluno-home').classList.remove('hidden');
  document.getElementById('tab-aluno-semestre').classList.add('active');
  document.getElementById('tab-aluno-grade').classList.remove('active');
  renderizarListaDisciplinasAluno();
  renderizarGradeHorarios('grade-horarios-geral', turmasAlunoCache, true);
  window.scrollTo(0, 0);
}

// ============================================================================
// TELA DE PROGRESSO DO ALUNO (FINALIZADAS, FAZENDO E AINDA FALTAM)
// ============================================================================
async function abrirTelaProgressoAluno() {
  if (!usuarioLogado) return;
  limparMensagem();
  ocultarTodasAsViews();
  document.getElementById('view-aluno-progresso').classList.remove('hidden');
  document.getElementById('tab-aluno-semestre').classList.remove('active');
  document.getElementById('tab-aluno-grade').classList.add('active');

  await atualizarDadosProgressoAluno();
  renderizarTelaProgressoAluno();
  window.scrollTo(0, 0);
}

function renderizarTelaProgressoAluno() {
  const { finalizadas, fazendo, faltam } = progressoAlunoCache;

  document.getElementById('count-finalizadas').textContent = finalizadas.length;
  document.getElementById('count-fazendo').textContent = fazendo.length;
  document.getElementById('count-faltam').textContent = faltam.length;

  // 1. Lista de Fazendo no Semestre
  const boxFazendo = document.getElementById('lista-progresso-fazendo');
  boxFazendo.innerHTML = '';
  fazendo.forEach((t) => {
    boxFazendo.innerHTML += `
      <article class="item-card" data-progresso-codigo="${t.codigo}">
        <div class="item-card-header">
          <span class="item-title">${t.codigo} — ${t.nome}</span>
          <span class="badge badge-doing">Fazendo</span>
        </div>
        <div class="item-meta">
          <span><strong>Docente:</strong> ${t.docente} &bull; <strong>CH:</strong> ${t.ch_total}h</span>
          <span><strong>Faltas acumuladas:</strong> ${t.faltas_horas}h</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-secondary" onclick="abrirDetalheDisciplina(${t.id})">Ver Horário e Faltas</button>
          <button class="btn btn-success btn-concluir-direto" onclick="finalizarDisciplinaPeloProgresso(${t.id})">Finalizar</button>
        </div>
      </article>
    `;
  });

  // 2. Lista de Ainda Faltam
  const boxFaltam = document.getElementById('lista-progresso-faltam');
  boxFaltam.innerHTML = '';
  faltam.forEach((d) => {
    boxFaltam.innerHTML += `
      <article class="item-card" data-progresso-codigo="${d.codigo}">
        <div class="item-card-header">
          <span class="item-title">${d.codigo} — ${d.nome}</span>
          <span class="badge badge-todo">Falta (${d.semestre_ideal}º sem.)</span>
        </div>
        <div class="item-meta">
          <span><strong>Docente:</strong> ${d.docente} &bull; <strong>CH:</strong> ${d.ch_total}h</span>
          <span><strong>Horário ofertado:</strong> ${formatarResumoHorarios(d.horarios)}</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary btn-puxar-semestre" onclick="adicionarDisciplinaAoSemestre(${d.id}, true)">
            + Cursar neste semestre
          </button>
        </div>
      </article>
    `;
  });

  // 3. Lista de Finalizadas
  const boxFinalizadas = document.getElementById('lista-progresso-finalizadas');
  boxFinalizadas.innerHTML = '';
  finalizadas.forEach((f) => {
    boxFinalizadas.innerHTML += `
      <article class="item-card" data-progresso-codigo="${f.codigo}">
        <div class="item-card-header">
          <span class="item-title">${f.codigo} — ${f.nome}</span>
          <span class="badge badge-done">Finalizada</span>
        </div>
        <div class="item-meta">
          <span><strong>Carga horária cumprida:</strong> ${f.ch_total}h</span>
        </div>
      </article>
    `;
  });
}

async function finalizarDisciplinaPeloProgresso(turmaId) {
  limparMensagem();
  const resp = await fetch(`/api/turmas/${turmaId}/finalizar`, { method: 'POST' });
  const dados = await resp.json();
  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível finalizar.', 'error');
    return;
  }
  await atualizarDadosProgressoAluno();
  renderizarTelaProgressoAluno();
  exibirMensagem(dados.mensagem, 'success');
}

function filtrarSecaoProgresso(filtro) {
  document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`seg-${filtro}`).classList.add('active');

  const bFazendo = document.getElementById('bloco-progresso-fazendo');
  const bFaltam = document.getElementById('bloco-progresso-faltam');
  const bFinalizadas = document.getElementById('bloco-progresso-finalizadas');

  bFazendo.classList.toggle('hidden', filtro !== 'todas' && filtro !== 'fazendo');
  bFaltam.classList.toggle('hidden', filtro !== 'todas' && filtro !== 'faltam');
  bFinalizadas.classList.toggle('hidden', filtro !== 'todas' && filtro !== 'finalizadas');
}

function abrirMeuPerfilAluno() {
  if (!usuarioLogado) return;
  limparMensagem();
  ocultarTodasAsViews();
  document.getElementById('view-app').classList.remove('hidden');
  document.getElementById('btn-voltar-aluno-perfil').classList.remove('hidden');
  document.getElementById('titulo-secao-usuarios').textContent = 'Minha Conta';
  document.getElementById('subtitulo-secao-usuarios').textContent = 'Seus dados cadastrais e vínculo acadêmico';
  document.getElementById('aba-disciplinas').classList.add('hidden');
  document.getElementById('aba-cursos').classList.add('hidden');
  document.getElementById('aba-usuarios').classList.remove('hidden');
  consultarUsuarios();
}

async function abrirAutoCadastro() {
  limparMensagem();
  modoAutoCadastro = true;
  await carregarSelectsDeCursos();

  ocultarTodasAsViews();
  document.getElementById('view-app').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('student-bottom-nav').classList.add('hidden');
  document.getElementById('btn-voltar-aluno-perfil').classList.add('hidden');
  document.getElementById('btn-novo-usuario').classList.add('hidden');
  document.getElementById('card-filtros-usuario').classList.add('hidden');
  document.getElementById('tbody-usuarios').classList.add('hidden');
  document.getElementById('aba-disciplinas').classList.add('hidden');
  document.getElementById('aba-cursos').classList.add('hidden');
  document.getElementById('aba-usuarios').classList.remove('hidden');

  prepararNovoUsuario();
  document.getElementById('titulo-form-usuario').textContent = 'Criar Conta de Aluno';
  const selectPerfil = document.getElementById('usuario-perfil');
  selectPerfil.value = 'Aluno (Discente)';
  selectPerfil.disabled = true;
  alternarCamposAluno();
}

// ============================================================================
// CARREGAMENTO DE CURSOS E MATRIZES NOS SELECTS
// ============================================================================
async function carregarSelectsDeCursos() {
  const resp = await fetch('/api/cursos');
  listaCursosCache = await resp.json();

  const selForm = document.getElementById('usuario-curso');
  const selFiltro = document.getElementById('filtro-usuario-curso');
  const selDiscCurso = document.getElementById('disc-curso');
  const selFiltroDiscCurso = document.getElementById('filtro-disc-curso');

  selForm.innerHTML = '<option value="">Selecione seu curso...</option>';
  selFiltro.innerHTML = '<option value="TODOS">Todos os cursos</option>';
  if (selDiscCurso) selDiscCurso.innerHTML = '';
  if (selFiltroDiscCurso) selFiltroDiscCurso.innerHTML = '<option value="TODOS">Todos</option>';

  listaCursosCache.forEach((c) => {
    selForm.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome} (${c.turno})</option>`;
    selFiltro.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`;
    if (selDiscCurso) selDiscCurso.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`;
    if (selFiltroDiscCurso) selFiltroDiscCurso.innerHTML += `<option value="${c.id}">${c.codigo}</option>`;
  });
}

async function carregarCurriculosDoCurso(curriculoSelecionadoId = null) {
  const cursoId = document.getElementById('usuario-curso').value;
  const selCurr = document.getElementById('usuario-curriculo');
  selCurr.innerHTML = '<option value="">Selecione a matriz...</option>';

  if (!cursoId) return;

  const resp = await fetch(`/api/curriculos?curso_id=${cursoId}`);
  const curriculos = await resp.json();
  curriculos.forEach((cur) => {
    const selected = curriculoSelecionadoId && Number(curriculoSelecionadoId) === cur.id ? 'selected' : '';
    selCurr.innerHTML += `<option value="${cur.id}" ${selected}>${cur.codigo} (${cur.status})</option>`;
  });

  if (!curriculoSelecionadoId && curriculos.length > 0) {
    selCurr.value = curriculos[0].id;
  }
}

function alternarCamposAluno() {
  const perfil = document.getElementById('usuario-perfil').value;
  const camposAluno = document.querySelectorAll('.campo-aluno');
  camposAluno.forEach((el) => {
    if (perfil === 'Aluno (Discente)') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

// ============================================================================
// CRUD DE DISCIPLINAS DA GRADE CURRICULAR (COORDENAÇÃO)
// ============================================================================
function prepararNovaDisciplina() {
  limparMensagem();
  document.getElementById('form-disciplina').reset();
  document.getElementById('disc-id').value = '';
  document.getElementById('titulo-form-disciplina').textContent = 'Nova Disciplina na Grade';
  document.getElementById('disc-codigo').disabled = false;
  const card = document.getElementById('card-form-disciplina');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function fecharFormDisciplina() {
  const card = document.getElementById('card-form-disciplina');
  if (card) card.classList.add('hidden');
}

async function consultarDisciplinasCatalogo() {
  const busca = document.getElementById('filtro-disc-busca').value;
  const curso_id = document.getElementById('filtro-disc-curso').value;

  const params = new URLSearchParams({ busca, curso_id });
  const resp = await fetch(`/api/disciplinas?${params.toString()}`);
  const disciplinas = await resp.json();
  listaDisciplinasCatalogoCache = disciplinas;

  const container = document.getElementById('tbody-disciplinas');
  container.innerHTML = '';

  let semAtual = null;
  disciplinas.forEach((d) => {
    if (d.semestre_ideal !== semAtual) {
      semAtual = d.semestre_ideal;
      container.innerHTML += `<div class="group-divider">${semAtual}º Semestre Ideal</div>`;
    }

    container.innerHTML += `
      <article class="item-card" data-catalogo-codigo="${d.codigo}">
        <div class="item-card-header">
          <span class="item-title">${d.nome}</span>
          <span class="badge badge-code">${d.codigo} (${d.curso_codigo || 'UNIFEI'})</span>
        </div>
        <div class="item-meta">
          <span><strong>Docente:</strong> ${d.docente} &bull; <strong>Sala:</strong> ${d.sala}</span>
          <span><strong>Carga Horária:</strong> ${d.ch_total}h &bull; <strong>Horários:</strong> ${d.horarios}</span>
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-secondary btn-editar-disciplina" onclick="prepararEdicaoDisciplina(${d.id})">
            Editar
          </button>
          <button type="button" class="btn btn-danger btn-remover-disciplina" onclick="removerDisciplinaCatalogo(${d.id})">
            Excluir da Grade
          </button>
        </div>
      </article>
    `;
  });
}

function prepararEdicaoDisciplina(idOuObj) {
  limparMensagem();
  const d =
    typeof idOuObj === 'object'
      ? idOuObj
      : listaDisciplinasCatalogoCache.find((item) => item.id === Number(idOuObj));
  if (!d) return;

  document.getElementById('titulo-form-disciplina').textContent = `Editar Disciplina (${d.codigo})`;
  document.getElementById('disc-id').value = d.id;
  document.getElementById('disc-codigo').value = d.codigo;
  document.getElementById('disc-codigo').disabled = true;
  document.getElementById('disc-curso').value = d.curso_id;
  document.getElementById('disc-nome').value = d.nome;
  document.getElementById('disc-semestre').value = d.semestre_ideal;
  document.getElementById('disc-ch').value = d.ch_total;
  document.getElementById('disc-docente').value = d.docente;
  document.getElementById('disc-sala').value = d.sala;
  document.getElementById('disc-horarios').value = d.horarios;

  const card = document.getElementById('card-form-disciplina');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

async function salvarDisciplinaCatalogo(event) {
  event.preventDefault();
  limparMensagem();

  const id = document.getElementById('disc-id').value;
  const payload = {
    codigo: document.getElementById('disc-codigo').value.toUpperCase(),
    curso_id: Number(document.getElementById('disc-curso').value),
    nome: document.getElementById('disc-nome').value,
    semestre_ideal: Number(document.getElementById('disc-semestre').value),
    ch_total: Number(document.getElementById('disc-ch').value),
    docente: document.getElementById('disc-docente').value,
    sala: document.getElementById('disc-sala').value,
    horarios: document.getElementById('disc-horarios').value.toUpperCase()
  };

  const url = id ? `/api/disciplinas/${id}` : '/api/disciplinas';
  const metodo = id ? 'PUT' : 'POST';

  const resp = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível salvar a disciplina.', 'error');
    return;
  }

  fecharFormDisciplina();
  exibirMensagem(dados.mensagem, 'success');
  consultarDisciplinasCatalogo();
}

async function removerDisciplinaCatalogo(id, codigoOpcional) {
  limparMensagem();
  const d = listaDisciplinasCatalogoCache.find((item) => item.id === Number(id));
  const codigo = codigoOpcional || (d ? d.codigo : '');
  if (!window.confirm(`Deseja realmente retirar a disciplina ${codigo} da grade curricular?`)) return;

  const resp = await fetch(`/api/disciplinas/${id}`, { method: 'DELETE' });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível excluir a disciplina.', 'error');
    return;
  }

  exibirMensagem(dados.mensagem, 'success');
  consultarDisciplinasCatalogo();
}

// ============================================================================
// GESTÃO DE PERFIS E USUÁRIOS
// ============================================================================
function prepararNovoUsuario() {
  limparMensagem();
  document.getElementById('form-usuario').reset();
  document.getElementById('usuario-id').value = '';
  document.getElementById('titulo-form-usuario').textContent = 'Novo Cadastro';
  document.getElementById('usuario-cpf').disabled = false;
  document.getElementById('usuario-matricula').disabled = false;
  document.getElementById('usuario-perfil').disabled = false;
  document.getElementById('usuario-senha').required = true;
  document.getElementById('label-usuario-senha').textContent = 'Senha de acesso *';

  alternarCamposAluno();
  const card = document.getElementById('card-form-usuario');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function fecharFormUsuario() {
  document.getElementById('card-form-usuario').classList.add('hidden');
  if (modoAutoCadastro) {
    document.getElementById('tbody-usuarios').classList.remove('hidden');
    fazerLogout();
  }
}

async function consultarUsuarios() {
  const nome = document.getElementById('filtro-usuario-nome').value;
  const perfil = document.getElementById('filtro-usuario-perfil').value;
  const cursoId = document.getElementById('filtro-usuario-curso').value;

  const params = new URLSearchParams({ nome, perfil, curso_id: cursoId });
  const resp = await fetch(`/api/usuarios?${params.toString()}`);
  let usuarios = await resp.json();

  if (usuarioLogado && usuarioLogado.perfil !== 'Administrador') {
    usuarios = usuarios.filter((u) => u.id === usuarioLogado.id);
  }
  listaUsuariosCache = usuarios;

  const container = document.getElementById('tbody-usuarios');
  container.innerHTML = '';

  let cursoGrupoAtual = null;
  usuarios.forEach((u) => {
    const grupo = u.curso_nome || 'Coordenação / Administração';
    if (grupo !== cursoGrupoAtual) {
      cursoGrupoAtual = grupo;
      container.innerHTML += `<div class="group-divider">${grupo}</div>`;
    }

    const badgeClass = u.perfil === 'Administrador' ? 'badge-admin' : 'badge-aluno';
    const detalhesAluno =
      u.perfil === 'Aluno (Discente)'
        ? `<span><strong>Matrícula:</strong> ${u.matricula || '-'} &bull; <strong>Ingresso:</strong> ${u.semestre_ingresso || '-'}</span>
           <span><strong>Curso / Matriz:</strong> ${u.curso_codigo || '-'} (${u.curriculo_codigo || '-'})</span>`
        : `<span><strong>Acesso:</strong> Coordenação Acadêmica</span>`;

    container.innerHTML += `
      <article class="item-card" data-usuario-id="${u.id}">
        <div class="item-card-header">
          <span class="item-title">${u.nome}</span>
          <span class="badge ${badgeClass}">${u.perfil}</span>
        </div>
        <div class="item-meta">
          <span><strong>E-mail:</strong> ${u.email}</span>
          <span><strong>CPF:</strong> ${u.cpf}</span>
          ${detalhesAluno}
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-secondary btn-editar-usuario" onclick="prepararEdicaoUsuario(${u.id})">
            Editar Dados
          </button>
          <button type="button" class="btn btn-danger btn-remover-usuario" onclick="removerUsuario(${u.id})">
            Excluir Conta
          </button>
        </div>
      </article>
    `;
  });
}

async function prepararEdicaoUsuario(idOuObj) {
  limparMensagem();
  const u =
    typeof idOuObj === 'object'
      ? idOuObj
      : listaUsuariosCache.find((item) => item.id === Number(idOuObj));
  if (!u) return;

  document.getElementById('titulo-form-usuario').textContent = `Editar Perfil`;
  document.getElementById('usuario-id').value = u.id;
  document.getElementById('usuario-nome').value = u.nome;
  document.getElementById('usuario-cpf').value = u.cpf;
  document.getElementById('usuario-email').value = u.email;
  document.getElementById('usuario-senha').value = '';
  document.getElementById('usuario-senha').required = false;
  document.getElementById('label-usuario-senha').textContent = 'Nova senha (opcional)';

  document.getElementById('usuario-cpf').disabled = true;
  document.getElementById('usuario-matricula').value = u.matricula || '';
  document.getElementById('usuario-matricula').disabled = true;

  const selPerfil = document.getElementById('usuario-perfil');
  selPerfil.value = u.perfil;
  selPerfil.disabled = usuarioLogado && usuarioLogado.perfil !== 'Administrador';

  alternarCamposAluno();

  if (u.perfil === 'Aluno (Discente)') {
    document.getElementById('usuario-curso').value = u.curso_id || '';
    await carregarCurriculosDoCurso(u.curriculo_id);
    document.getElementById('usuario-semestre').value = u.semestre_ingresso || '';
  }

  const card = document.getElementById('card-form-usuario');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

async function salvarUsuario(event) {
  event.preventDefault();
  limparMensagem();

  const id = document.getElementById('usuario-id').value;
  const payload = {
    nome: document.getElementById('usuario-nome').value,
    cpf: document.getElementById('usuario-cpf').value,
    email: document.getElementById('usuario-email').value,
    senha: document.getElementById('usuario-senha').value,
    perfil: document.getElementById('usuario-perfil').value,
    matricula: document.getElementById('usuario-matricula').value,
    curso_id: document.getElementById('usuario-curso').value,
    curriculo_id: document.getElementById('usuario-curriculo').value,
    semestre_ingresso: document.getElementById('usuario-semestre').value
  };

  const url = id ? `/api/usuarios/${id}` : '/api/usuarios';
  const metodo = id ? 'PUT' : 'POST';

  const resp = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível salvar os dados.', 'error');
    return;
  }

  if (modoAutoCadastro) {
    document.getElementById('tbody-usuarios').classList.remove('hidden');
    fazerLogout();
    exibirMensagem('Conta criada com sucesso! Faça login para começar.', 'success');
    return;
  }

  fecharFormUsuario();
  exibirMensagem(dados.mensagem, 'success');
  consultarUsuarios();
}

async function removerUsuario(id, nomeOpcional, perfilOpcional) {
  limparMensagem();
  const u = listaUsuariosCache.find((item) => item.id === Number(id));
  const nome = nomeOpcional || (u ? u.nome : '');
  const perfil = perfilOpcional || (u ? u.perfil : '');

  const msgConfirm =
    perfil === 'Aluno (Discente)'
      ? `Deseja realmente excluir a conta de "${nome}"? Todo o histórico de horários e faltas será apagado.`
      : `Deseja realmente excluir o administrador "${nome}"?`;

  if (!window.confirm(msgConfirm)) return;

  const resp = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível remover a conta.', 'error');
    return;
  }

  if (usuarioLogado && usuarioLogado.id === Number(id)) {
    fazerLogout();
    exibirMensagem('Sua conta foi excluída com sucesso.', 'success');
    return;
  }

  exibirMensagem(dados.mensagem, 'success');
  consultarUsuarios();
}

// ============================================================================
// CATÁLOGO DE CURSOS DE GRADUAÇÃO
// ============================================================================
function prepararNovoCurso() {
  limparMensagem();
  document.getElementById('form-curso').reset();
  document.getElementById('curso-id').value = '';
  document.getElementById('titulo-form-curso').textContent = 'Cadastrar Curso';
  document.getElementById('curso-codigo').disabled = false;
  const card = document.getElementById('card-form-curso');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function fecharFormCurso() {
  document.getElementById('card-form-curso').classList.add('hidden');
}

async function consultarCursos() {
  const instituto = document.getElementById('filtro-curso-instituto').value;
  const turno = document.getElementById('filtro-curso-turno').value;
  const busca = document.getElementById('filtro-curso-busca').value;

  const params = new URLSearchParams({ instituto, turno, busca });
  const resp = await fetch(`/api/cursos?${params.toString()}`);
  const cursos = await resp.json();
  listaCursosCache = cursos;

  const isAdmin = usuarioLogado && usuarioLogado.perfil === 'Administrador';
  const container = document.getElementById('tbody-cursos');
  container.innerHTML = '';

  let instAtual = null;
  cursos.forEach((c) => {
    if (c.instituto !== instAtual) {
      instAtual = c.instituto;
      container.innerHTML += `<div class="group-divider">Instituto: ${instAtual}</div>`;
    }

    const botoesAdmin = isAdmin
      ? `<div class="item-actions">
           <button type="button" class="btn btn-secondary btn-editar-curso" onclick="prepararEdicaoCurso(${c.id})">
             Editar Curso
           </button>
           <button type="button" class="btn btn-danger btn-remover-curso" onclick="removerCurso(${c.id})">
             Excluir
           </button>
         </div>`
      : '';

    container.innerHTML += `
      <article class="item-card" data-curso-codigo="${c.codigo}">
        <div class="item-card-header">
          <span class="item-title">${c.nome}</span>
          <span class="badge badge-code">${c.codigo}</span>
        </div>
        <div class="item-meta">
          <span><strong>Unidade:</strong> ${c.instituto} &bull; <strong>Grau:</strong> ${c.grau}</span>
          <span><strong>Turno:</strong> ${c.turno}</span>
          <span><strong>Integralização:</strong> Ideal ${c.duracao_padrao} sem. (Máx. ${c.duracao_maxima} sem.)</span>
        </div>
        ${botoesAdmin}
      </article>
    `;
  });
}

function prepararEdicaoCurso(idOuObj) {
  limparMensagem();
  const c =
    typeof idOuObj === 'object'
      ? idOuObj
      : listaCursosCache.find((item) => item.id === Number(idOuObj));
  if (!c) return;

  document.getElementById('titulo-form-curso').textContent = `Editar Curso (${c.codigo})`;
  document.getElementById('curso-id').value = c.id;
  document.getElementById('curso-codigo').value = c.codigo;
  document.getElementById('curso-codigo').disabled = true;
  document.getElementById('curso-nome').value = c.nome;
  document.getElementById('curso-instituto').value = c.instituto;
  document.getElementById('curso-grau').value = c.grau;
  document.getElementById('curso-turno').value = c.turno;
  document.getElementById('curso-duracao-padrao').value = c.duracao_padrao;
  document.getElementById('curso-duracao-maxima').value = c.duracao_maxima;

  const card = document.getElementById('card-form-curso');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

async function salvarCurso(event) {
  event.preventDefault();
  limparMensagem();

  const id = document.getElementById('curso-id').value;
  const payload = {
    codigo: document.getElementById('curso-codigo').value.toUpperCase(),
    nome: document.getElementById('curso-nome').value,
    instituto: document.getElementById('curso-instituto').value,
    grau: document.getElementById('curso-grau').value,
    turno: document.getElementById('curso-turno').value,
    duracao_padrao: Number(document.getElementById('curso-duracao-padrao').value),
    duracao_maxima: Number(document.getElementById('curso-duracao-maxima').value)
  };

  const url = id ? `/api/cursos/${id}` : '/api/cursos';
  const metodo = id ? 'PUT' : 'POST';

  const resp = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível salvar o curso.', 'error');
    return;
  }

  fecharFormCurso();
  await carregarSelectsDeCursos();
  exibirMensagem(dados.mensagem, 'success');
  consultarCursos();
}

async function removerCurso(id, codigoOpcional) {
  limparMensagem();
  const c = listaCursosCache.find((item) => item.id === Number(id));
  const codigo = codigoOpcional || (c ? c.codigo : '');
  if (!window.confirm(`Deseja realmente excluir o curso ${codigo}?`)) return;

  const resp = await fetch(`/api/cursos/${id}`, { method: 'DELETE' });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível remover o curso.', 'error');
    return;
  }

  await carregarSelectsDeCursos();
  exibirMensagem(dados.mensagem, 'success');
  consultarCursos();
}
