/* ==========================================================
   NAVEGAÇÃO ENTRE TELAS SEPARADAS
   Criado sem localStorage: usa Firebase Authentication/session.
   ========================================================== */
(function(){
  "use strict";
  const pagina=String(document.body.dataset.pagina||"").toLowerCase();
  const raiz=(pagina==="menu") ? "./" : "../";
  const rotas={containers:raiz+"containers/index.html",relatorios:raiz+"relatorios/index.html",kardex:raiz+"kardex/index.html",produtos:raiz+"produtos/index.html",usuarios:raiz+"usuarios/index.html"};

  function tipoUsuario(){ return String(window.usuarioLogadoAtual && window.usuarioLogadoAtual.tipo || "").toLowerCase(); }
  function pode(tela){
    const t=tipoUsuario();
    if(t==="admin") return true;
    if(t==="externo") return tela==="containers";
    if(t==="usuario" || t==="comum") return tela==="containers" || tela==="kardex";
    return false;
  }
  window.usuarioPodeAcessarTelaMenu=pode;

  function aplicarMenu(){
    const botoes=document.querySelectorAll("#lista-menu-principal .item-menu-principal[data-tela]");
    botoes.forEach(function(btn){
      const tela=btn.getAttribute("data-tela");
      if(tela==="sair") return;
      const ok=pode(tela);
      btn.classList.toggle("item-menu-bloqueado",!ok);
      btn.setAttribute("aria-disabled",ok?"false":"true");
      const seta=btn.querySelector(".item-menu-seta");
      if(seta)seta.textContent=ok?"›":"🔒";
      btn.onclick=function(){ abrirTelaDoMenu(tela); };
    });
    const texto=document.getElementById("texto-usuario-menu");
    if(texto && window.usuarioLogadoAtual){
      const u=window.usuarioLogadoAtual;
      texto.textContent=(u.tipo==="admin"?"👑 ":u.tipo==="externo"?"🌐 ":"👤 ")+(u.nome||u.usuario||u.email||"Usuário")+(u.tipo==="admin"?" (admin)":"");
    }
  }

  window.mostrarMenuPrincipal=function(){ window.location.href=raiz+"index.html"; };
  window.voltarAoMenuPrincipal=function(){ window.location.href=raiz+"index.html"; };
  window.abrirTelaDoMenu=function(nomeTela){
    if(!pode(nomeTela)){ alert("🔒 Você não tem permissão para acessar esta tela."); return; }
    if(rotas[nomeTela]) window.location.href=rotas[nomeTela];
  };

  window.abrirConfiguracaoUsuariosSeparada=function(){
    if(tipoUsuario()!=="admin"){ alert("🔒 Apenas o administrador pode acessar o gerenciamento de usuários."); return; }
    window.location.href=raiz+"config/configuracao.html?aba=acesso";
  };

  // Bloqueio de acesso direto à URL.
  function protegerPagina(){
    if(!pagina || pagina==="menu") return;
    const t=tipoUsuario();
    if(!t) return;
    if(!pode(pagina)){
      alert("🔒 Você não tem permissão para acessar esta tela.");
      window.location.href=raiz+"index.html";
      return;
    }
    document.body.classList.toggle("modo-externo-leitura",pagina==="containers" && t==="externo");
    if(pagina==="kardex" && typeof window.renderizarKardex==="function") window.renderizarKardex();
    if(pagina==="produtos" && typeof window.renderizarProdutosCadastro==="function") window.renderizarProdutosCadastro();
  }

  if(typeof window.esconderTodasAsTelasDoApp!=="function"){
    window.esconderTodasAsTelasDoApp=function(){
      ["tela-menu","app-principal","app-externo","tela-relatorios","tela-kardex","tela-produtos","tela-usuarios"].forEach(function(id){
        const el=document.getElementById(id); if(el)el.style.display="none";
      });
    };
  }

  // Encapsula o login preservado para direcionar para a página correspondente.
  if(typeof window.entrarNoApp==="function"){
    const originalEntrar=window.entrarNoApp;
    window.entrarNoApp=async function(usuario){
      await originalEntrar(usuario);
      setTimeout(function(){
        if(pagina==="menu"){
          aplicarMenu();
          const login=document.getElementById("tela-login"); if(login){login.style.display="none";login.classList.add("login-oculta");}
          const menu=document.getElementById("tela-menu"); if(menu)menu.style.display="block";
        }else{
          protegerPagina();
          const login=document.getElementById("tela-login"); if(login){login.style.display="none";login.classList.add("login-oculta");}
          const tela=document.getElementById("tela-"+pagina); if(tela)tela.style.display="block";
          if(pagina==="containers"){
            const ext=document.getElementById("app-externo"),app=document.getElementById("app-principal");
            if(tipoUsuario()==="externo"){if(ext)ext.style.display="block";if(app)app.style.display="none";}
            else{if(app){app.style.display="block";app.classList.add("app-visivel");}if(ext)ext.style.display="none";}
          }
        }
      },60);
    };
  }

  // Quando o core detectar a sessão já restaurada, aplicar a página atual.
  const timer=setInterval(function(){
    if(window.usuarioLogadoAtual){
      clearInterval(timer);
      if(pagina==="menu") aplicarMenu(); else protegerPagina();
    }
  },100);
  setTimeout(function(){clearInterval(timer);},20000);



  // Atalhos internos da tela de Relatórios: mantêm o comportamento anterior,
  // mas agora a navegação entre páginas é real.
  window.abrirRelatorioMovimentacoes=function(){
    if(tipoUsuario()!=="admin") return;
    window.location.href=raiz+"containers/index.html#historico";
  };
  window.abrirRelatorioRegistros=function(){
    if(tipoUsuario()!=="admin") return;
    window.location.href=raiz+"containers/index.html#registro-mercadoria";
  };
  window.abrirRelatorioSolicitacoes=function(){
    if(tipoUsuario()!=="admin") return;
    window.location.href=raiz+"containers/index.html#solicitacoes";
  };

  // Saída: mantém a função Firebase existente e retorna ao menu/login.
  if(typeof window.sairDoSistema==="function"){
    const originalSair=window.sairDoSistema;
    window.sairDoSistema=async function(){
      await originalSair();
      setTimeout(function(){ window.location.href=raiz+"index.html"; },120);
    };
  }

  // Atualização: o core preserva a sessão SESSION; a rota atual será mantida.
  window.atualizarSistemaSemDeslogar=function(){ window.location.reload(); };

  document.addEventListener("click",function(e){
    const btn=e.target.closest && e.target.closest(".item-menu-principal[data-tela]");
    if(!btn)return;
    const tela=btn.getAttribute("data-tela");
    if(tela!=="sair" && !pode(tela)){
      e.preventDefault(); e.stopPropagation();
      alert("🔒 Você não tem permissão para acessar esta tela.");
    }
  },true);
})();
