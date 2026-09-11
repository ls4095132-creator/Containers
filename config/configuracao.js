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
    document.getElementById("modoAcesso").value = c.modoAcesso || "normal";
    document.getElementById("acessoDigital").checked = c.acessoDigital !== false;
    document.getElementById("notificacoesGerais").checked = c.notificacoesGerais !== false;
    document.getElementById("avisosEntrada").checked = c.avisosEntrada !== false;
    document.getElementById("avisosRecusa").checked = c.avisosRecusa !== false;
}

async function salvarConfiguracoes(){
    try{
        const dados = {
            nomeSistema: document.getElementById("nomeSistema").value.trim() || "Controle de Containers",
            quantidadeContainers: Number(document.getElementById("quantidadeContainers").value) || 60,
            modoAcesso: document.getElementById("modoAcesso").value,
            acessoDigital: document.getElementById("acessoDigital").checked,
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

iniciar();
