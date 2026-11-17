"""
Testes Automatizados Selenium — Release 04 (Desenrola Aluno)
Cobre os CRUDs 07 e 08 (fechando os 8 CRUDs do DRE):
- CT26: Lançar Disciplina Concluída no Histórico / Grade do Aluno e Recalcular CH (CRUD 07 - RFS17)
- CT27: Validação do Registro de Histórico (Nota Final < 6.0 para Aprovado e Semestre Inválido) (CRUD 07 - RN03)
- CT28: Consultar Grade / Histórico do Aluno com Filtros de Período e Natureza (CRUD 07 - RFS18)
- CT29: Editar Registro do Histórico (Código bloqueado) e Remover voltando para Pendente (CRUD 07 - RFS19/RFS20)
- CT30: Matricular Nova Turma no Semestre com Código da Turma, Sala e Horários (CRUD 08 - RFS21)
- CT31: Validação de Choque de Horário na Matrícula do Semestre (CRUD 08 - RN01)
- CT32: Consultar Turmas do Semestre com Filtros de Dia da Semana e Busca Textual (CRUD 08 - RFS22)
- CT33: Alterar Dados da Turma (validação de choque de horário) e Remover Matrícula do Semestre (CRUD 08 - RFS23/RFS24)
"""

import re
import time

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:3000"
PAUSA_ENTRE_ACOES = 1.5


@pytest.fixture(scope="module")
def driver():
    requests.post(f"{BASE_URL}/api/test/reset")

    options = webdriver.ChromeOptions()
    # Comente '--headless=new' para assistir o navegador na tela
    # options.add_argument("--headless=new")
    options.add_argument("--window-size=430,920")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    browser = webdriver.Chrome(options=options)
    browser.implicitly_wait(3)
    yield browser
    browser.quit()


def clicar(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'});", element)
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)
    time.sleep(PAUSA_ENTRE_ACOES)


def fazer_login(driver, email, senha):
    driver.get(BASE_URL)
    driver.execute_script(
        """
        document.getElementById('login-email').value = arguments[0];
        document.getElementById('login-senha').value = arguments[1];
        submeterLogin(new Event('submit'));
        """,
        email,
        senha,
    )
    time.sleep(PAUSA_ENTRE_ACOES)


def aguardar_alerta(driver, timeout=5):
    alerta = WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    time.sleep(PAUSA_ENTRE_ACOES)
    return alerta


def definir_valor(driver, element_id, valor):
    """Define o valor de campos input sem depender de máscara ou idioma do navegador."""
    driver.execute_script(
        """
        const el = document.getElementById(arguments[0]);
        el.value = arguments[1];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        """,
        element_id,
        valor,
    )
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


def selecionar_por_texto_parcial(driver, select_id, texto_parcial):
    driver.execute_script(
        """
        const sel = document.getElementById(arguments[0]);
        for (const opt of sel.options) {
            if (opt.text.includes(arguments[1]) || opt.value === arguments[1]) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                break;
            }
        }
        """,
        select_id,
        texto_parcial,
    )
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


# ============================================================================
# BLOCO RELEASE 04 (CRUD 07 — HISTÓRICO/GRADE DO ALUNO e CRUD 08 — TURMAS)
# ============================================================================
def abrir_tela_minha_grade(driver):
    navs = driver.find_elements(By.ID, "student-bottom-nav")
    if not navs or not navs[0].is_displayed():
        fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")

    view = driver.find_element(By.ID, "view-aluno-progresso")
    if not view.is_displayed():
        driver.execute_script("abrirTelaProgressoAluno();")
        WebDriverWait(driver, 5).until(
            EC.visibility_of_element_located((By.ID, "view-aluno-progresso"))
        )
        time.sleep(PAUSA_ENTRE_ACOES)


def abrir_tela_meu_semestre(driver):
    navs = driver.find_elements(By.ID, "student-bottom-nav")
    if not navs or not navs[0].is_displayed():
        fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")

    view = driver.find_element(By.ID, "view-aluno-home")
    if not view.is_displayed():
        driver.execute_script("voltarParaHomeAluno();")
        WebDriverWait(driver, 5).until(
            EC.visibility_of_element_located((By.ID, "view-aluno-home"))
        )
        time.sleep(PAUSA_ENTRE_ACOES)


def ch_obrigatoria_cumprida(driver):
    texto = driver.find_element(By.ID, "ch-obrigatoria-texto").text
    m = re.match(r"(\d+)h", texto)
    return int(m.group(1)) if m else 0


# ----------------------------------------------------------------------------
# CT26 — Lançar Disciplina Concluída no Histórico / Grade do Aluno (RFS17)
# ----------------------------------------------------------------------------
def test_CT26_lancar_disciplina_concluida_no_historico(driver):
    abrir_tela_minha_grade(driver)
    ch_antes = ch_obrigatoria_cumprida(driver)

    driver.execute_script("prepararNovoHistoricoGrade();")
    time.sleep(PAUSA_ENTRE_ACOES)

    selecionar_por_texto_parcial(driver, "hist-grade-disciplina", "COM220")
    selecionar_por_texto_parcial(driver, "hist-grade-situacao", "Finalizada")
    definir_valor(driver, "hist-grade-semestre", "2025.2")
    definir_valor(driver, "hist-grade-nota", "8.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "registrada no histórico" in alerta.text.lower() or "sucesso" in alerta.text.lower()
    assert ch_obrigatoria_cumprida(driver) == ch_antes + 64

    texto_finalizadas = driver.find_element(By.ID, "lista-progresso-finalizadas").text
    assert "COM220" in texto_finalizadas
    assert "8.5" in texto_finalizadas


# ----------------------------------------------------------------------------
# CT27 — Validação do Histórico (Nota < 6.0 para Aprovado e Semestre Inválido)
# ----------------------------------------------------------------------------
def test_CT27_validar_registro_historico_grade(driver):
    abrir_tela_minha_grade(driver)
    driver.execute_script("prepararNovoHistoricoGrade();")
    time.sleep(PAUSA_ENTRE_ACOES)

    selecionar_por_texto_parcial(driver, "hist-grade-disciplina", "COM240")
    selecionar_por_texto_parcial(driver, "hist-grade-situacao", "Finalizada")

    # 1. Semestre cursado em formato inválido
    definir_valor(driver, "hist-grade-semestre", "2025-3")
    definir_valor(driver, "hist-grade-nota", "7.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "aaaa.1" in alerta.text.lower() or "formato" in alerta.text.lower()

    # 2. Nota final inferior a 6.0 para situação Concluída (Aprovado) — RN03
    definir_valor(driver, "hist-grade-semestre", "2025.2")
    definir_valor(driver, "hist-grade-nota", "4.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "6.0 e 10.0" in alerta.text.lower()

    driver.execute_script("fecharFormHistoricoGrade();")
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


# ----------------------------------------------------------------------------
# CT28 — Consultar Grade / Histórico do Aluno com Filtros de Período e Natureza (RFS18)
# ----------------------------------------------------------------------------
def test_CT28_consultar_grade_aluno_com_filtros(driver):
    abrir_tela_minha_grade(driver)

    # Filtra apenas 4º período e Obrigatória (COM220 está em Finalizadas no 4º período)
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-periodo", "4")
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-tipo", "Obrigatória")
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_finalizadas = driver.find_element(By.ID, "lista-progresso-finalizadas").text
    assert "COM220" in texto_finalizadas
    assert "COM110" not in texto_finalizadas

    # Filtra apenas Optativas
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-periodo", "TODOS")
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-tipo", "Optativa")
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_faltam = driver.find_element(By.ID, "lista-progresso-faltam").text
    assert "SIN430" in texto_faltam
    assert "COM240" not in texto_faltam

    # Restaura os filtros
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-tipo", "TODOS")
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


# ----------------------------------------------------------------------------
# CT29 — Editar Registro do Histórico (Código bloqueado) e Remover (RFS19/RFS20)
# ----------------------------------------------------------------------------
def test_CT29_editar_e_remover_registro_historico(driver):
    abrir_tela_minha_grade(driver)
    ch_antes = ch_obrigatoria_cumprida(driver)

    card = driver.find_element(
        By.CSS_SELECTOR, "#lista-progresso-finalizadas [data-progresso-codigo='COM220']"
    )
    hist_id = card.get_attribute("data-historico-id")
    driver.execute_script(f"prepararEdicaoHistoricoGrade({hist_id});")
    time.sleep(PAUSA_ENTRE_ACOES)

    # A disciplina deve estar bloqueada na edição
    assert not driver.find_element(By.ID, "hist-grade-disciplina").is_enabled()

    definir_valor(driver, "hist-grade-semestre", "2026.1")
    definir_valor(driver, "hist-grade-nota", "9.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "atualizado" in alerta.text.lower() or "sucesso" in alerta.text.lower()
    texto_finalizadas = driver.find_element(By.ID, "lista-progresso-finalizadas").text
    assert "9.5" in texto_finalizadas
    assert "2026.1" in texto_finalizadas

    # Remove do histórico e verifica retorno para Pendentes ("Ainda faltam") e recálculo da CH
    driver.execute_script(f"window.confirm = () => true; removerHistoricoGrade({hist_id});")
    alerta = aguardar_alerta(driver)
    assert "removido" in alerta.text.lower()
    assert ch_obrigatoria_cumprida(driver) == ch_antes - 64
    assert "COM220" in driver.find_element(By.ID, "lista-progresso-faltam").text


# ----------------------------------------------------------------------------
# CT30 — Matricular Nova Turma no Semestre com Código, Sala e Horários (RFS21)
# ----------------------------------------------------------------------------
def test_CT30_matricular_turma_no_semestre(driver):
    abrir_tela_meu_semestre(driver)

    box = driver.find_element(By.ID, "box-add-disciplina-semestre")
    if not box.is_displayed():
        clicar(driver, driver.find_element(By.ID, "btn-abrir-add-semestre"))

    selecionar_por_texto_parcial(driver, "select-disc-disponivel", "IEPG22")
    definir_valor(driver, "turma-add-codigo", "T02")
    definir_valor(driver, "turma-add-sala", "Sala 204 (IEPG)")
    definir_valor(driver, "turma-add-docente", "Prof. Sandra Miranda")
    definir_valor(driver, "turma-add-horarios", "QUA-T3,QUA-T4,QUA-T5")
    driver.execute_script("adicionarDisciplinaNoSemestrePeloSelect(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "iepg22" in alerta.text.lower() and "adicionada" in alerta.text.lower()

    texto_lista = driver.find_element(By.ID, "lista-disciplinas-aluno").text
    assert "IEPG22 (T02)" in texto_lista


# ----------------------------------------------------------------------------
# CT31 — Validação de Choque de Horário na Matrícula do Semestre (RN01)
# ----------------------------------------------------------------------------
def test_CT31_validar_choque_de_horario_matricula(driver):
    abrir_tela_meu_semestre(driver)

    box = driver.find_element(By.ID, "box-add-disciplina-semestre")
    if not box.is_displayed():
        clicar(driver, driver.find_element(By.ID, "btn-abrir-add-semestre"))

    selecionar_por_texto_parcial(driver, "select-disc-disponivel", "COM220")
    definir_valor(driver, "turma-add-codigo", "T01")
    # Força o mesmo horário de SDES06 (SEG-M1,SEG-M2) para validar o bloqueio de choque (RN01)
    definir_valor(driver, "turma-add-horarios", "SEG-M1,SEG-M2")
    driver.execute_script("adicionarDisciplinaNoSemestrePeloSelect(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "choque de horário" in alerta.text.lower()
    assert "sdes06" in alerta.text.lower()

    driver.execute_script("alternarBoxAdicionarDisciplinaAluno();")
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


# ----------------------------------------------------------------------------
# CT32 — Consultar Turmas do Semestre com Filtros de Dia e Busca (RFS22)
# ----------------------------------------------------------------------------
def test_CT32_consultar_turmas_semestre_com_filtros(driver):
    abrir_tela_meu_semestre(driver)

    definir_valor(driver, "filtro-turma-busca", "IEPG22")
    selecionar_por_texto_parcial(driver, "filtro-turma-dia", "QUA")
    driver.execute_script("filtrarTurmasSemestreAluno();")
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_lista = driver.find_element(By.ID, "lista-disciplinas-aluno").text
    assert "IEPG22" in texto_lista
    assert "SDES06" not in texto_lista

    # Restaura os filtros de turmas
    definir_valor(driver, "filtro-turma-busca", "")
    selecionar_por_texto_parcial(driver, "filtro-turma-dia", "TODOS")
    driver.execute_script("filtrarTurmasSemestreAluno();")
    time.sleep(PAUSA_ENTRE_ACOES)
    assert "SDES06" in driver.find_element(By.ID, "lista-disciplinas-aluno").text


# ----------------------------------------------------------------------------
# CT33 — Alterar Dados da Turma (com validação de choque) e Remover do Semestre (RFS23/RFS24)
# ----------------------------------------------------------------------------
def test_CT33_alterar_e_remover_turma_do_semestre(driver):
    abrir_tela_meu_semestre(driver)

    card_iepg = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-disciplina-codigo='IEPG22']"))
    )
    driver.execute_script("arguments[0].click();", card_iepg)
    time.sleep(PAUSA_ENTRE_ACOES)
    WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-disciplina-detalhe"))
    )

    driver.execute_script("prepararEdicaoTurmaAtual();")
    time.sleep(PAUSA_ENTRE_ACOES)

    # A disciplina vinculada fica bloqueada para troca
    assert not driver.find_element(By.ID, "edit-turma-disciplina").is_enabled()

    # 1. Tenta salvar horário conflitante com SDES06 (SEG-M1)
    definir_valor(driver, "edit-turma-horarios", "SEG-M1,SEG-M2")
    driver.execute_script("salvarEdicaoTurmaAtual(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "choque de horário" in alerta.text.lower()

    # 2. Salva edição válida da turma (código T03, nova sala e horário livre)
    definir_valor(driver, "edit-turma-codigo", "T03")
    definir_valor(driver, "edit-turma-sala", "Auditório IEPG")
    definir_valor(driver, "edit-turma-horarios", "SEX-T1,SEX-T2")
    driver.execute_script("salvarEdicaoTurmaAtual(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "atualizada" in alerta.text.lower() or "sucesso" in alerta.text.lower()
    assert "Turma T03" in driver.find_element(By.ID, "detalhe-turma-codigo").text
    assert "Auditório IEPG" in driver.find_element(By.ID, "detalhe-sala").text

    # 3. Remove (tranca) a matrícula do semestre atual (RFS24)
    driver.execute_script("retirarDisciplinaDoSemestreAtual();")
    alerta = aguardar_alerta(driver)
    assert "retirada do semestre" in alerta.text.lower()
    assert "IEPG22" not in driver.find_element(By.ID, "lista-disciplinas-aluno").text
