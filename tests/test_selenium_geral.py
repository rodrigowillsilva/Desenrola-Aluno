"""
Suíte Completa de Testes Automatizados Mobile-First com Selenium WebDriver
Desenrola Aluno — Releases 01, 02, 03 e 04 (33 Casos de Teste Integrados)

Release 01 (CT36, CT01 a CT08):
- CT36: Autenticação, RBAC, Grade Horária UNIFEI e Faltas
- CT01: Cadastro de Usuário e Unicidade de CPF/Matrícula
- CT02: Busca e Filtros de Usuários
- CT03: Edição de Perfil e Bloqueio de CPF/Matrícula
- CT04: Exclusão de Conta e Proteção do Último Administrador
- CT05: Cadastro de Curso e Código Único
- CT06: Busca de Cursos por Instituto e Turno
- CT07: Edição de Curso e Bloqueio de Sigla
- CT08: Proteção de Exclusão de Curso com Alunos Vinculados

Release 02 (CT10 a CT17):
- CT10: Cadastro de Disciplina com CH, Tipo e Pré-requisitos (RFS09)
- CT11: Bloqueio de Pré-requisito Circular (RFS11)
- CT12: Filtro de Disciplinas por Período e Tipo (RFS10)
- CT13: Alteração de Disciplina com Código Bloqueado (RFS11)
- CT14: Impedir Exclusão de Disciplina Pré-requisito (RFS12)
- CT15: Cadastro de Currículo com Parâmetros de Carga Horária (RFS13/14)
- CT16: Consulta da Grade Curricular do Currículo por Período (RFS14/15)
- CT17: Visão do Aluno: Grade por Período, Tags Informativas e CH (RFS17/18)

Release 03 (CT18 a CT25):
- CT18: Registrar Falta no Histórico de Frequência (data, horas e justificativa)
- CT19: Validação do Registro de Falta (data futura e horas fora do limite)
- CT20: Alterar Registro de Falta e Recalcular o Total de Faltas
- CT21: Excluir Registro de Falta e Recalcular o Total de Faltas
- CT22: Cadastrar Avaliação no Calendário (Próximas Avaliações)
- CT23: Validação de Avaliação (título, nota e duplicidade)
- CT24: Consultar Avaliações com Filtros de Disciplina e Tipo
- CT25: Alterar (lançar nota) e Excluir Avaliação

Release 04 (CT26 a CT33):
- CT26: Lançar Disciplina Concluída no Histórico / Grade do Aluno e Recalcular CH (RFS17)
- CT27: Validação do Registro de Histórico (Nota Final < 6.0 e Semestre Inválido) (RN03)
- CT28: Consultar Grade / Histórico do Aluno com Filtros de Período e Natureza (RFS18)
- CT29: Editar Registro do Histórico (Código bloqueado) e Remover voltando para Pendente (RFS19/RFS20)
- CT30: Matricular Nova Turma no Semestre com Código da Turma, Sala e Horários (RFS21)
- CT31: Validação de Choque de Horário na Matrícula do Semestre (RN01)
- CT32: Consultar Turmas do Semestre com Filtros de Dia da Semana e Busca Textual (RFS22)
- CT33: Alterar Dados da Turma (validação de choque de horário) e Remover Matrícula do Semestre (RFS23/RFS24)
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
PAUSA_ENTRE_ACOES = 1.5


@pytest.fixture(scope="module")
def driver():
    requests.post(f"{BASE_URL}/api/test/reset")

    options = webdriver.ChromeOptions()
    # Comente a linha '--headless=new' se quiser assistir ao navegador na tela
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
    time.sleep(0.4)


def aguardar_alerta(driver, timeout=5):
    alerta = WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located((By.ID, "feedback-alert"))
    )
    time.sleep(PAUSA_ENTRE_ACOES)
    return alerta


# ============================================================================
# BLOCO 1: TESTES DA RELEASE 01 (AUTENTICAÇÃO, USUÁRIOS E CURSOS)
# ============================================================================

def test_CT36_autenticacao_e_rbac(driver):
    fazer_login(driver, "admin@unifei.edu.br", "SenhaErrada999")
    alerta = aguardar_alerta(driver)
    assert "inválidos" in alerta.text.lower()

    fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")
    tela_aluno = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-aluno-home"))
    )
    assert "SDES06" in tela_aluno.text
    assert "07:00 - 07:55" in tela_aluno.text
    assert "13:30 - 14:25" in tela_aluno.text

    card_sdes06 = driver.find_element(By.CSS_SELECTOR, "[data-disciplina-codigo='SDES06']")
    clicar(driver, card_sdes06)

    tela_detalhe = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-disciplina-detalhe"))
    )
    assert "Gerência de Projetos de Software" in tela_detalhe.text
    badge_antes = driver.find_element(By.ID, "detalhe-faltas-badge").text
    assert "2h" in badge_antes

    clicar(driver, driver.find_element(By.ID, "btn-adicionar-falta"))
    time.sleep(PAUSA_ENTRE_ACOES)
    WebDriverWait(driver, 5).until(
        lambda d: "3h" in d.find_element(By.ID, "detalhe-faltas-badge").text
    )
    badge_depois = driver.find_element(By.ID, "detalhe-faltas-badge").text
    assert "3h" in badge_depois

    driver.execute_script("voltarParaHomeAluno();")
    WebDriverWait(driver, 5).until(EC.visibility_of_element_located((By.ID, "view-aluno-home")))

    fazer_login(driver, "admin@unifei.edu.br", "Admin123")
    info_user = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "logged-user-info"))
    )
    assert "Administrador" in info_user.text
    assert driver.find_element(By.ID, "btn-novo-usuario").is_displayed()


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

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower()

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

    alerta_erro = aguardar_alerta(driver)
    assert "cpf" in alerta_erro.text.lower()
    clicar(driver, driver.find_element(By.ID, "btn-cancelar-usuario"))


def test_CT02_consultar_usuarios_com_filtros(driver):
    campo_filtro = driver.find_element(By.ID, "filtro-usuario-nome")
    campo_filtro.clear()
    campo_filtro.send_keys("Gabriel Barbosa")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-usuarios"))
    time.sleep(PAUSA_ENTRE_ACOES)

    lista_texto = driver.find_element(By.ID, "tbody-usuarios").text
    assert "Gabriel Barbosa Teste" in lista_texto
    assert "Lucas Margelo Discente" not in lista_texto

    campo_filtro.clear()
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-usuarios"))
    time.sleep(PAUSA_ENTRE_ACOES)


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

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower()
    assert "Gabriel Barbosa Alterado" in driver.find_element(By.ID, "tbody-usuarios").text


def test_CT04_remover_usuario_e_proteger_ultimo_admin(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-usuarios [data-usuario-id]")
    for card in cards:
        if "Rodrigo William Admin" in card.text:
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-remover-usuario"))
            driver.switch_to.alert.accept()
            break

    alerta = aguardar_alerta(driver)
    assert "único administrador" in alerta.text.lower()

    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-usuarios [data-usuario-id]")
    for card in cards:
        if "Gabriel Barbosa Alterado" in card.text:
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-remover-usuario"))
            driver.switch_to.alert.accept()
            break

    time.sleep(PAUSA_ENTRE_ACOES)
    assert "Gabriel Barbosa Alterado" not in driver.find_element(By.ID, "tbody-usuarios").text


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
    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower()

    clicar(driver, driver.find_element(By.ID, "btn-novo-curso"))
    driver.find_element(By.ID, "curso-codigo").send_keys("SIN")
    driver.find_element(By.ID, "curso-nome").send_keys("Outro Curso Qualquer")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-curso"))

    alerta_dup = aguardar_alerta(driver)
    assert "código" in alerta_dup.text.lower()
    clicar(driver, driver.find_element(By.ID, "btn-cancelar-curso"))


def test_CT06_consultar_cursos_por_instituto_e_turno(driver):
    Select(driver.find_element(By.ID, "filtro-curso-instituto")).select_by_value("IEM")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-cursos"))
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_cursos = driver.find_element(By.ID, "tbody-cursos").text
    assert "Engenharia de Materiais" in texto_cursos
    assert "Sistemas de Informação" not in texto_cursos

    Select(driver.find_element(By.ID, "filtro-curso-instituto")).select_by_value("TODOS")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-cursos"))
    time.sleep(PAUSA_ENTRE_ACOES)


def test_CT07_alterar_curso_e_bloqueio_codigo(driver):
    card_ema = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "[data-curso-codigo='EMA']"))
    )
    clicar(driver, card_ema.find_element(By.CSS_SELECTOR, ".btn-editar-curso"))
    assert not driver.find_element(By.ID, "curso-codigo").is_enabled()

    campo_nome = driver.find_element(By.ID, "curso-nome")
    campo_nome.clear()
    campo_nome.send_keys("Engenharia de Materiais Aplicada")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-curso"))

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower()
    assert "Engenharia de Materiais Aplicada" in driver.find_element(By.ID, "tbody-cursos").text


def test_CT08_impedir_exclusao_curso_com_dependentes_e_remover_livre(driver):
    card_sin = driver.find_element(By.CSS_SELECTOR, "[data-curso-codigo='SIN']")
    clicar(driver, card_sin.find_element(By.CSS_SELECTOR, ".btn-remover-curso"))
    driver.switch_to.alert.accept()

    alerta = aguardar_alerta(driver)
    assert "não é possível excluir" in alerta.text.lower()

    card_ema = driver.find_element(By.CSS_SELECTOR, "[data-curso-codigo='EMA']")
    clicar(driver, card_ema.find_element(By.CSS_SELECTOR, ".btn-remover-curso"))
    driver.switch_to.alert.accept()
    time.sleep(PAUSA_ENTRE_ACOES)

    assert "Engenharia de Materiais Aplicada" not in driver.find_element(By.ID, "tbody-cursos").text


# ============================================================================
# BLOCO 2: TESTES DA RELEASE 02 (PRÉ-REQUISITOS, CURRÍCULOS E CARGA HORÁRIA)
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


def test_CT11_bloqueio_prerequisito_circular(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-disciplinas [data-catalogo-codigo]")
    for card in cards:
        if card.get_attribute("data-catalogo-codigo") == "COM110":
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-editar-disciplina"))
            break

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


def test_CT12_consultar_disciplinas_filtros(driver):
    Select(driver.find_element(By.ID, "filtro-disc-tipo")).select_by_value("Optativa")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-disciplinas"))
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_disc = driver.find_element(By.ID, "tbody-disciplinas").text
    assert "Optativa" in texto_disc
    assert "COM110" not in texto_disc

    Select(driver.find_element(By.ID, "filtro-disc-tipo")).select_by_value("TODOS")
    clicar(driver, driver.find_element(By.ID, "btn-filtrar-disciplinas"))
    time.sleep(PAUSA_ENTRE_ACOES)


def test_CT13_alterar_disciplina_bloqueio_codigo(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-disciplinas [data-catalogo-codigo]")
    for card in cards:
        if card.get_attribute("data-catalogo-codigo") == "SIN510":
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-editar-disciplina"))
            break

    assert not driver.find_element(By.ID, "disc-codigo").is_enabled()

    campo_nome = driver.find_element(By.ID, "disc-nome")
    campo_nome.clear()
    campo_nome.send_keys("Governança e Estratégia de TI")
    clicar(driver, driver.find_element(By.ID, "btn-salvar-disciplina"))

    alerta = aguardar_alerta(driver)
    assert "sucesso" in alerta.text.lower() or "atualizada" in alerta.text.lower()
    assert "Governança e Estratégia de TI" in driver.find_element(By.ID, "tbody-disciplinas").text


def test_CT14_impedir_exclusao_disciplina_prerequisito(driver):
    cards = driver.find_elements(By.CSS_SELECTOR, "#tbody-disciplinas [data-catalogo-codigo]")
    for card in cards:
        if card.get_attribute("data-catalogo-codigo") == "SDES06":
            clicar(driver, card.find_element(By.CSS_SELECTOR, ".btn-remover-disciplina"))
            driver.switch_to.alert.accept()
            break

    alerta = aguardar_alerta(driver)
    assert "não é possível remover" in alerta.text.lower() or "pré-requisito" in alerta.text.lower()


def test_CT15_crud_curriculo_parametros(driver):
    clicar(driver, driver.find_element(By.ID, "tab-curriculo"))

    texto_curr = driver.find_element(By.ID, "tbody-curriculos").text
    assert "SIN-2023" in texto_curr

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


def test_CT17_visao_aluno_grade_prerequisitos_ch(driver):
    fazer_login(driver, "aluno@unifei.edu.br", "Aluno123")
    clicar(driver, driver.find_element(By.ID, "tab-aluno-grade"))

    tela_progresso = WebDriverWait(driver, 5).until(
        EC.visibility_of_element_located((By.ID, "view-aluno-progresso"))
    )

    assert "Carga horária" in tela_progresso.text
    assert "Obrigatórias" in tela_progresso.text
    assert "Optativas" in tela_progresso.text
    assert "período" in driver.find_element(By.ID, "lista-progresso-faltam").text.lower()

    card_sin510 = driver.find_element(By.CSS_SELECTOR, "#lista-progresso-faltam [data-progresso-codigo='SIN510']")
    assert "Pré-req:" in card_sin510.text
    assert "SDES06" in card_sin510.text
    assert "Optativa" in card_sin510.text

    clicar(driver, card_sin510.find_element(By.CSS_SELECTOR, ".btn-puxar-semestre"))
    time.sleep(PAUSA_ENTRE_ACOES)
    assert "SIN510" in driver.find_element(By.ID, "lista-progresso-fazendo").text


# ============================================================================
# BLOCO 3: TESTES DA RELEASE 03 (HISTÓRICO DE FREQUÊNCIA E AVALIAÇÕES)
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
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


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
    driver.execute_script("arguments[0].click();", card)
    time.sleep(PAUSA_ENTRE_ACOES)
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
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


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


# ============================================================================
# BLOCO 4: TESTES DA RELEASE 04 (HISTÓRICO/GRADE DO ALUNO E TURMAS DO SEMESTRE)
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


def test_CT27_validar_registro_historico_grade(driver):
    abrir_tela_minha_grade(driver)
    driver.execute_script("prepararNovoHistoricoGrade();")
    time.sleep(PAUSA_ENTRE_ACOES)

    selecionar_por_texto_parcial(driver, "hist-grade-disciplina", "COM240")
    selecionar_por_texto_parcial(driver, "hist-grade-situacao", "Finalizada")

    definir_valor(driver, "hist-grade-semestre", "2025-3")
    definir_valor(driver, "hist-grade-nota", "7.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "aaaa.1" in alerta.text.lower() or "formato" in alerta.text.lower()

    definir_valor(driver, "hist-grade-semestre", "2025.2")
    definir_valor(driver, "hist-grade-nota", "4.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "6.0 e 10.0" in alerta.text.lower()

    driver.execute_script("fecharFormHistoricoGrade();")
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


def test_CT28_consultar_grade_aluno_com_filtros(driver):
    abrir_tela_minha_grade(driver)

    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-periodo", "4")
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-tipo", "Obrigatória")
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_finalizadas = driver.find_element(By.ID, "lista-progresso-finalizadas").text
    assert "COM220" in texto_finalizadas
    assert "COM110" not in texto_finalizadas

    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-periodo", "TODOS")
    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-tipo", "Optativa")
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_faltam = driver.find_element(By.ID, "lista-progresso-faltam").text
    assert "SIN430" in texto_faltam
    assert "COM240" not in texto_faltam

    selecionar_por_texto_parcial(driver, "filtro-grade-aluno-tipo", "TODOS")
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


def test_CT29_editar_e_remover_registro_historico(driver):
    abrir_tela_minha_grade(driver)
    ch_antes = ch_obrigatoria_cumprida(driver)

    card = driver.find_element(
        By.CSS_SELECTOR, "#lista-progresso-finalizadas [data-progresso-codigo='COM220']"
    )
    hist_id = card.get_attribute("data-historico-id")
    driver.execute_script(f"prepararEdicaoHistoricoGrade({hist_id});")
    time.sleep(PAUSA_ENTRE_ACOES)

    assert not driver.find_element(By.ID, "hist-grade-disciplina").is_enabled()

    definir_valor(driver, "hist-grade-semestre", "2026.1")
    definir_valor(driver, "hist-grade-nota", "9.5")
    driver.execute_script("salvarHistoricoGrade(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "atualizado" in alerta.text.lower() or "sucesso" in alerta.text.lower()
    texto_finalizadas = driver.find_element(By.ID, "lista-progresso-finalizadas").text
    assert "9.5" in texto_finalizadas
    assert "2026.1" in texto_finalizadas

    driver.execute_script(f"window.confirm = () => true; removerHistoricoGrade({hist_id});")
    alerta = aguardar_alerta(driver)
    assert "removido" in alerta.text.lower()
    assert ch_obrigatoria_cumprida(driver) == ch_antes - 64
    assert "COM220" in driver.find_element(By.ID, "lista-progresso-faltam").text


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


def test_CT31_validar_choque_de_horario_matricula(driver):
    abrir_tela_meu_semestre(driver)

    box = driver.find_element(By.ID, "box-add-disciplina-semestre")
    if not box.is_displayed():
        clicar(driver, driver.find_element(By.ID, "btn-abrir-add-semestre"))

    selecionar_por_texto_parcial(driver, "select-disc-disponivel", "COM220")
    definir_valor(driver, "turma-add-codigo", "T01")
    definir_valor(driver, "turma-add-horarios", "SEG-M1,SEG-M2")
    driver.execute_script("adicionarDisciplinaNoSemestrePeloSelect(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "choque de horário" in alerta.text.lower()
    assert "sdes06" in alerta.text.lower()

    driver.execute_script("alternarBoxAdicionarDisciplinaAluno();")
    time.sleep(PAUSA_ENTRE_ACOES * 0.6)


def test_CT32_consultar_turmas_semestre_com_filtros(driver):
    abrir_tela_meu_semestre(driver)

    definir_valor(driver, "filtro-turma-busca", "IEPG22")
    selecionar_por_texto_parcial(driver, "filtro-turma-dia", "QUA")
    driver.execute_script("filtrarTurmasSemestreAluno();")
    time.sleep(PAUSA_ENTRE_ACOES)

    texto_lista = driver.find_element(By.ID, "lista-disciplinas-aluno").text
    assert "IEPG22" in texto_lista
    assert "SDES06" not in texto_lista

    definir_valor(driver, "filtro-turma-busca", "")
    selecionar_por_texto_parcial(driver, "filtro-turma-dia", "TODOS")
    driver.execute_script("filtrarTurmasSemestreAluno();")
    time.sleep(PAUSA_ENTRE_ACOES)
    assert "SDES06" in driver.find_element(By.ID, "lista-disciplinas-aluno").text


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

    assert not driver.find_element(By.ID, "edit-turma-disciplina").is_enabled()

    definir_valor(driver, "edit-turma-horarios", "SEG-M1,SEG-M2")
    driver.execute_script("salvarEdicaoTurmaAtual(new Event('submit'));")
    alerta = aguardar_alerta(driver)
    assert "choque de horário" in alerta.text.lower()

    definir_valor(driver, "edit-turma-codigo", "T03")
    definir_valor(driver, "edit-turma-sala", "Auditório IEPG")
    definir_valor(driver, "edit-turma-horarios", "SEX-T1,SEX-T2")
    driver.execute_script("salvarEdicaoTurmaAtual(new Event('submit'));")

    alerta = aguardar_alerta(driver)
    assert "atualizada" in alerta.text.lower() or "sucesso" in alerta.text.lower()
    assert "Turma T03" in driver.find_element(By.ID, "detalhe-turma-codigo").text
    assert "Auditório IEPG" in driver.find_element(By.ID, "detalhe-sala").text

    driver.execute_script("retirarDisciplinaDoSemestreAtual();")
    alerta = aguardar_alerta(driver)
    assert "retirada do semestre" in alerta.text.lower()
    assert "IEPG22" not in driver.find_element(By.ID, "lista-disciplinas-aluno").text


