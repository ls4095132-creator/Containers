/* ==========================================================
   NAVEGAÇÃO + PERMISSÕES CENTRALIZADAS — CONTAINERS SEPARADOS
   ==========================================================
   Fonte oficial do perfil:
     Firebase Authentication -> UID
     Realtime Database -> /perfisUsuarios/<UID>

   Regras:
     ADMIN   -> containers, relatorios, kardex, produtos, usuarios
     USUARIO -> containers, kardex
     EXTERNO -> containers (somente leitura na área externa)

   Importante:
   - usuarioLogadoAtual é declarado como "let" em sistema.js e,
     por isso, NÃO é propriedade de window. O código usa a variável
     global diretamente quando ela existir.
   - O acesso é decidido somente depois de o Firebase restaurar a
     sessão e o perfil.
   ========================================================== */
(function () {
  "use strict";

  const pagina = String(document.body?.dataset?.pagina || "").trim().toLowerCase();
  const raiz = pagina === "menu" ? "./" : "../";

  const ROTAS = {
    containers: raiz + "containers/index.html",
    relatorios: raiz + "relatorios/index.html",
    kardex: raiz + "kardex/index.html",
    produtos: raiz + "produtos/index.html",
    usuarios: raiz + "usuarios/index.html"
  };

  const TIPOS = {
    ADMIN: "admin",
    USUARIO: "usuario",
    EXTERNO: "externo"
  };

  let perfilMenu = null;
  let authResolvida = false;
  let sincronizacaoEmAndamento = false;

  function obterUsuarioCore() {
    try {
      if (typeof usuarioLogadoAtual !== "undefined" && usuarioLogadoAtual) {
        return usuarioLogadoAtual;
      }
    } catch (e) {}
    return null;
  }

  function normalizarTipo(tipo) {
    const t = String(tipo || "").trim().toLowerCase();

    if (t === "admin" || t === "administrador") return TIPOS.ADMIN;

    if (
      t === "externo" ||
      t === "usuario externo" ||
      t === "usuário externo"
    ) {
      return TIPOS.EXTERNO;
    }

    if (
      t === "usuario" ||
      t === "usuário" ||
      t === "comum" ||
      t === "usuario comum" ||
      t === "usuário comum"
    ) {
      return TIPOS.USUARIO;
    }

    return "";
  }

  function obterTipoAtual() {
    const u = obterUsuarioCore();
    if (u) {
      const tipoCore = normalizarTipo(u.tipo);
      if (tipoCore) return tipoCore;

      const emailCore = String(u.email || u.usuario || "").trim().toLowerCase();
      if (
        emailCore === "leandro@gmail.com" ||
        emailCore === "admin@controlecontainers.com"
      ) {
        return TIPOS.ADMIN;
      }
    }

    if (perfilMenu) {
      const tipoPerfil = normalizarTipo(perfilMenu.tipo);
      if (tipoPerfil) return tipoPerfil;

      const emailPerfil = String(
        perfilMenu.email || perfilMenu.usuario || ""
      ).trim().toLowerCase();

      if (
        emailPerfil === "leandro@gmail.com" ||
        emailPerfil === "admin@controlecontainers.com"
      ) {
        return TIPOS.ADMIN;
      }
    }

    return "";
  }

  function obterNomeAtual() {
    const u = obterUsuarioCore();
    if (u) return u.nome || u.usuario || u.email || "Usuário";

    if (perfilMenu) {
      return perfilMenu.nome || perfilMenu.usuario || perfilMenu.email || "Usuário";
    }

    return "Usuário";
  }

  function podeAcessarTela(tipo, tela) {
    const t = normalizarTipo(tipo);
    const telaNormalizada = String(tela || "").trim().toLowerCase();

    if (t === TIPOS.ADMIN) return true;

    if (t === TIPOS.USUARIO) {
      return telaNormalizada === "containers" || telaNormalizada === "kardex";
    }

    if (t === TIPOS.EXTERNO) {
      return telaNormalizada === "containers";
    }

    return false;
  }

  // Função única usada por todo o menu.
  window.usuarioPodeAcessarTelaMenu = function (nomeTela) {
    return podeAcessarTela(obterTipoAtual(), nomeTela);
  };

  function atualizarIdentificacaoMenu() {
    const tipo = obterTipoAtual();
    const texto = document.getElementById("texto-usuario-menu");

    document.body.classList.toggle("usuario-admin", tipo === TIPOS.ADMIN);
    document.body.classList.toggle("usuario-comum", tipo === TIPOS.USUARIO);
    document.body.classList.toggle("usuario-externo", tipo === TIPOS.EXTERNO);

    if (texto) {
      const prefixo =
        tipo === TIPOS.ADMIN
          ? "👑 "
          : tipo === TIPOS.EXTERNO
          ? "🌐 "
          : "👤 ";

      texto.textContent =
        prefixo +
        obterNomeAtual() +
        (tipo === TIPOS.ADMIN ? " (admin)" : "");
    }
  }

  function aplicarMenu() {
    const menu = document.getElementById("tela-menu");
    if (!menu || menu.style.display === "none") return;

    atualizarIdentificacaoMenu();

    const tipo = obterTipoAtual();

    document
      .querySelectorAll("#lista-menu-principal .item-menu-principal[data-tela]")
      .forEach(function (btn) {
        const tela = btn.getAttribute("data-tela");

        if (tela === "sair") return;

        const permitido = podeAcessarTela(tipo, tela);

        btn.classList.toggle("item-menu-bloqueado", !permitido);
        btn.setAttribute("aria-disabled", permitido ? "false" : "true");

        const seta = btn.querySelector(".item-menu-seta");
        if (seta) seta.textContent = permitido ? "›" : "🔒";
      });
  }

  function mostrarMenu() {
    const menu = document.getElementById("tela-menu");
    const login = document.getElementById("tela-login");

    if (login) {
      login.style.display = "none";
      login.classList.add("login-oculta");
    }

    if (menu) menu.style.display = "block";

    aplicarMenu();
  }

  window.mostrarMenuPrincipal = mostrarMenu;

  window.abrirTelaDoMenu = function (nomeTela) {
    const tela = String(nomeTela || "").trim().toLowerCase();

    if (!podeAcessarTela(obterTipoAtual(), tela)) {
      alert("🔒 Você não tem permissão para acessar esta tela.");
      aplicarMenu();
      return;
    }

    if (ROTAS[tela]) {
      window.location.href = ROTAS[tela];
    }
  };

  window.voltarAoMenuPrincipal = function () {
    window.location.href = raiz + "index.html";
  };

  window.abrirConfiguracaoUsuariosSeparada = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) {
      alert("🔒 Apenas o administrador pode acessar o gerenciamento de usuários.");
      return;
    }

    window.location.href = raiz + "config/configuracao.html?aba=acesso";
  };

  /*
   * Proteção de URL direta.
   * Não basta esconder o botão: se alguém digitar /produtos/index.html,
   * a página também precisa verificar o perfil.
   */
  async function protegerPagina() {
    if (!pagina || pagina === "menu") return;

    const tipo = await sincronizarPerfilAtual();

    if (!tipo) {
      // Sem sessão: o sistema.js continuará responsável pela tela de login.
      return;
    }

    if (!podeAcessarTela(tipo, pagina)) {
      alert("🔒 Você não tem permissão para acessar esta tela.");
      window.location.replace(raiz + "index.html");
      return;
    }

    document.body.classList.toggle(
      "modo-externo-leitura",
      pagina === "containers" && tipo === TIPOS.EXTERNO
    );

    if (
      pagina === "kardex" &&
      typeof window.renderizarKardex === "function"
    ) {
      window.renderizarKardex();
    }

    if (
      pagina === "produtos" &&
      typeof window.renderizarProdutosCadastro === "function"
    ) {
      window.renderizarProdutosCadastro();
    }
  }

  async function sincronizarPerfilAtual() {
    if (sincronizacaoEmAndamento) return obterTipoAtual();

    sincronizacaoEmAndamento = true;

    try {
      // Primeiro usa o perfil já validado pelo sistema principal.
      const tipoCore = obterTipoAtual();
      if (tipoCore) {
        authResolvida = true;
        return tipoCore;
      }

      if (
        typeof firebase === "undefined" ||
        !firebase.apps ||
        !firebase.apps.length ||
        !firebase.auth
      ) {
        return "";
      }

      const auth = firebase.auth();
      const user = auth.currentUser;

      if (!user) return "";

      const snap = await firebase
        .database()
        .ref("perfisUsuarios/" + user.uid)
        .once("value");

      const p = snap.exists() ? snap.val() || {} : {};

      const tipo = normalizarTipo(p.tipo);

      if (!tipo) return "";

      perfilMenu = {
        uid: user.uid,
        email: p.email || user.email || "",
        usuario: p.usuario || p.email || user.email || "",
        nome: p.nome || p.nomeCompleto || p.usuario || user.email || "Usuário",
        tipo: tipo,
        filial: String(p.filial || "").trim().toUpperCase(),
        ativo: p.ativo !== false
      };

      authResolvida = true;
      return tipo;
    } catch (erro) {
      console.warn("Erro ao sincronizar perfil/permissões:", erro);
      return "";
    } finally {
      sincronizacaoEmAndamento = false;
    }
  }

  async function aguardarPermissaoAtual() {
    for (let tentativa = 0; tentativa < 50; tentativa++) {
      const tipo = await sincronizarPerfilAtual();

      if (tipo) return tipo;

      await new Promise(function (resolve) {
        setTimeout(resolve, 200);
      });
    }

    return "";
  }

  /*
   * Ao entrar no sistema, o core já definiu usuarioLogadoAtual.
   * Aqui apenas reaplicamos as permissões depois que o perfil existe.
   */
  if (typeof window.entrarNoApp === "function") {
    const entrarOriginal = window.entrarNoApp;

    window.entrarNoApp = async function (usuario) {
      await entrarOriginal(usuario);

      await aguardarPermissaoAtual();

      if (pagina === "menu") {
        mostrarMenu();
      } else {
        await protegerPagina();
      }
    };
  }

  /*
   * Firebase é a fonte de sincronização.
   * Como usuarioLogadoAtual é "let" e não window.*, nunca dependemos
   * de window.usuarioLogadoAtual para decidir as permissões.
   */
  if (typeof firebase !== "undefined" && firebase.auth) {
    try {
      firebase.auth().onAuthStateChanged(async function (user) {
        if (!user) {
          perfilMenu = null;
          authResolvida = true;
          return;
        }

        await aguardarPermissaoAtual();

        if (pagina === "menu") {
          aplicarMenu();
        } else {
          await protegerPagina();
        }
      });
    } catch (e) {
      console.warn("Não foi possível registrar observador de autenticação:", e);
    }
  }

  /*
   * Pequenas reaplicações apenas durante a inicialização.
   * Depois que o perfil estiver disponível, não fica alterando a tela
   * indefinidamente.
   */
  let tentativasInicializacao = 0;
  const timer = setInterval(async function () {
    tentativasInicializacao++;

    const tipo = obterTipoAtual();

    if (tipo) {
      clearInterval(timer);

      if (pagina === "menu") {
        aplicarMenu();
      } else {
        await protegerPagina();
      }

      return;
    }

    if (tentativasInicializacao >= 50) {
      clearInterval(timer);
    }
  }, 200);

  // Bloqueio de clique como segunda camada visual.
  document.addEventListener(
    "click",
    function (evento) {
      const btn =
        evento.target &&
        evento.target.closest &&
        evento.target.closest(
          "#lista-menu-principal .item-menu-principal[data-tela]"
        );

      if (!btn) return;

      const tela = btn.getAttribute("data-tela");

      if (tela === "sair") return;

      if (!window.usuarioPodeAcessarTelaMenu(tela)) {
        evento.preventDefault();
        evento.stopImmediatePropagation();
        alert("🔒 Você não tem permissão para acessar esta tela.");
      }
    },
    true
  );

  // Relatórios: somente administrador.
  window.abrirRelatorioMovimentacoes = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) {
      alert("🔒 Apenas o administrador pode acessar este relatório.");
      return;
    }
    window.location.href = raiz + "containers/index.html#historico";
  };

  window.abrirRelatorioRegistros = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) {
      alert("🔒 Apenas o administrador pode acessar este relatório.");
      return;
    }
    window.location.href = raiz + "containers/index.html#registro-mercadoria";
  };

  window.abrirRelatorioSolicitacoes = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) {
      alert("🔒 Apenas o administrador pode acessar este relatório.");
      return;
    }
    window.location.href = raiz + "containers/index.html#solicitacoes";
  };

  // Saída: mantém a função Firebase existente.
  if (typeof window.sairDoSistema === "function") {
    const sairOriginal = window.sairDoSistema;

    window.sairDoSistema = async function () {
      await sairOriginal();
      setTimeout(function () {
        window.location.href = raiz + "index.html";
      }, 120);
    };
  }

  window.atualizarSistemaSemDeslogar = function () {
    window.location.reload();
  };

  // Compatibilidade para outras partes do sistema.
  window.obterTipoUsuarioSeparado = obterTipoAtual;
  window.permissaoSeparadaResolvida = function () {
    return authResolvida;
  };
})();
