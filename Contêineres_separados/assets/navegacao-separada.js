/* ==========================================================
   NAVEGAÇÃO + PERMISSÕES CENTRALIZADAS — CONTAINERS SEPARADOS
   ==========================================================
   ADMIN   -> containers, relatorios, kardex, produtos, usuarios, configuracao
   USUARIO -> containers, kardex
   EXTERNO -> containers (somente leitura)
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
    usuarios: raiz + "usuarios/index.html",
    configuracao: raiz + "config/configuracao.html?aba=acesso"
  };

  const TIPOS = { ADMIN:"admin", USUARIO:"usuario", EXTERNO:"externo" };

  let perfilMenu = null;
  let authResolvida = false;
  let sincronizacaoEmAndamento = false;

  function obterUsuarioCore() {
    try {
      if (typeof usuarioLogadoAtual !== "undefined" && usuarioLogadoAtual) {
        return usuarioLogadoAtual;
      }
    } catch (e) {}
    try {
      if (window.usuarioLogadoAtual) return window.usuarioLogadoAtual;
    } catch (e) {}
    return null;
  }

  function normalizarTipo(tipo) {
    const t = String(tipo || "").trim().toLowerCase();
    if (t === "admin" || t === "administrador") return TIPOS.ADMIN;
    if (t === "externo" || t === "usuario externo" || t === "usuário externo") return TIPOS.EXTERNO;
    if (t === "usuario" || t === "usuário" || t === "comum" || t === "usuario comum" || t === "usuário comum") return TIPOS.USUARIO;
    return "";
  }

  function obterTipoAtual() {
    const u = obterUsuarioCore();
    if (u) {
      const tipo = normalizarTipo(u.tipo);
      if (tipo) return tipo;
      const email = String(u.email || u.usuario || "").trim().toLowerCase();
      if (email === "leandro@gmail.com" || email === "admin@controlecontainers.com") return TIPOS.ADMIN;
    }
    if (perfilMenu) {
      const tipo = normalizarTipo(perfilMenu.tipo);
      if (tipo) return tipo;
      const email = String(perfilMenu.email || perfilMenu.usuario || "").trim().toLowerCase();
      if (email === "leandro@gmail.com" || email === "admin@controlecontainers.com") return TIPOS.ADMIN;
    }
    return "";
  }

  function obterAcessosAtual() {
    const u = obterUsuarioCore();
    if (u && u.acessos) return u.acessos;
    if (perfilMenu && perfilMenu.acessos) return perfilMenu.acessos;
    return acessosPadraoPorTipo(obterTipoAtual());
  }

  function obterNomeAtual() {
    const u = obterUsuarioCore();
    if (u) return u.nome || u.usuario || u.email || "Usuário";
    if (perfilMenu) return perfilMenu.nome || perfilMenu.usuario || perfilMenu.email || "Usuário";
    return "Usuário";
  }

  function acessosPadraoPorTipo(tipo) {
    const t = normalizarTipo(tipo);
    if (t === TIPOS.ADMIN) return {containers:true, relatorios:true, kardex:true, produtos:true, usuarios:true, configuracao:true};
    if (t === TIPOS.USUARIO) return {containers:true, kardex:true, relatorios:false, produtos:false, usuarios:false, configuracao:false};
    if (t === TIPOS.EXTERNO) return {containers:true, relatorios:false, kardex:false, produtos:false, usuarios:false, configuracao:false};
    return {};
  }

  function podeAcessarTela(tipo, tela, acessos) {
    const t = normalizarTipo(tipo);
    const telaNormalizada = String(tela || "").trim().toLowerCase();
    if (!["containers","relatorios","kardex","produtos","usuarios","configuracao"].includes(telaNormalizada)) return false;
    if (t === TIPOS.ADMIN) return true;

    const padrao = acessosPadraoPorTipo(t);
    const origem = acessos && typeof acessos === "object" ? acessos : {};
    return origem[telaNormalizada] === undefined ? !!padrao[telaNormalizada] : origem[telaNormalizada] === true;
  }

  window.usuarioPodeAcessarTelaMenu = function(nomeTela) {
    return podeAcessarTela(obterTipoAtual(), nomeTela, obterAcessosAtual());
  };

  function atualizarIdentificacaoMenu() {
    const tipo = obterTipoAtual();
    const texto = document.getElementById("texto-usuario-menu");
    document.body.classList.toggle("usuario-admin", tipo === TIPOS.ADMIN);
    document.body.classList.toggle("usuario-comum", tipo === TIPOS.USUARIO);
    document.body.classList.toggle("usuario-externo", tipo === TIPOS.EXTERNO);
    if (texto) {
      const prefixo = tipo === TIPOS.ADMIN ? "👑 " : tipo === TIPOS.EXTERNO ? "🌐 " : "👤 ";
      texto.textContent = prefixo + obterNomeAtual() + (tipo === TIPOS.ADMIN ? " (admin)" : "");
    }
  }

  function aplicarMenu() {
    const menu = document.getElementById("tela-menu");
    if (!menu || menu.style.display === "none") return;
    atualizarIdentificacaoMenu();
    const tipo = obterTipoAtual();

    document.querySelectorAll("#lista-menu-principal .item-menu-principal[data-tela]").forEach(function(btn) {
      const tela = btn.getAttribute("data-tela");
      if (tela === "sair") return;
      const permitido = podeAcessarTela(tipo, tela, obterAcessosAtual());
      btn.classList.toggle("item-menu-bloqueado", !permitido);
      btn.setAttribute("aria-disabled", permitido ? "false" : "true");
      const seta = btn.querySelector(".item-menu-seta");
      if (seta) seta.textContent = permitido ? "›" : "🔒";
    });
  }

  function mostrarMenu() {
    const menu = document.getElementById("tela-menu");
    const login = document.getElementById("tela-login");
    if (login) { login.style.display = "none"; login.classList.add("login-oculta"); }
    if (menu) {
      menu.style.display = "block";
      menu.classList.add("pagina-autorizada-visivel");
    }
    aplicarMenu();
  }
  window.mostrarMenuPrincipal = mostrarMenu;

  function mostrarConteudoPagina() {
    if (!pagina || pagina === "menu") return;
    const id = "tela-" + pagina;
    const tela = document.getElementById(id);
    const login = document.getElementById("tela-login");
    const carregamento = document.getElementById("tela-carregamento-app");
    if (login) { login.style.display = "none"; login.classList.add("login-oculta"); }
    if (carregamento) carregamento.style.display = "none";
    if (tela) {
      tela.style.display = "block";
      tela.classList.add("pagina-autorizada-visivel");
    }
  }

  window.abrirTelaDoMenu = function(nomeTela) {
    const tela = String(nomeTela || "").trim().toLowerCase();
    if (!podeAcessarTela(obterTipoAtual(), tela, obterAcessosAtual())) {
      alert("🔒 Você não tem permissão para acessar esta tela.");
      aplicarMenu();
      return;
    }
    if (ROTAS[tela]) window.location.href = ROTAS[tela];
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

  async function sincronizarPerfilAtual() {
    if (sincronizacaoEmAndamento) return obterTipoAtual();
    sincronizacaoEmAndamento = true;
    try {
      const tipoCore = obterTipoAtual();
      if (tipoCore) { authResolvida = true; return tipoCore; }

      if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length || !firebase.auth) return "";
      const user = firebase.auth().currentUser;
      if (!user) return "";

      const snap = await firebase.database().ref("perfisUsuarios/" + user.uid).once("value");
      const p = snap.exists() ? snap.val() || {} : {};
      const tipo = normalizarTipo(p.tipo);
      if (!tipo) return "";

      perfilMenu = {
        uid:user.uid,
        email:p.email || user.email || "",
        usuario:p.usuario || p.email || user.email || "",
        nome:p.nome || p.nomeCompleto || p.usuario || user.email || "Usuário",
        tipo:tipo,
        filial:String(p.filial || "").trim().toUpperCase(),
        acessos:(p.acessos && typeof p.acessos==="object") ? p.acessos : acessosPadraoPorTipo(tipo),
        ativo:p.ativo !== false
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
      await new Promise(r => setTimeout(r, 200));
    }
    return "";
  }

  async function protegerPagina() {
    if (!pagina || pagina === "menu") return;
    const tipo = await aguardarPermissaoAtual();
    if (!tipo) return;

    if (!podeAcessarTela(tipo, pagina, obterAcessosAtual())) {
      alert("🔒 Você não tem permissão para acessar esta tela.");
      window.location.replace(raiz + "index.html");
      return;
    }

    mostrarConteudoPagina();

    document.body.classList.toggle("modo-externo-leitura", pagina === "containers" && tipo === TIPOS.EXTERNO);

    if (pagina === "kardex" && typeof window.renderizarKardex === "function") {
      window.renderizarKardex();
    }
    if (pagina === "produtos" && typeof window.renderizarProdutosCadastro === "function") {
      window.renderizarProdutosCadastro();
    }
  }

  // Firebase é a fonte de verdade das permissões.
  if (typeof firebase !== "undefined" && firebase.auth) {
    try {
      firebase.auth().onAuthStateChanged(async function(user) {
        if (!user) {
          perfilMenu = null;
          authResolvida = true;
          return;
        }

        const tipo = await aguardarPermissaoAtual();

        if (pagina === "menu") {
          mostrarMenu();
        } else if (tipo) {
          await protegerPagina();
        }
      });
    } catch (e) {
      console.warn("Não foi possível registrar observador de autenticação:", e);
    }
  }

  let tentativasInicializacao = 0;
  const timer = setInterval(async function() {
    tentativasInicializacao++;
    const tipo = obterTipoAtual();
    if (tipo) {
      clearInterval(timer);
      if (pagina === "menu") mostrarMenu();
      else await protegerPagina();
      return;
    }
    if (tentativasInicializacao >= 50) clearInterval(timer);
  }, 200);

  document.addEventListener("click", function(evento) {
    const btn = evento.target && evento.target.closest && evento.target.closest("#lista-menu-principal .item-menu-principal[data-tela]");
    if (!btn) return;
    const tela = btn.getAttribute("data-tela");
    if (tela === "sair") return;
    if (!window.usuarioPodeAcessarTelaMenu(tela)) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      alert("🔒 Você não tem permissão para acessar esta tela.");
    }
  }, true);

  window.abrirRelatorioMovimentacoes = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) { alert("🔒 Apenas o administrador pode acessar este relatório."); return; }
    window.location.href = raiz + "containers/index.html#historico";
  };
  window.abrirRelatorioRegistros = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) { alert("🔒 Apenas o administrador pode acessar este relatório."); return; }
    window.location.href = raiz + "containers/index.html#registro-mercadoria";
  };
  window.abrirRelatorioSolicitacoes = function () {
    if (obterTipoAtual() !== TIPOS.ADMIN) { alert("🔒 Apenas o administrador pode acessar este relatório."); return; }
    window.location.href = raiz + "containers/index.html#solicitacoes";
  };

  window.atualizarSistemaSemDeslogar = function () { window.location.reload(); };

  // Sai e volta para o menu/login.
  if (typeof window.sairDoSistema === "function") {
    const sairOriginal = window.sairDoSistema;
    window.sairDoSistema = async function () {
      await sairOriginal();
      setTimeout(function(){ window.location.href = raiz + "index.html"; }, 120);
    };
  }

  window.obterTipoUsuarioSeparado = obterTipoAtual;
  window.permissaoSeparadaResolvida = function(){ return authResolvida; };
})();
