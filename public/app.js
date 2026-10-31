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

  const abaCurriculo = document.getElementById('aba-curriculo');
  const tabCurriculo = document.getElementById('tab-curriculo');
  if (abaCurriculo) abaCurriculo.classList.add('hidden');
  if (tabCurriculo) tabCurriculo.classList.remove('active');

  if (aba === 'disciplinas') {
    abaDisciplinas.classList.remove('hidden');
    tabDisciplinas.classList.add('active');
    consultarDisciplinasCatalogo();
  } else if (aba === 'cursos') {
    abaCursos.classList.remove('hidden');
    tabCursos.classList.add('active');
    consultarCursos();
  } else if (aba === 'curriculo') {
    if (abaCurriculo) abaCurriculo.classList.remove('hidden');
    if (tabCurriculo) tabCurriculo.classList.add('active');
    consultarCurriculos();
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
  fecharFormCurriculo();
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
  const { finalizadas, fazendo, faltam, ch, curriculo } = progressoAlunoCache;

  document.getElementById('count-finalizadas').textContent = finalizadas ? finalizadas.length : 0;
  document.getElementById('count-fazendo').textContent = fazendo ? fazendo.length : 0;
  document.getElementById('count-faltam').textContent = faltam ? faltam.length : 0;

  if (ch && curriculo) {
    document.getElementById('ch-curriculo-codigo').textContent = `${curriculo.codigo} (${curriculo.ano_semestre})`;
    document.getElementById('ch-obrigatoria-texto').textContent = `${ch.obrigatoria_cumprida}h / ${ch.obrigatoria_exigida}h`;
    const pctObrig = ch.obrigatoria_exigida > 0 ? Math.min(100, Math.round((ch.obrigatoria_cumprida / ch.obrigatoria_exigida) * 100)) : 0;
    document.getElementById('ch-obrigatoria-barra').style.width = `${pctObrig}%`;

    document.getElementById('ch-optativa-texto').textContent = `${ch.optativa_cumprida}h / ${ch.optativa_exigida}h`;
    const pctOpt = ch.optativa_exigida > 0 ? Math.min(100, Math.round((ch.optativa_cumprida / ch.optativa_exigida) * 100)) : 0;
    document.getElementById('ch-optativa-barra').style.width = `${pctOpt}%`;

    document.getElementById('ch-total-texto').textContent = `${ch.total_cumprido}h / ${ch.total_exigido}h`;
    const pctTotal = ch.total_exigido > 0 ? Math.min(100, Math.round((ch.total_cumprido / ch.total_exigido) * 100)) : 0;
    document.getElementById('ch-total-barra').style.width = `${pctTotal}%`;

    document.getElementById('ch-complementar-texto').textContent = `* Atividades complementares exigidas para colação: ${ch.complementar_exigida}h.`;
  }

  const renderPrereqsInfo = (prereqs) => {
    if (!prereqs || prereqs.length === 0) return '';
    const pills = prereqs
      .map(
        (p) =>
          `<span class="prereq-pill ${p.cumprido ? 'prereq-ok' : 'prereq-pendente'}">${p.codigo} ${p.cumprido ? '✓' : 'pendente'}</span>`
      )
      .join(' ');
    return `<div class="prereq-info"><span><strong>Pré-req:</strong></span> ${pills}</div>`;
  };

  const boxFazendo = document.getElementById('lista-progresso-fazendo');
  boxFazendo.innerHTML = '';
  (fazendo || []).forEach((t) => {
    const badgeTipo = t.tipo === 'Optativa' ? '<span class="badge-optativa">Optativa</span>' : '<span class="badge-obrigatoria">Obrigatória</span>';
    boxFazendo.innerHTML += `
      <article class="item-card" data-progresso-codigo="${t.codigo}">
        <div class="item-card-header">
          <span class="item-title">${t.codigo} — ${t.nome}</span>
          <div style="display:flex; gap:0.3rem; align-items:center;">
            ${badgeTipo}
            <span class="badge badge-doing">Fazendo</span>
          </div>
        </div>
        <div class="item-meta">
          <span><strong>Docente:</strong> ${t.docente} &bull; <strong>CH:</strong> ${t.ch_total}h</span>
          <span><strong>Faltas acumuladas:</strong> ${t.faltas_horas}h</span>
          ${renderPrereqsInfo(t.prerequisitos)}
        </div>
        <div class="item-actions">
          <button class="btn btn-secondary" onclick="abrirDetalheDisciplina(${t.id})">Ver Horário e Faltas</button>
          <button class="btn btn-success btn-concluir-direto" onclick="finalizarDisciplinaPeloProgresso(${t.id})">Finalizar</button>
        </div>
      </article>
    `;
  });

  const boxFaltam = document.getElementById('lista-progresso-faltam');
  boxFaltam.innerHTML = '';
  let periodoAtualFaltam = null;
  (faltam || []).forEach((d) => {
    const sem = d.semestre_ideal || 0;
    if (sem !== periodoAtualFaltam) {
      periodoAtualFaltam = sem;
      const labelPeriodo = sem > 0 ? `${sem}º período sugerido` : 'Disciplinas Eletivas/Optativas';
      boxFaltam.innerHTML += `<div class="periodo-header">${labelPeriodo}</div>`;
    }
    const badgeTipo = d.tipo === 'Optativa' ? '<span class="badge-optativa">Optativa</span>' : '<span class="badge-obrigatoria">Obrigatória</span>';

    boxFaltam.innerHTML += `
      <article class="item-card" data-progresso-codigo="${d.codigo}">
        <div class="item-card-header">
          <span class="item-title">${d.codigo} — ${d.nome}</span>
          <div style="display:flex; gap:0.3rem; align-items:center;">
            ${badgeTipo}
            <span class="badge badge-todo">Falta (${d.semestre_ideal}º sem.)</span>
          </div>
        </div>
        <div class="item-meta">
          <span><strong>Docente:</strong> ${d.docente} &bull; <strong>CH:</strong> ${d.ch_total}h</span>
          <span><strong>Horário ofertado:</strong> ${formatarResumoHorarios(d.horarios)}</span>
          ${renderPrereqsInfo(d.prerequisitos)}
        </div>
        <div class="item-actions">
          <button class="btn btn-primary btn-puxar-semestre" onclick="adicionarDisciplinaAoSemestre(${d.id}, true)">
            + Cursar neste semestre
          </button>
        </div>
      </article>
    `;
  });

  const boxFinalizadas = document.getElementById('lista-progresso-finalizadas');
  boxFinalizadas.innerHTML = '';
  let periodoAtualFinalizadas = null;
  (finalizadas || []).forEach((f) => {
    const sem = f.semestre_ideal || 0;
    if (sem !== periodoAtualFinalizadas) {
      periodoAtualFinalizadas = sem;
      const labelPeriodo = sem > 0 ? `${sem}º período` : 'Disciplinas';
      boxFinalizadas.innerHTML += `<div class="periodo-header">${labelPeriodo}</div>`;
    }
    const badgeTipo = f.tipo === 'Optativa' ? '<span class="badge-optativa">Optativa</span>' : '<span class="badge-obrigatoria">Obrigatória</span>';

    boxFinalizadas.innerHTML += `
      <article class="item-card" data-progresso-codigo="${f.codigo}">
        <div class="item-card-header">
          <span class="item-title">${f.codigo} — ${f.nome}</span>
          <div style="display:flex; gap:0.3rem; align-items:center;">
            ${badgeTipo}
            <span class="badge badge-done">Finalizada</span>
          </div>
        </div>
        <div class="item-meta">
          <span><strong>Carga horária cumprida:</strong> ${f.ch_total}h</span>
          ${renderPrereqsInfo(f.prerequisitos)}
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

  const selCurrCurso = document.getElementById('curriculo-curso');
  const selFiltroCurrCurso = document.getElementById('filtro-curriculo-curso');
  if (selCurrCurso) selCurrCurso.innerHTML = '';
  if (selFiltroCurrCurso) selFiltroCurrCurso.innerHTML = '<option value="TODOS">Todos</option>';

  listaCursosCache.forEach((c) => {
    selForm.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome} (${c.turno})</option>`;
    selFiltro.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`;
    if (selDiscCurso) selDiscCurso.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`;
    if (selFiltroDiscCurso) selFiltroDiscCurso.innerHTML += `<option value="${c.id}">${c.codigo}</option>`;
    if (selCurrCurso) selCurrCurso.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`;
    if (selFiltroCurrCurso) selFiltroCurrCurso.innerHTML += `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`;
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
function renderizarOpcoesPrerequisitos(disciplinaAtualId, idsPrereqSelecionados = []) {
  const container = document.getElementById('disc-prereqs');
  if (!container) return;
  container.innerHTML = '';
  const setSelecionados = new Set(idsPrereqSelecionados.map(Number));

  listaDisciplinasCatalogoCache
    .filter((d) => !disciplinaAtualId || d.id !== Number(disciplinaAtualId))
    .sort((a, b) => a.semestre_ideal - b.semestre_ideal || a.codigo.localeCompare(b.codigo))
    .forEach((d) => {
      const checked = setSelecionados.has(d.id) ? 'checked' : '';
      container.innerHTML += `
        <label>
          <input type="checkbox" name="disc-prereq-item" value="${d.id}" ${checked}>
          <span>${d.codigo} (${d.semestre_ideal}º sem.)</span>
        </label>
      `;
    });
}

function prepararNovaDisciplina() {
  limparMensagem();
  document.getElementById('form-disciplina').reset();
  document.getElementById('disc-id').value = '';
  document.getElementById('titulo-form-disciplina').textContent = 'Nova Disciplina na Grade';
  document.getElementById('disc-codigo').disabled = false;
  document.getElementById('disc-tipo').value = 'Obrigatória';
  document.getElementById('disc-ch').value = '64';
  renderizarOpcoesPrerequisitos(null, []);
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
  const periodo = document.getElementById('filtro-disc-periodo') ? document.getElementById('filtro-disc-periodo').value : 'TODOS';
  const tipo = document.getElementById('filtro-disc-tipo') ? document.getElementById('filtro-disc-tipo').value : 'TODOS';

  const params = new URLSearchParams({ busca, curso_id, periodo, tipo });
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

    const badgeTipo = d.tipo === 'Optativa' ? '<span class="badge-optativa">Optativa</span>' : '<span class="badge-obrigatoria">Obrigatória</span>';
    const prereqsTexto = d.prerequisitos_codigos && d.prerequisitos_codigos.length > 0
      ? ` &bull; <strong>Pré-req:</strong> ${d.prerequisitos_codigos.join(', ')}`
      : '';

    container.innerHTML += `
      <article class="item-card" data-catalogo-codigo="${d.codigo}">
        <div class="item-card-header">
          <span class="item-title">${d.nome}</span>
          <div style="display:flex; gap:0.35rem; align-items:center;">
            ${badgeTipo}
            <span class="badge badge-code">${d.codigo} (${d.curso_codigo || 'UNIFEI'})</span>
          </div>
        </div>
        <div class="item-meta">
          <span><strong>Docente:</strong> ${d.docente} &bull; <strong>Sala:</strong> ${d.sala}</span>
          <span><strong>Carga Horária:</strong> ${d.ch_total}h &bull; <strong>Horários:</strong> ${d.horarios}${prereqsTexto}</span>
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
  if (document.getElementById('disc-tipo')) {
    document.getElementById('disc-tipo').value = d.tipo || 'Obrigatória';
  }
  document.getElementById('disc-docente').value = d.docente;
  document.getElementById('disc-sala').value = d.sala;
  document.getElementById('disc-horarios').value = d.horarios;

  renderizarOpcoesPrerequisitos(d.id, d.prerequisitos_ids || []);

  const card = document.getElementById('card-form-disciplina');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

async function salvarDisciplinaCatalogo(event) {
  event.preventDefault();
  limparMensagem();

  const id = document.getElementById('disc-id').value;
  const checkboxesPre = document.querySelectorAll('input[name="disc-prereq-item"]:checked');
  const prerequisitos_ids = Array.from(checkboxesPre).map((cb) => Number(cb.value));

  const payload = {
    codigo: document.getElementById('disc-codigo').value.toUpperCase(),
    curso_id: Number(document.getElementById('disc-curso').value),
    nome: document.getElementById('disc-nome').value,
    semestre_ideal: Number(document.getElementById('disc-semestre').value),
    ch_total: Number(document.getElementById('disc-ch').value),
    tipo: document.getElementById('disc-tipo') ? document.getElementById('disc-tipo').value : 'Obrigatória',
    docente: document.getElementById('disc-docente').value,
    sala: document.getElementById('disc-sala').value,
    horarios: document.getElementById('disc-horarios').value.toUpperCase(),
    prerequisitos_ids
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


// ============================================================================
// CRUD 04 — CURRÍCULO DO CURSO (PARÂMETROS DE CH E GRADE POR SEMESTRE)
// ============================================================================
let listaCurriculosCache = [];

function prepararNovoCurriculo() {
  limparMensagem();
  document.getElementById('form-curriculo').reset();
  document.getElementById('curriculo-id').value = '';
  document.getElementById('titulo-form-curriculo').textContent = 'Novo Currículo';
  document.getElementById('curriculo-codigo').disabled = false;
  document.getElementById('curriculo-ch-obrig').value = '2400';
  document.getElementById('curriculo-ch-opt').value = '240';
  document.getElementById('curriculo-ch-compl').value = '160';
  document.getElementById('curriculo-ch-total').value = '2800';

  const card = document.getElementById('card-form-curriculo');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

function fecharFormCurriculo() {
  const card = document.getElementById('card-form-curriculo');
  if (card) card.classList.add('hidden');
}

function fecharGradeCurriculo() {
  const card = document.getElementById('card-grade-curriculo');
  if (card) card.classList.add('hidden');
}

async function consultarCurriculos() {
  const curso_id = document.getElementById('filtro-curriculo-curso')
    ? document.getElementById('filtro-curriculo-curso').value
    : 'TODOS';

  const params = new URLSearchParams({ curso_id });
  const resp = await fetch(`/api/curriculos?${params.toString()}`);
  const curriculos = await resp.json();
  listaCurriculosCache = curriculos;

  const container = document.getElementById('tbody-curriculos');
  container.innerHTML = '';

  if (curriculos.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum currículo encontrado.</p>';
    return;
  }

  curriculos.forEach((c) => {
    container.innerHTML += `
      <article class="item-card" data-curriculo-codigo="${c.codigo}">
        <div class="item-card-header">
          <span class="item-title">${c.codigo} — ${c.curso_nome || c.curso_codigo}</span>
          <span class="badge badge-code">${c.status || 'Ativo'}</span>
        </div>
        <div class="item-meta">
          <span><strong>Início de vigência:</strong> ${c.ano_semestre} &bull; <strong>Alunos vinculados:</strong> ${c.total_alunos || 0}</span>
          <span><strong>CH Exigida:</strong> Obrigatórias ${c.ch_obrigatoria}h &bull; Optativas ${c.ch_optativa}h &bull; Compl. ${c.ch_complementar}h</span>
          <span><strong>CH Total Mínima:</strong> ${c.ch_total}h</span>
          <span><strong>Grade cadastrada:</strong> Obrigatórias ${c.ch_grade_obrigatoria || 0}h &bull; Optativas ${c.ch_grade_optativa || 0}h</span>
        </div>
        <div class="item-actions">
          <button type="button" class="btn btn-secondary btn-grade-curriculo" onclick="abrirGradeCurriculo(${c.id})">
            Ver Grade Curricular
          </button>
          <button type="button" class="btn btn-secondary btn-editar-curriculo" onclick="prepararEdicaoCurriculo(${c.id})">
            Editar Parâmetros
          </button>
          <button type="button" class="btn btn-danger btn-remover-curriculo" onclick="removerCurriculo(${c.id})">
            Excluir
          </button>
        </div>
      </article>
    `;
  });
}

function prepararEdicaoCurriculo(idOuObj) {
  limparMensagem();
  const c =
    typeof idOuObj === 'object'
      ? idOuObj
      : listaCurriculosCache.find((item) => item.id === Number(idOuObj));
  if (!c) return;

  document.getElementById('titulo-form-curriculo').textContent = `Editar Parâmetros (${c.codigo})`;
  document.getElementById('curriculo-id').value = c.id;
  document.getElementById('curriculo-codigo').value = c.codigo;
  document.getElementById('curriculo-codigo').disabled = true;
  document.getElementById('curriculo-ano').value = c.ano_semestre;
  document.getElementById('curriculo-curso').value = c.curso_id;
  document.getElementById('curriculo-ch-obrig').value = c.ch_obrigatoria;
  document.getElementById('curriculo-ch-opt').value = c.ch_optativa;
  document.getElementById('curriculo-ch-compl').value = c.ch_complementar;
  document.getElementById('curriculo-ch-total').value = c.ch_total;

  const card = document.getElementById('card-form-curriculo');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'instant', block: 'start' });
}

async function salvarCurriculo(event) {
  event.preventDefault();
  limparMensagem();

  const id = document.getElementById('curriculo-id').value;
  const payload = {
    codigo: document.getElementById('curriculo-codigo').value.toUpperCase(),
    curso_id: Number(document.getElementById('curriculo-curso').value),
    ano_semestre: document.getElementById('curriculo-ano').value.trim(),
    ch_obrigatoria: Number(document.getElementById('curriculo-ch-obrig').value),
    ch_optativa: Number(document.getElementById('curriculo-ch-opt').value),
    ch_complementar: Number(document.getElementById('curriculo-ch-compl').value),
    ch_total: Number(document.getElementById('curriculo-ch-total').value)
  };

  const url = id ? `/api/curriculos/${id}` : '/api/curriculos';
  const metodo = id ? 'PUT' : 'POST';

  const resp = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível salvar o currículo.', 'error');
    return;
  }

  fecharFormCurriculo();
  exibirMensagem(dados.mensagem, 'success');
  consultarCurriculos();
}

async function removerCurriculo(id, codigoOpcional) {
  limparMensagem();
  const c = listaCurriculosCache.find((item) => item.id === Number(id));
  const codigo = codigoOpcional || (c ? c.codigo : '');
  if (!window.confirm(`Deseja realmente excluir o currículo ${codigo}?`)) return;

  const resp = await fetch(`/api/curriculos/${id}`, { method: 'DELETE' });
  const dados = await resp.json();

  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Não foi possível remover o currículo.', 'error');
    return;
  }

  exibirMensagem(dados.mensagem, 'success');
  consultarCurriculos();
}

async function abrirGradeCurriculo(curriculoId) {
  limparMensagem();
  const resp = await fetch(`/api/curriculos/${curriculoId}`);
  const dados = await resp.json();
  if (!resp.ok) {
    exibirMensagem(dados.erro || 'Erro ao carregar grade do currículo.', 'error');
    return;
  }

  const { curriculo, grade_por_periodo } = dados;
  document.getElementById('titulo-grade-curriculo').textContent = `Grade Curricular: ${curriculo.codigo} (${curriculo.curso_codigo})`;
  document.getElementById('resumo-grade-curriculo').textContent = `Vigência ${curriculo.ano_semestre} • Exige ${curriculo.ch_obrigatoria}h obrigatórias + ${curriculo.ch_optativa}h optativas (${curriculo.ch_total}h total)`;

  const container = document.getElementById('lista-grade-curriculo');
  container.innerHTML = '';

  const periodos = Object.keys(grade_por_periodo).map(Number).sort((a, b) => a - b);
  if (periodos.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma disciplina cadastrada neste curso.</p>';
  } else {
    periodos.forEach((p) => {
      const disciplinas = grade_por_periodo[p];
      const chPeriodo = disciplinas.reduce((acc, d) => acc + d.ch_total, 0);
      let htmlPeriodo = `
        <div style="margin-top:0.8rem; margin-bottom:0.4rem; padding-bottom:0.2rem; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#0f172a; font-size:0.85rem;">${p}º Período</strong>
          <span style="font-size:0.75rem; color:#64748b;">${chPeriodo}h no período</span>
        </div>
      `;
      disciplinas.forEach((d) => {
        const badgeTipo = d.tipo === 'Optativa' ? '<span class="badge-optativa">Optativa</span>' : '<span class="badge-obrigatoria">Obrigatória</span>';
        const prereqsTexto = d.prerequisitos_codigos && d.prerequisitos_codigos.length > 0
          ? ` • Pré-req: ${d.prerequisitos_codigos.join(', ')}`
          : '';
        htmlPeriodo += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.2rem; border-bottom:1px dashed #f1f5f9; font-size:0.78rem;">
            <div>
              <strong>${d.codigo}</strong> — ${d.nome} (${d.ch_total}h) ${badgeTipo}
              <div style="font-size:0.7rem; color:#64748b;">${d.docente}${prereqsTexto}</div>
            </div>
          </div>
        `;
      });
      container.innerHTML += htmlPeriodo;
    });
  }

  const cardGrade = document.getElementById('card-grade-curriculo');
  cardGrade.classList.remove('hidden');
  cardGrade.scrollIntoView({ behavior: 'instant', block: 'start' });
}
