"""
Testes Automatizados Mobile-First com Selenium WebDriver — Desenrola Aluno
Verifica todos os fluxos de Autenticação, Gestão de Contas de Alunos/Coordenação e Catálogo de Cursos
em viewport Mobile (412x915).
"""

import time
import pytest
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:3000"


@pytest.fixture(scope="module")
def driver():
    requests.post(f"{BASE_URL}/api/test/reset")

    options = webdriver.ChromeOptions()
    # Comente a linha '--headless=new' se quiser assistir ao navegador mobile rodando na tela
    options.add_argument("--headless=new")
    options.add_argument("--window-size=430,920")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    browser = webdriver.Chrome(options=options)
    browser.implicitly_wait(3)
    yield browser
    browser.quit()


def clicar(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    try:
        element.click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)


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
    time.sleep(0.5)


# ============================================================================
# CT36 — Validar Login, Tela Inicial do Aluno (Disciplinas + Grade) e Coordenação
# ============================================================================
def test_CT36_autenticacao_e_rbac(driver):
    # 1. Tentativa de login inválido
    fazer_login(driver, "admin@unifei.edu.br", "SenhaErrada999")
    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "inválidos" in alerta.text.lower()

    # 2. Login válido como Aluno: verifica Lista de Disciplinas + Grade de Horários (Seg a Sex)
    fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")
    tela_aluno = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-aluno-home"))
    )
    assert "SDES06" in tela_aluno.text
    assert "07:00 - 07:55" in tela_aluno.text
    assert "13:30 - 14:25" in tela_aluno.text

    # Clica na disciplina SDES06 para abrir a tela específica da disciplina e adicionar 1 falta
    card_sdes06 = driver.find_element(By.CSS_SELECTOR, "[data-disciplina-codigo='SDES06']")
    clicar(driver, card_sdes06)

    tela_detalhe = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-disciplina-detalhe"))
    )
    assert "Gerência de Projetos de Software" in tela_detalhe.text
    badge_antes = driver.find_element(By.ID, "detalhe-faltas-badge").text
    assert "2h" in badge_antes

    clicar(driver, driver.find_element(By.ID, "btn-adicionar-falta"))
    time.sleep(0.3)
    badge_depois = driver.find_element(By.ID, "detalhe-faltas-badge").text
    assert "3h" in badge_depois

    driver.execute_script("voltarParaHomeAluno();")
    WebDriverWait(driver, 5).until(EC.visibility_of_element_located((By.ID, "view-aluno-home")))

    # 3. Login válido como Administrador
    fazer_login(driver, "admin@unifei.edu.br", "Admin123")
    info_user = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "logged-user-info"))
    )
    assert "Administrador" in info_user.text
    assert driver.find_element(By.ID, "btn-novo-usuario").is_displayed()


# ============================================================================
# CT01 — Validar Cadastro de Novo Aluno e Unicidade de CPF/Matrícula
# ============================================================================
def test_CT01_incluir_usuario_e_unicidade(driver):
    fazer_login(driver, "admin@unifei.edu.br", "Admin123")
    btn_novo = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "btn-novo-usuario"))
    )
    clicar(driver, btn_novo)

    driver.find_element(By.ID, "usuario-nome").send_keys("Gabriel Barbosa Teste")
    driver.find_element(By.ID, "usuario-cpf").send_keys("39053344705")
    driver.find_element(By.ID, "usuario-email").send_keys("gabriel.qa@unifei.edu.br")
    driver.find_element(By.ID, "usuario-senha").send_keys("Teste1234")
    Select(driver.find_element(By.ID, "usuario-perfil")).select_by_visible_text("Aluno (Discente)")
    driver.find_element(By.ID, "usuario-matricula").send_keys("2023009876")

    sel_curso = Select(driver.find_element(By.ID, "usuario-curso"))
    sel_curso.select_by_index(1)
    time.sleep(0.3)

    driver.find_element(By.ID, "usuario-semestre").send_keys("2023.1")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-usuario"))

    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "sucesso" in alerta.text.lower()

    # Tenta incluir outro aluno com o mesmo CPF (deve criticar duplicidade)
    clicar(driver, driver.find_element(By.ID, "btn-novo-usuario"))
    driver.find_element(By.ID, "usuario-nome").send_keys("Outro Aluno Duplicado")
    driver.find_element(By.ID, "usuario-cpf").send_keys("39053344705")
    driver.find_element(By.ID, "usuario-email").send_keys("outro@unifei.edu.br")
    driver.find_element(By.ID, "usuario-senha").send_keys("Teste1234")
    driver.find_element(By.ID, "usuario-matricula").send_keys("2023005555")
    Select(driver.find_element(By.ID, "usuario-curso")).select_by_index(1)
    time.sleep(0.3)
    driver.find_element(By.ID, "usuario-semestre").send_keys("2023.1")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-usuario"))

    alerta_erro = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "cpf" in alerta_erro.text.lower()
    clicar(driver, driver.find_element(By.ID, "btn-cancelar-usuario"))


# ============================================================================
# CT02 — Validar Busca e Filtros de Alunos
# ============================================================================
def test_CT02_consultar_usuarios_com_filtros(driver):
    campo_filtro = driver.find_element(By.ID, "filtro-usuario-nome")
    campo_filtro.clear()
    campo_filtro.send_keys("Gabriel Barbosa")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-usuarios"))
    time.sleep(0.3)

    lista_texto = driver.find_element(By.ID, "tbody-usuarios").text
    assert "Gabriel Barbosa Teste" in lista_texto
    assert "Lucas Margelo Discente" not in lista_texto

    campo_filtro.clear()
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-usuarios"))
    time.sleep(0.3)


# ============================================================================
# CT03 — Validar Edição de Perfil e Bloqueio de CPF/Matrícula
# ============================================================================
def test_CT03_alterar_usuario_e_campos_bloqueados(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-usuarios [data-usuario-id]")
    for card in cards:
        if "Gabriel Barbosa Teste" in card.text:
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-editar-usuario"))
            break

    assert not driver.find_element(By.ID, "usuario-cpf").is_enabled()
    assert not driver.find_element(By.ID, "usuario-matricula").is_enabled()

    campo_nome = driver.find_element(By.ID, "usuario-nome")
    campo_nome.clear()
    campo_nome.send_keys("Gabriel Barbosa Alterado")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-usuario"))

    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "sucesso" in alerta.text.lower()
    assert "Gabriel Barbosa Alterado" in driver.find_element(By.ID, "tbody-usuarios").text


# ============================================================================
# CT04 — Validar Exclusão de Conta e Proteção do Único Administrador
# ============================================================================
def test_CT04_remover_usuario_e_proteger_ultimo_admin(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-usuarios [data-usuario-id]")
    for card in cards:
        if "Rodrigo William Admin" in card.text:
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-remover-usuario"))
            driver.switch_to.alert.accept()
            break

    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "único administrador" in alerta.text.lower()

    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-usuarios [data-usuario-id]")
    for card in cards:
        if "Gabriel Barbosa Alterado" in card.text:
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-remover-usuario"))
            driver.switch_to.alert.accept()
            break

    time.sleep(0.3)
    assert "Gabriel Barbosa Alterado" not in driver.find_element(By.ID, "tbody-usuarios").text


# ============================================================================
# CT05 — Validar Cadastro de Curso e Impedimento de Sigla Duplicada
# ============================================================================
def test_CT05_incluir_curso_e_codigo_unico(driver):
    clicar(driver, driver.find_element(By.ID, "tab-cursos"))
    clicar(driver, driver.find_element(By.ID, "btn-novo-curso"))

    driver.find_element(By.ID, "curso-codigo").send_keys("EMA")
    driver.find_element(By.ID, "curso-nome").send_keys("Engenharia de Materiais")
    Select(driver.find_element(By.ID, "curso-instituto")).select_by_value("IEM")
    Select(driver.find_element(By.ID, "curso-grau")).select_by_value("Bacharelado")
    Select(driver.find_element(By.ID, "curso-turno")).select_by_value("Integral")

    d_padrao = driver.find_element(By.ID, "curso-duracao-padrao")
    d_padrao.clear()
    d_padrao.send_keys("10")

    d_max = driver.find_element(By.ID, "curso-duracao-maxima")
    d_max.clear()
    d_max.send_keys("15")

    clicar(driver, driver.find_element(By.ID, "btn-salvar-curso"))

    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "sucesso" in alerta.text.lower()

    # Tenta cadastrar sigla duplicada 'SIN'
    clicar(driver, driver.find_element(By.ID, "btn-novo-curso"))
    driver.find_element(By.ID, "curso-codigo").send_keys("SIN")
    driver.find_element(By.ID, "curso-nome").send_keys("Outro Curso Qualquer")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-curso"))

    alerta_dup = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "código" in alerta_dup.text.lower()
    clicar(driver, driver.find_element(By.ID, "btn-cancelar-curso"))


# ============================================================================
# CT06 — Validar Busca de Cursos por Instituto e Turno
# ============================================================================
def test_CT06_consultar_cursos_por_instituto_e_turno(driver):
    Select(driver.find_element(By.ID, "filtro-curso-instituto")).select_by_value("IEM")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-cursos"))
    time.sleep(0.3)

    texto_cursos = driver.find_element(By.ID, "tbody-cursos").text
    assert "Engenharia de Materiais" in texto_cursos
    assert "Sistemas de Informação" not in texto_cursos

    Select(driver.find_element(By.ID, "filtro-curso-instituto")).select_by_value("TODOS")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-cursos"))
    time.sleep(0.3)


# ============================================================================
# CT07 — Validar Edição de Curso e Bloqueio da Sigla/Código
# ============================================================================
def test_CT07_alterar_curso_e_bloqueio_codigo(driver):
    card_ema = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-curso-codigo='EMA']"))
    )
    clicar(driver, card_ema.find_element(By.CSS_SELECTOR, ".btn-editar-curso"))
    time.sleep(0.2)

    assert not driver.find_element(By.ID, "curso-codigo").is_enabled()

    campo_nome = driver.find_element(By.ID, "curso-nome")
    campo_nome.clear()
    campo_nome.send_keys("Engenharia de Materiais Aplicada")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-curso"))
    time.sleep(0.4)

    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "sucesso" in alerta.text.lower()
    assert "Engenharia de Materiais Aplicada" in driver.find_element(By.ID, "tbody-cursos").text


# ============================================================================
# CT08 — Validar Impedimento de Exclusão de Curso com Alunos Vinculados
# ============================================================================
def test_CT08_impedir_exclusao_curso_com_dependentes_e_remover_livre(driver):
    # 1. Tenta excluir o curso SIN (possui aluno vinculado -> deve impedir)
    card_sin = driver.find_element(By.CSS_SELECTOR, "[data-curso-codigo='SIN']")
    clicar(driver, card_sin.find_element(By.CSS_SELECTOR, ".btn-remover-curso"))
    driver.switch_to.alert.accept()

    alerta = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    assert "não é possível excluir" in alerta.text.lower()

    # 2. Exclui o curso EMA (sem alunos vinculados -> deve permitir)
    card_ema = driver.find_element(By.CSS_SELECTOR, "[data-curso-codigo='EMA']")
    clicar(driver, card_ema.find_element(By.CSS_SELECTOR, ".btn-remover-curso"))
    driver.switch_to.alert.accept()
    time.sleep(0.3)

    assert "Engenharia de Materiais Aplicada" not in driver.find_element(By.ID, "tbody-cursos").text


# ============================================================================
