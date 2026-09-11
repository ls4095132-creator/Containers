const firebaseConfig = {
    apiKey: "AIzaSyB7nueKFNhlXRNg5aOH-JknVcmF5Eihawc",
    authDomain: "controle-de-containers-150d0.firebaseapp.com",
    databaseURL: "https://controle-de-containers-150d0-default-rtdb.firebaseio.com",
    projectId: "controle-de-containers-150d0",
    storageBucket: "controle-de-containers-150d0.firebasestorage.app",
    messagingSenderId: "518139053",
    appId: "1:518139053:web:5807a54925ae7d014eea24",
    measurementId: "G-92M4YNWQ6B"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
const funcoes = firebase.functions();

const FILIAIS_EXTERNAS = ["LAGOA","MINISTRO","MATRIZ"];

function escaparHtmlConfig(valor){
    return String(valor == null ? "" : valor)
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");
}

function mensagem(texto, erro=false){
    const el = document.getElementById("mensagem");
    if(!el) return;
    el.textContent = texto;
    el.style.display = "block";
    el.className = "mensagem " + (erro ? "erro" : "sucesso");
}

function voltarSistema(){
    window.location.href = "../index.html";
}

async function iniciar(){
    try{
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

        auth.onAuthStateChanged(async function(user){
            if(!user){
                // Não está autenticado nesta aba/sessão.
                window.location.replace("../index.html");
                return;
            }

            try{
                const snap = await db.ref("perfisUsuarios/" + user.uid).once("value");
                const perfil = snap.exists() ? (snap.val() || {}) : {};

                if(perfil.tipo !== "admin"){
                    alert("❌ Apenas o administrador pode acessar as configurações.");
                    window.location.replace("../index.html");
                    return;
                }

                await carregarConfiguracoes();
                document.body.classList.remove("carregando");
            }catch(erro){
                console.error("Erro ao validar administrador:", erro);
                mensagem("❌ Erro ao verificar seu perfil no Firebase. Confira as regras do Realtime Database.", true);
                setTimeout(function(){
                    window.location.replace("../index.html");
                }, 2500);
            }
        });
    }catch(erro){
        console.error("Erro ao iniciar autenticação:", erro);
        mensagem("❌ Não foi possível iniciar a autenticação.", true);
        setTimeout(function(){
            window.location.replace("../index.html");
        }, 2500);
    }
}

async function carregarConfiguracoes(){
    const snap = await db.ref("configuracoes/sistema").once("value");
    const c = snap.exists() ? (snap.val() || {}) : {};

    document.getElementById("nomeSistema").value = c.nomeSistema || "Controle de Containers";
    document.getElementById("quantidadeContainers").value = c.quantidadeContainers || 60;
    document.getElementById("notificacoesGerais").checked = c.notificacoesGerais !== false;
    document.getElementById("avisosEntrada").checked = c.avisosEntrada !== false;
    document.getElementById("avisosRecusa").checked = c.avisosRecusa !== false;

    carregarUsuarios();
    aplicarTemaSalvo();
}

async function salvarConfiguracoes(){
    try{
        const dados = {
            nomeSistema: document.getElementById("nomeSistema").value.trim() || "Controle de Containers",
            quantidadeContainers: Number(document.getElementById("quantidadeContainers").value) || 60,
            notificacoesGerais: document.getElementById("notificacoesGerais").checked,
            avisosEntrada: document.getElementById("avisosEntrada").checked,
            avisosRecusa: document.getElementById("avisosRecusa").checked,
            atualizadoEm: firebase.database.ServerValue.TIMESTAMP
        };

        await db.ref("configuracoes/sistema").set(dados);
        mensagem("✅ Configurações salvas com sucesso.");
    }catch(erro){
        console.error("Erro ao salvar configurações:", erro);
        mensagem("❌ Erro ao salvar. Verifique as regras do Realtime Database.", true);
    }
}

// ======================================================
// ACESSO DIGITAL — USUÁRIOS CADASTRADOS
// ======================================================

function atualizarFilialNovoUsuario(){
    const tipo = document.getElementById("novoUsuarioTipo");
    const filial = document.getElementById("novoUsuarioFilial");
    if(!tipo || !filial) return;
    const externo = tipo.value === "externo";
    filial.innerHTML = externo
        ? '<option value="LAGOA">LAGOA</option><option value="MINISTRO">MINISTRO</option><option value="MATRIZ">MATRIZ</option>'
        : '<option value="ST. AFONSO">ST. AFONSO</option>';
    filial.value = externo ? "MATRIZ" : "ST. AFONSO";
}

function mostrarErroNovoUsuario(texto){
    const el = document.getElementById("erroNovoUsuario");
    if(!el) return;
    el.textContent = texto;
    el.style.display = "block";
}

function esconderErroNovoUsuario(){
    const el = document.getElementById("erroNovoUsuario");
    if(el) el.style.display = "none";
}

async function carregarUsuarios(){
    const area = document.getElementById("listaUsuarios");
    const contador = document.getElementById("contadorUsuarios");
    if(!area) return;

    try{
        const snap = await db.ref("perfisUsuarios").once("value");
        const perfis = snap.exists() ? (snap.val() || {}) : {};
        const usuarios = Object.keys(perfis).map(function(uid){
            const p = perfis[uid] || {};
            return {
                uid: uid,
                email: p.email || p.usuario || "",
                nome: p.nome || p.usuario || p.email || "",
                tipo: p.tipo === "admin" ? "admin" : (p.tipo === "externo" ? "externo" : "usuario"),
                filial: String(p.filial || "").trim().toUpperCase(),
                ativo: p.ativo !== false
            };
        }).sort(function(a,b){ return a.email.localeCompare(b.email,"pt-BR"); });

        if(contador) contador.innerText = "(" + usuarios.length + ")";

        if(!usuarios.length){
            area.innerHTML = '<div class="vazio-usuarios">Nenhum usuário cadastrado.</div>';
            return;
        }

        area.innerHTML = usuarios.map(function(u,i){
            const tipoTexto = u.tipo === "admin" ? "👑 Administrador" : (u.tipo === "externo" ? "🌐 Usuário externo" : "👤 Usuário comum");
            const status = u.ativo === false ? "🚫 Bloqueado" : "✅ Ativo";
            return '<div class="item-usuario">' +
                '<div class="info">' +
                '<strong>' + escaparHtmlConfig(u.email) + '</strong>' +
                '<span>' + tipoTexto + ' • ' + status + ' • 🏢 ' + (u.filial ? escaparHtmlConfig(u.filial) : "SEM FILIAL") + '</span>' +
                '</div>' +
                '<div class="acoes">' +
                '<button type="button" onclick="redefinirSenhaUsuario(' + i + ')">🔑 Redefinir senha</button>' +
                '<button type="button" class="btn-bloquear" onclick="alternarBloqueioUsuario(' + i + ')">' + (u.ativo === false ? "🔓 Ativar" : "🚫 Bloquear") + '</button>' +
                '<button type="button" class="btn-excluir" onclick="excluirUsuario(' + i + ')">🗑️ Excluir</button>' +
                '</div></div>';
        }).join("");

        window.__usuariosConfigCache = usuarios;
    }catch(erro){
        console.error("Erro ao carregar usuários:", erro);
        area.innerHTML = '<div class="vazio-usuarios">❌ Não foi possível carregar os usuários.</div>';
    }
}

async function cadastrarUsuario(){
    esconderErroNovoUsuario();

    const campoEmail = document.getElementById("novoUsuarioEmail");
    const campoSenha = document.getElementById("novoUsuarioSenha");
    const campoTipo = document.getElementById("novoUsuarioTipo");
    const campoFilial = document.getElementById("novoUsuarioFilial");

    const email = (campoEmail.value || "").trim().toLowerCase();
    const senha = campoSenha.value || "";
    const tipo = campoTipo.value;
    const filial = (campoFilial.value || "").trim().toUpperCase();

    if(!email || !email.includes("@")){ mostrarErroNovoUsuario("Informe um e-mail válido."); return; }
    if(senha.length < 6){ mostrarErroNovoUsuario("A senha deve ter pelo menos 6 caracteres."); return; }

    try{
        const criarUsuario = funcoes.httpsCallable("criarUsuario");
        await criarUsuario({ email: email, senha: senha, tipo: tipo, filial: filial });

        campoEmail.value = "";
        campoSenha.value = "";
        campoTipo.value = "usuario";
        atualizarFilialNovoUsuario();

        await carregarUsuarios();
        mensagem("✅ Usuário " + email + " cadastrado com sucesso.");
    }catch(erro){
        console.error("Erro ao cadastrar usuário:", erro);
        let msg = "Não foi possível cadastrar o usuário.";
        if(erro && erro.code === "functions/already-exists") msg = "Este e-mail já existe no Firebase Authentication.";
        else if(erro && erro.code === "functions/permission-denied") msg = "Apenas o administrador pode cadastrar usuários.";
        mostrarErroNovoUsuario(msg);
    }
}

async function redefinirSenhaUsuario(indice){
    const usuarios = window.__usuariosConfigCache || [];
    const alvo = usuarios[indice];
    if(!alvo) return;
    try{
        await auth.sendPasswordResetEmail(alvo.email);
        mensagem("✅ E-mail de redefinição enviado para " + alvo.email + ".");
    }catch(erro){
        console.error(erro);
        mensagem("❌ Não foi possível enviar a redefinição de senha.", true);
    }
}

async function alternarBloqueioUsuario(indice){
    const usuarios = window.__usuariosConfigCache || [];
    const alvo = usuarios[indice];
    if(!alvo) return;
    if(alvo.uid === auth.currentUser.uid){ mensagem("❌ Você não pode bloquear seu próprio usuário.", true); return; }
    const novoStatus = alvo.ativo === false;
    if(!confirm((novoStatus ? "Ativar" : "Bloquear") + " o usuário " + alvo.email + "?")) return;
    try{
        await db.ref("perfisUsuarios/" + alvo.uid + "/ativo").set(novoStatus);
        await carregarUsuarios();
    }catch(erro){
        console.error(erro);
        mensagem("❌ Não foi possível alterar o status do usuário.", true);
    }
}

async function excluirUsuario(indice){
    const usuarios = window.__usuariosConfigCache || [];
    const alvo = usuarios[indice];
    if(!alvo) return;
    if(alvo.uid === auth.currentUser.uid){ mensagem("❌ Você não pode excluir seu próprio usuário.", true); return; }
    if(!confirm("Excluir definitivamente o usuário " + alvo.email + "? Essa ação não pode ser desfeita.")) return;
    try{
        const excluir = funcoes.httpsCallable("excluirUsuario");
        await excluir({ uid: alvo.uid });
        await carregarUsuarios();
        mensagem("✅ Usuário excluído com sucesso.");
    }catch(erro){
        console.error(erro);
        mensagem("❌ Não foi possível excluir o usuário.", true);
    }
}

// ======================================================
// TEMA CLARO / ESCURO
// ======================================================

function definirTema(tema){
    document.body.classList.toggle("tema-claro", tema === "claro");
    try{ localStorage.setItem("temaSistema", tema); }catch(e){}
    atualizarBotoesTema();
}

function atualizarBotoesTema(){
    let atual = "escuro";
    try{ atual = localStorage.getItem("temaSistema") || "escuro"; }catch(e){}
    const escuro = document.getElementById("btnTemaEscuro");
    const claro = document.getElementById("btnTemaClaro");
    if(escuro) escuro.classList.toggle("ativo", atual === "escuro");
    if(claro) claro.classList.toggle("ativo", atual === "claro");
}

function aplicarTemaSalvo(){
    let atual = "escuro";
    try{ atual = localStorage.getItem("temaSistema") || "escuro"; }catch(e){}
    document.body.classList.toggle("tema-claro", atual === "claro");
    atualizarBotoesTema();
}

iniciar();
