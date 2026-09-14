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

if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=firebase.auth();
const db=firebase.database();
const functions=firebase.functions();

let configuracoes={};
let usuarioAtual=null;
let perfis={};

function mensagem(texto,erro=false){
    const el=document.getElementById("mensagem");
    if(!el)return;
    el.textContent=texto;
    el.style.display="block";
    el.className="mensagem "+(erro?"erro":"sucesso");
    clearTimeout(window.__timerMensagemConfig);
    window.__timerMensagemConfig=setTimeout(()=>el.style.display="none",5000);
}

function voltarSistema(){
    window.location.href="../index.html";
}

async function alternarExibicaoUsuarios(){
    const area=document.getElementById("lista-usuarios");
    const aviso=document.getElementById("aviso-lista-usuarios-oculta");
    const botao=document.getElementById("btn-ocultar-usuarios");
    if(!area)return;
    const ocultar=area.style.display!=="none";
    area.style.display=ocultar?"none":"block";
    if(aviso)aviso.style.display=ocultar?"block":"none";
    if(botao)botao.innerText=ocultar?"👁️ Mostrar lista":"👁️ Ocultar lista";
    if(usuarioAtual){
        try{await db.ref("configuracoes/sistema/mostrarUsuariosCadastrados").set(!ocultar);}catch(e){console.warn(e);}
    }
}


function alterarQuantidade(delta){
    const campo=document.getElementById("quantidadeContainers");
    if(!campo)return;
    let n=Number(campo.value)||1;
    n=Math.max(1,Math.min(999,Math.floor(n)+delta));
    campo.value=n;
}

function normalizarLista(dados){
    if(!dados)return[];
    if(Array.isArray(dados)){
        return dados.map((item,index)=>Object.assign({__key:String(index)},item||{}));
    }
    if(typeof dados==="object"){
        return Object.keys(dados).map(key=>Object.assign({__key:key},dados[key]||{}));
    }
    return[];
}

function escapar(v){
    return String(v==null?"":v)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

async function carregarConfiguracoes(){
    const snap=await db.ref("configuracoes/sistema").once("value");
    const c=snap.exists()?(snap.val()||{}):{};
    configuracoes=Object.assign({
        quantidadeContainers:60,
        notificacoesGerais:true,
        avisosEntrada:true,
        avisosRecusa:true,
        avisosSolicitacoes:true,
        mostrarUsuariosCadastrados:true
    },c);
    const n=Math.max(1,Math.min(999,Math.floor(Number(configuracoes.quantidadeContainers)||60)));
    configuracoes.quantidadeContainers=n;
    document.getElementById("quantidadeContainers").value=n;
    document.getElementById("notificacoesGerais").checked=configuracoes.notificacoesGerais!==false;
    document.getElementById("avisosEntrada").checked=configuracoes.avisosEntrada!==false;
    document.getElementById("avisosRecusa").checked=configuracoes.avisosRecusa!==false;
    document.getElementById("avisosSolicitacoes").checked=configuracoes.avisosSolicitacoes!==false;
    const mostrarUsuarios=configuracoes.mostrarUsuariosCadastrados!==false;
    const area=document.getElementById("lista-usuarios"), aviso=document.getElementById("aviso-lista-usuarios-oculta"), botao=document.getElementById("btn-ocultar-usuarios");
    if(area)area.style.display=mostrarUsuarios?"block":"none";
    if(aviso)aviso.style.display=mostrarUsuarios?"none":"block";
    if(botao)botao.innerText=mostrarUsuarios?"👁️ Ocultar lista":"👁️ Mostrar lista";
}

async function salvarConfiguracoes(){
    try{
        const n=Math.max(1,Math.min(999,Math.floor(Number(document.getElementById("quantidadeContainers").value)||60)));
        const dados={
            quantidadeContainers:n,
            notificacoesGerais:document.getElementById("notificacoesGerais").checked,
            avisosEntrada:document.getElementById("avisosEntrada").checked,
            avisosRecusa:document.getElementById("avisosRecusa").checked,
            avisosSolicitacoes:document.getElementById("avisosSolicitacoes").checked,
            mostrarUsuariosCadastrados: configuracoes.mostrarUsuariosCadastrados !== false,
            atualizadoEm:firebase.database.ServerValue.TIMESTAMP,
            atualizadoPor:usuarioAtual ? (usuarioAtual.email||usuarioAtual.uid) : ""
        };
        await db.ref("configuracoes/sistema").update(dados);
        configuracoes=Object.assign({},configuracoes,dados);
        mensagem("✅ Configurações salvas no Firebase.");
        await carregarDadosPainel();
    }catch(e){
        console.error(e);
        mensagem("❌ Não foi possível salvar as configurações no Firebase.",true);
    }
}

async function carregarUsuarios(){
    const area=document.getElementById("lista-usuarios");
    if(area)area.innerHTML="Carregando usuários...";
    try{
        const snap=await db.ref("perfisUsuarios").once("value");
        perfis=snap.exists()?(snap.val()||{}):{};
        const usuarios=Object.keys(perfis).map(uid=>Object.assign({uid:uid},perfis[uid]||{}));
        if(!usuarios.length){area.innerHTML='<div class="vazio">Nenhum perfil encontrado no Firebase.</div>';return;}
        usuarios.sort((a,b)=>String(a.nome||a.email||"").localeCompare(String(b.nome||b.email||"")));
        area.innerHTML=usuarios.map((u)=>{
            const bloqueado=u.ativo===false;
            const tipo=u.tipo==="admin"?"👑 Administrador":(u.tipo==="externo"?"🌐 Usuário externo":"👤 Usuário comum");
            const uid=escapar(u.uid||"");
            const email=escapar(u.email||"");
            const nome=escapar(u.nome||u.usuario||u.email||"Usuário");
            const filial=u.filial?escapar(u.filial):'<b style="color:#ffb300">NÃO CADASTRADA</b>';
            return `<div class="item"><strong>${nome}</strong><br>
                <span class="meta">📧 ${email||"—"}<br>
                ${tipo} • 🏢 Filial: ${filial}<br>${bloqueado?"🚫 Bloqueado":"✅ Ativo"}</span>
                <div class="acoes">
                ${u.uid!==usuarioAtual.uid?`<button onclick="alternarBloqueio('${uid}')">${bloqueado?"🔓 Ativar":"🚫 Bloquear"}</button>`:""}
                <button onclick="redefinirSenha('${email}')">🔑 Redefinir senha</button>
                ${u.uid!==usuarioAtual.uid?`<button onclick="excluirUsuario('${uid}')">🗑️ Excluir</button>`:""}
                </div></div>`;
        }).join("");
    }catch(e){
        console.error(e);
        area.innerHTML='<div class="vazio">❌ Não foi possível carregar os usuários. Verifique as regras do Firebase.</div>';
    }
}

async function alternarBloqueio(uid){
    const u=perfis[uid];
    if(!u)return;
    const novo=u.ativo===false;
    if(!confirm((novo?"Ativar":"Bloquear")+" o usuário "+(u.email||u.nome)+"?"))return;
    try{
        await db.ref("perfisUsuarios/"+uid+"/ativo").set(novo);
        await carregarUsuarios();
        mensagem("✅ Status do usuário atualizado.");
    }catch(e){console.error(e);mensagem("❌ Não foi possível alterar o status.",true);}
}

async function redefinirSenha(email){
    if(!email)return;
    try{
        await auth.sendPasswordResetEmail(email);
        mensagem("✅ E-mail de redefinição enviado para "+email+".");
    }catch(e){console.error(e);mensagem("❌ Não foi possível enviar a redefinição.",true);}
}

async function excluirUsuario(uid){
    const u=perfis[uid];
    if(!u)return;
    if(!confirm("Excluir definitivamente o usuário "+(u.email||u.nome)+"? Essa ação não pode ser desfeita."))return;
    try{
        const excluir=functions.httpsCallable("excluirUsuario");
        await excluir({uid:uid});
        await carregarUsuarios();
        mensagem("✅ Usuário excluído do Firebase.");
    }catch(e){
        console.error(e);
        mensagem("❌ Não foi possível excluir. Verifique se a Cloud Function excluirUsuario está publicada.",true);
    }
}

async function carregarDadosPainel(){
    await carregarUsuarios();
}

function iniciar(){
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(()=>{});
    let validado=false;
    auth.onAuthStateChanged(async user=>{
        if(!user){
            if(validado)return;
            window.location.replace("../index.html");
            return;
        }
        try{
            const snap=await db.ref("perfisUsuarios/"+user.uid).once("value");
            const perfil=snap.exists()?(snap.val()||{}):{};
            if(perfil.tipo!=="admin"){
                alert("❌ Apenas o administrador pode acessar as configurações.");
                window.location.replace("../index.html");
                return;
            }
            if(perfil.ativo===false){
                alert("❌ Este usuário está bloqueado.");
                window.location.replace("../index.html");
                return;
            }
            usuarioAtual=Object.assign({uid:user.uid,email:user.email||""},perfil);
            validado=true;
            await carregarConfiguracoes();
            await carregarDadosPainel();
            document.body.classList.remove("carregando");
        }catch(e){
            console.error("Erro ao validar administrador:",e);
            mensagem("❌ Erro ao acessar o Firebase. Verifique as regras do Realtime Database.",true);
            setTimeout(()=>window.location.replace("../index.html"),3000);
        }
    });
}
iniciar();
