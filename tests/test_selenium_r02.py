"""
Testes Automatizados Selenium — Release 02 (Desenrola Aluno)
Cobre os CRUDs 03 e 04:
- CT10: Cadastro de Disciplina com Carga Horária, Tipo (Obrigatória/Optativa) e Pré-requisitos
- CT11: Validação de Pré-requisito Circular (Recusa direta/indireta)
- CT12: Consulta de Disciplinas por Período e Tipo
- CT13: Alteração de Disciplina com Código Bloqueado
- CT14: Proteção de Exclusão de Disciplina (Impede se for pré-requisito ou em curso)
- CT15: Cadastro de Currículo com Parâmetros de Carga Horária
- CT16: Consulta da Grade Curricular por Período (Coordenação)
- CT17: Visualização da Grade do Aluno (Divisão por Período, Tags de Pré-requisitos e Carga Horária)
"""

import time
import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:3000"
PAUSA_ENTRE_ACOES = 0.8


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
    time.sleep(PAUSA_ENTRE_ACOES * 0.4)
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'});", element)
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)
    time.sleep(PAUSA_ENTRE_ACOES)


def fazer_login(driver, email, senha):
    driver.get(BASE_URL)
    time.sleep(PAUSA_ENTRE_ACOES * 0.4)
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


# ============================================================================
# CT10 — Incluir Disciplina com CH, Tipo e Pré-requisitos (RFS09)
# ============================================================================
def test_CT10_incluir_disciplina_com_prerequisitos(driver):
    fazer_login(driver, "admin@unifei.edu.br", "Admin123")
    clicar(driver, driver.find_element(By.ID, "tab-disciplinas"))
    clicar(driver, driver.find_element(By.ID, "btn-nova-disciplina"))

    driver.find_element(By.ID, "disc-codigo").send_keys("SIN510")
    Select(driver.find_element(By.ID, "disc-curso")).select_by_visible_text("SIN - Sistemas de Informação")
    driver.find_element(By.ID, "disc-nome").send_keys("Governança e Gestão de TI")
    driver.find_element(By.ID, "disc-semestre").clear()
    driver.find_element(By.ID, "disc-semestre").send_keys("7")
    Select(driver.find_element(By.ID, "disc-ch")).select_by_value("64")
    Select(driver.find_element(By.ID, "disc-tipo")).select_by_value("Optativa")
    driver.find_element(By.ID, "disc-docente").send_keys("Prof. Maurício Silva")
    driver.find_element(By.ID, "disc-sala").send_keys("I.1.2.15")
    driver.find_element(By.ID, "disc-horarios").send_keys("SEG-M4,SEG-M5")

    # Marca SDES06 como pré-requisito
    checkboxes = driver.find_elements(By.CSS_SELECTOR, "input[name='disc-prereq-item']")
    for cb in checkboxes:
        parent_text = cb.find_element(By.XPATH, "..").text
        if "SDES06" in parent_text:
            clicar(driver, cb)
            break

    clicar(driver, driver.find_element(By.ID, "btn-salvar-disciplina"))
    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "cadastrada" in alerta.text.lower()
    assert "SIN510" in driver.find_element(By.ID, "tbody-disciplinas").text


# ============================================================================
# CT11 — Bloqueio de Pré-requisito Circular (RFS11 / Regra de Negócio)
# ============================================================================
def test_CT11_bloqueio_prerequisito_circular(driver):
    # COM111 já tem como pré-requisito COM110 no banco.
    # Se tentarmos editar COM110 colocando COM111 como pré-requisito, deve barrar por dependência circular.
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-disciplinas [data-catalogo-codigo]")
    for card in cards:
        if card.get_attribute("data-catalogo-codigo") == "COM110":
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-editar-disciplina"))
            break

    # Marca COM111 como pré-requisito de COM110
    checkboxes = driver.find_elements(By.CSS_SELECTOR, "input[name='disc-prereq-item']")
    for cb in checkboxes:
        parent_text = cb.find_element(By.XPATH, "..").text
        if "COM111" in parent_text:
            clicar(driver, cb)
            break

    clicar(driver, driver.find_element(By.ID, "btn-salvar-disciplina"))
    alerta = aguardar_alerta(driver)
    assert "circular" in alerta.text.lower()
    clicar(driver, driver.find_element(By.ID, "btn-cancelar-disciplina"))


# ============================================================================
# CT12 — Consultar Disciplinas com Filtros de Período e Tipo (RFS10)
# ============================================================================
def test_CT12_consultar_disciplinas_filtros(driver):
    # Filtra por Optativas
    Select(driver.find_element(By.ID, "filtro-disc-tipo")).select_by_value("Optativa")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-disciplinas"))
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_disc = driver.find_element(By.ID, "tbody-disciplinas").text
    assert "Optativa" in texto_disc
    assert "COM110" not in texto_disc  # COM110 é obrigatória

    # Reseta filtros
    Select(driver.find_element(By.ID, "filtro-disc-tipo")).select_by_value("TODOS")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-disciplinas"))
    time.sleep(PAUSA_ENTRE_ACOES)


# ============================================================================
# CT13 — Alterar Disciplina com Código Bloqueado (RFS11)
# ============================================================================
def test_CT13_alterar_disciplina_bloqueio_codigo(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-disciplinas [data-catalogo-codigo]")
    for card in cards:
        if card.get_attribute("data-catalogo-codigo") == "SIN510":
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-editar-disciplina"))
            break

    # Campo de código deve estar desabilitado
    assert not driver.find_element(By.ID, "disc-codigo").is_enabled()

    campo_nome = driver.find_element(By.ID, "disc-nome")
    campo_nome.clear()
    campo_nome.send_keys("Governança e Estratégia de TI")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-disciplina"))

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "atualizada" in alerta.text.lower()
    assert "Governança e Estratégia de TI" in driver.find_element(By.ID, "tbody-disciplinas").text


# ============================================================================
# CT14 — Impedir Exclusão de Disciplina Pré-requisito (RFS12)
# ============================================================================
def test_CT14_impedir_exclusao_disciplina_prerequisito(driver):
    # SDES06 é pré-requisito de SIN510 que criamos -> deve impedir remoção
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-disciplinas [data-catalogo-codigo]")
    for card in cards:
        if card.get_attribute("data-catalogo-codigo") == "SDES06":
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-remover-disciplina"))
            driver.switch_to.alert.accept()
            break

    alerta = aguardar_alerta(driver)
    assert "não é possível remover" in alerta.text.lower() or "pré-requisito" in alerta.text.lower()


# ============================================================================
# CT15 — Incluir e Consultar Currículo com Parâmetros de CH (RFS13 / RFS14)
# ============================================================================
def test_CT15_crud_curriculo_parametros(driver):
    clicar(driver, driver.find_element(By.ID, "tab-curriculo"))

    # Verifica se os currículos existentes estão listados
    texto_curr = driver.find_element(By.ID, "tbody-curriculos").text
    assert "SIN-2023" in texto_curr

    # Edita os parâmetros do currículo SIN-2023
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-curriculos [data-curriculo-codigo]")
    for card in cards:
        if "SIN-2023" in card.get_attribute("data-curriculo-codigo"):
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-editar-curriculo"))
            break

    assert not driver.find_element(By.ID, "curriculo-codigo").is_enabled()
    campo_opt = driver.find_element(By.ID, "curriculo-ch-opt")
    campo_opt.clear()
    campo_opt.send_keys("288")

    campo_total = driver.find_element(By.ID, "curriculo-ch-total")
    campo_total.clear()
    campo_total.send_keys("3250")

    clicar(driver, driver.find_element(By.ID, "btn-salvar-curriculo"))

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "atualizados" in alerta.text.lower()


# ============================================================================
# CT16 — Visualizar Grade Curricular do Currículo por Período (RFS14 / RFS15)
# ============================================================================
def test_CT16_visualizar_grade_curriculo_periodo(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-curriculos [data-curriculo-codigo]")
    for card in cards:
        if "SIN-2023" in card.get_attribute("data-curriculo-codigo"):
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-grade-curriculo"))
            break

    grade_card = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "card-grade-curriculo"))
    )
    assert "Grade Curricular: SIN-2023" in grade_card.text
    assert "1º Período" in grade_card.text
    clicar(driver, driver.find_element(By.ID, "btn-fechar-grade"))


# ============================================================================
# CT17 — Visão do Aluno: Grade por Período, Tags de Pré-requisitos e CH (RFS17/18)
# ============================================================================
def test_CT17_visao_aluno_grade_prerequisitos_ch(driver):
    fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")
    clicar(driver, driver.find_element(By.ID, "tab-aluno-grade"))

    tela_progresso = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-aluno-progresso"))
    )

    # 1. Verifica barra de progresso de Carga Horária
    assert "Carga horária" in tela_progresso.text
    assert "Obrigatórias" in tela_progresso.text
    assert "Optativas" in tela_progresso.text

    # 2. Verifica divisores de período na lista
    assert "período" in driver.find_element(By.ID, "lista-progresso-faltam").text.lower()

    # 3. Verifica pré-requisitos informativos na matéria SIN510
    card_sin510 = driver.find_element(By.CSS_SELECTOR, "#lista-progresso-faltam [data-progresso-codigo='SIN510']")
    assert "Pré-req:" in card_sin510.text
    assert "SDES06" in card_sin510.text
    assert "Optativa" in card_sin510.text

    # 4. Aluno consegue puxar SIN510 mesmo com aviso de pré-requisito (sem bloqueio rígido)
    clicar(driver, card_sin510.find_element(By.CSS_SELECTOR, ".btn-puxar-semestre"))
    time.sleep(PAUSA_ENTRE_ACOES)
    assert "SIN510" in driver.find_element(By.ID, "lista-progresso-fazendo").text

