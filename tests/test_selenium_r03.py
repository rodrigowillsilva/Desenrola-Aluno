"""
Testes Automatizados Selenium — Release 03 (Desenrola Aluno)
Cobre os CRUDs 05 e 06:
- CT18: Registrar Falta no Histórico de Frequência (data, horas e justificativa)
- CT19: Validação do Registro de Falta (data futura e horas fora do limite)
- CT20: Alterar Registro de Falta e Recalcular o Total de Faltas
- CT21: Excluir Registro de Falta e Recalcular o Total de Faltas
- CT22: Cadastrar Avaliação no Calendário (Próximas Avaliações)
- CT23: Validação de Avaliação (título, nota e duplicidade)
- CT24: Consultar Avaliações com Filtros de Disciplina e Tipo
- CT25: Alterar (lançar nota) e Excluir Avaliação
"""

import re
import time
from datetime import date, timedelta

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:3000"
PAUSA_ENTRE_ACOES = 0.25


@pytest.fixture(scope="module")
def driver():
    requests.post(f"{BASE_URL}/api/test/reset")

    options = webdriver.ChromeOptions()
    # Comente '--headless=new' para assistir o navegador na tela
    options.add_argument("--headless=new")
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
    time.sleep(0.4)


def aguardar_alerta(driver, timeout=5):
    alerta = WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    time.sleep(PAUSA_ENTRE_ACOES)
    return alerta


# ============================================================================
# BLOCO RELEASE 03 (copiado integralmente para o test_selenium_geral.py)
# ============================================================================
DATA_SEMINARIO = (date.today() + timedelta(days=20)).isoformat()


def definir_valor(driver, element_id, valor):
    """Define o valor de campos date/number sem depender do idioma do navegador."""
    driver.execute_script(
        """
        const el = document.getElementById(arguments[0]);
        el.value = arguments[1];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        """,
        element_id,
        valor,
    )


def faltas_acumuladas(driver):
    texto = driver.find_element(By.ID, "detalhe-faltas-badge").text
    return int(re.match(r"(\d+)h", texto).group(1))


def abrir_disciplina_sdes06(driver):
    navs = driver.find_elements(By.ID, "student-bottom-nav")
    if not navs or not navs[0].is_displayed():
        fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")

    detalhe = driver.find_element(By.ID, "view-disciplina-detalhe")
    if detalhe.is_displayed():
        return

    driver.execute_script("voltarParaHomeAluno();")
    card = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-disciplina-codigo='SDES06']"))
    )
    clicar(driver, card)
    WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-disciplina-detalhe"))
    )


def abrir_tela_avaliacoes(driver):
    navs = driver.find_elements(By.ID, "student-bottom-nav")
    if not navs or not navs[0].is_displayed():
        fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")

    view = driver.find_element(By.ID, "view-aluno-avaliacoes")
    if not view.is_displayed():
        driver.execute_script("abrirTelaAvaliacoesAluno();")
        WebDriverWait(driver, 5).until(
            EC.visibility_of_element_located((By.ID, "view-aluno-avaliacoes"))
        )
        time.sleep(0.5)


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


def card_falta_por_texto(driver, texto):
    for _ in range(10):
        for card in driver.find_elements(By.CSS_SELECTOR, "#lista-faltas-historico [data-falta-id]"):
            if texto in card.text:
                return card
        time.sleep(0.2)
    return None


def card_avaliacao_por_titulo(driver, titulo):
    for _ in range(10):
        for card in driver.find_elements(By.CSS_SELECTOR, "[data-avaliacao-titulo]"):
            if card.get_attribute("data-avaliacao-titulo") == titulo:
                return card
        time.sleep(0.2)
    return None


# ----------------------------------------------------------------------------
# CT18 — Registrar Falta no Histórico de Frequência (RF08)
# ----------------------------------------------------------------------------
def test_CT18_registrar_falta_no_historico(driver):
    abrir_disciplina_sdes06(driver)
    total_antes = faltas_acumuladas(driver)

    driver.execute_script("prepararNovaFalta();")
    time.sleep(PAUSA_ENTRE_ACOES)
    definir_valor(driver, "falta-data", (date.today() - timedelta(days=3)).isoformat())
    definir_valor(driver, "falta-horas", "2")
    driver.execute_script("document.getElementById('falta-justificativa').value = 'Consulta medica';")
    driver.execute_script("salvarFalta(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "registrada" in alerta.text.lower()
    assert faltas_acumuladas(driver) == total_antes + 2
    assert card_falta_por_texto(driver, "Consulta medica") is not None


# ----------------------------------------------------------------------------
# CT19 — Validação do Registro de Falta (data futura e horas fora do limite)
# ----------------------------------------------------------------------------
def test_CT19_validar_registro_de_falta(driver):
    abrir_disciplina_sdes06(driver)
    driver.execute_script("prepararNovaFalta();")
    time.sleep(PAUSA_ENTRE_ACOES)

    definir_valor(driver, "falta-data", (date.today() + timedelta(days=5)).isoformat())
    definir_valor(driver, "falta-horas", "1")
    driver.execute_script("salvarFalta(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "futura" in alerta.text.lower()

    definir_valor(driver, "falta-data", date.today().isoformat())
    definir_valor(driver, "falta-horas", "9")
    driver.execute_script("salvarFalta(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "entre 1 e 8" in alerta.text.lower()

    driver.execute_script("fecharFormFalta();")


# ----------------------------------------------------------------------------
# CT20 — Alterar Registro de Falta e Recalcular o Total (RF08)
# ----------------------------------------------------------------------------
def test_CT20_alterar_registro_de_falta(driver):
    abrir_disciplina_sdes06(driver)
    total_antes = faltas_acumuladas(driver)

    card = card_falta_por_texto(driver, "Consulta medica")
    assert card is not None, "Registro de falta não encontrado para edição"
    falta_id = card.get_attribute("data-falta-id")
    driver.execute_script(f"prepararEdicaoFalta({falta_id});")
    time.sleep(PAUSA_ENTRE_ACOES)

    definir_valor(driver, "falta-horas", "1")
    driver.execute_script("document.getElementById('falta-justificativa').value = 'Consulta medica remarcada';")
    driver.execute_script("salvarFalta(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "atualizado" in alerta.text.lower()
    assert faltas_acumuladas(driver) == total_antes - 1
    assert card_falta_por_texto(driver, "Consulta medica remarcada") is not None


# ----------------------------------------------------------------------------
# CT21 — Excluir Registro de Falta e Recalcular o Total (RF08)
# ----------------------------------------------------------------------------
def test_CT21_excluir_registro_de_falta(driver):
    abrir_disciplina_sdes06(driver)
    total_antes = faltas_acumuladas(driver)

    card = card_falta_por_texto(driver, "Consulta medica remarcada")
    assert card is not None, "Registro de falta não encontrado para exclusão"
    falta_id = card.get_attribute("data-falta-id")
    driver.execute_script(f"window.confirm = () => true; removerFalta({falta_id});")

    alerta = aguardar_alerta(driver)
    assert "removido" in alerta.text.lower()
    assert faltas_acumuladas(driver) == total_antes - 1
    assert card_falta_por_texto(driver, "Consulta medica remarcada") is None


# ----------------------------------------------------------------------------
# CT22 — Cadastrar Avaliação no Calendário (RF09)
# ----------------------------------------------------------------------------
def test_CT22_cadastrar_avaliacao(driver):
    abrir_tela_avaliacoes(driver)

    driver.execute_script("prepararNovaAvaliacao();")
    time.sleep(PAUSA_ENTRE_ACOES)
    selecionar_por_texto_parcial(driver, "avaliacao-disciplina", "SDES06")
    selecionar_por_texto_parcial(driver, "avaliacao-tipo", "Seminário")
    definir_valor(driver, "avaliacao-data", DATA_SEMINARIO)
    driver.execute_script("document.getElementById('avaliacao-titulo').value = 'Seminario de Riscos';")
    definir_valor(driver, "avaliacao-peso", "15")
    driver.execute_script("salvarAvaliacao(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "cadastrada" in alerta.text.lower()
    assert card_avaliacao_por_titulo(driver, "Seminario de Riscos") is not None
    assert "SDES06" in driver.find_element(By.ID, "lista-avaliacoes-proximas").text


# ----------------------------------------------------------------------------
# CT23 — Validação de Avaliação (título, nota e duplicidade)
# ----------------------------------------------------------------------------
def test_CT23_validar_avaliacao(driver):
    abrir_tela_avaliacoes(driver)
    driver.execute_script("prepararNovaAvaliacao();")
    time.sleep(PAUSA_ENTRE_ACOES)
    selecionar_por_texto_parcial(driver, "avaliacao-disciplina", "SDES06")
    definir_valor(driver, "avaliacao-data", DATA_SEMINARIO)
    definir_valor(driver, "avaliacao-peso", "15")

    # Título curto demais
    driver.execute_script("document.getElementById('avaliacao-titulo').value = 'Ab';")
    driver.execute_script("salvarAvaliacao(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "entre 3 e 80" in alerta.text.lower()

    # Nota fora da faixa
    driver.execute_script("document.getElementById('avaliacao-titulo').value = 'Trabalho Final';")
    definir_valor(driver, "avaliacao-nota", "11")
    driver.execute_script("salvarAvaliacao(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "entre 0 e 10" in alerta.text.lower()

    # Duplicidade (mesmo título, data e disciplina de CT22)
    driver.execute_script("document.getElementById('avaliacao-titulo').value = 'Seminario de Riscos';")
    definir_valor(driver, "avaliacao-nota", "")
    driver.execute_script("salvarAvaliacao(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "já existe" in alerta.text.lower()

    driver.execute_script("fecharFormAvaliacao();")


# ----------------------------------------------------------------------------
# CT24 — Consultar Avaliações com Filtros de Disciplina e Tipo (RF09)
# ----------------------------------------------------------------------------
def test_CT24_consultar_avaliacoes_com_filtros(driver):
    abrir_tela_avaliacoes(driver)

    # Filtro por tipo: Prova
    selecionar_por_texto_parcial(driver, "filtro-aval-tipo", "Prova")
    driver.execute_script("consultarAvaliacoes();")
    time.sleep(0.4)

    proximas = driver.find_element(By.ID, "lista-avaliacoes-proximas").text
    passadas = driver.find_element(By.ID, "lista-avaliacoes-passadas").text
    assert "Prova 2" in proximas
    assert "Trabalho" not in proximas
    assert "Seminario" not in proximas
    assert "Prova 1 - Gerência de Projetos" in passadas

    # Filtro por disciplina: COM210
    selecionar_por_texto_parcial(driver, "filtro-aval-tipo", "TODOS")
    selecionar_por_texto_parcial(driver, "filtro-aval-disciplina", "COM210")
    driver.execute_script("consultarAvaliacoes();")
    time.sleep(0.4)

    proximas = driver.find_element(By.ID, "lista-avaliacoes-proximas").text
    assert "Prova 2" in proximas
    assert "Seminario de Riscos" not in proximas

    # Restaura os filtros
    selecionar_por_texto_parcial(driver, "filtro-aval-disciplina", "TODOS")
    driver.execute_script("consultarAvaliacoes();")
    time.sleep(0.4)
    assert "Seminario de Riscos" in driver.find_element(By.ID, "lista-avaliacoes-proximas").text


# ----------------------------------------------------------------------------
# CT25 — Alterar (lançar nota) e Excluir Avaliação (RF09)
# ----------------------------------------------------------------------------
def test_CT25_alterar_e_excluir_avaliacao(driver):
    abrir_tela_avaliacoes(driver)
    card = card_avaliacao_por_titulo(driver, "Seminario de Riscos")
    assert card is not None, "Avaliação não encontrada para edição"
    aval_id = card.get_attribute("data-avaliacao-id")
    driver.execute_script(f"prepararEdicaoAvaliacao({aval_id});")
    time.sleep(PAUSA_ENTRE_ACOES)

    # A disciplina não pode ser trocada na edição
    assert not driver.find_element(By.ID, "avaliacao-disciplina").is_enabled()

    driver.execute_script("document.getElementById('avaliacao-titulo').value = 'Seminario de Gestao de Riscos';")
    definir_valor(driver, "avaliacao-nota", "9")
    driver.execute_script("salvarAvaliacao(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "atualizada" in alerta.text.lower()
    assert card_avaliacao_por_titulo(driver, "Seminario de Gestao de Riscos") is not None
    assert card_avaliacao_por_titulo(driver, "Seminario de Riscos") is None

    card = card_avaliacao_por_titulo(driver, "Seminario de Gestao de Riscos")
    aval_id = card.get_attribute("data-avaliacao-id")
    driver.execute_script(f"window.confirm = () => true; removerAvaliacao({aval_id});")

    alerta = aguardar_alerta(driver)
    assert "removida" in alerta.text.lower()
    assert card_avaliacao_por_titulo(driver, "Seminario de Gestao de Riscos") is None

