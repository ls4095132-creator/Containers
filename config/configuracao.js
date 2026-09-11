const firebaseConfig={
  apiKey:"AIzaSyB6v2p3K6hQ7xJ5mV8nN0rP1sT2uW3xY4",
  authDomain:"controle-containers.firebaseapp.com",
  databaseURL:"https://controle-containers-default-rtdb.firebaseio.com",
  projectId:"controle-containers",
  storageBucket:"controle-containers.appspot.com",
  messagingSenderId:"",
  appId:""
};

if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=firebase.auth();
const db=firebase.database();

function msg(text,erro=false){
 const el=document.getElementById("mensagem");
 el.textContent=text; el.style.display="block";
 el.style.background=erro?"#f8d7da":"#d1e7dd";
 el.style.color=erro?"#842029":"#0f5132";
}
function voltarSistema(){window.location.href="../index.html";}

async function iniciar(){
 try{
  const user=await new Promise((resolve,reject)=>{
   const unsub=auth.onAuthStateChanged(u=>{unsub();resolve(u)});
   setTimeout(()=>reject(new Error("Tempo esgotado.")),10000);
  });
  if(!user){window.location.href="../index.html";return;}
  const snap=await db.ref("perfisUsuarios/"+user.uid).once("value");
  const perfil=snap.val()||{};
  if(perfil.tipo!=="admin"){
   alert("❌ Apenas o administrador pode acessar as configurações.");
   window.location.href="../index.html";return;
  }
  carregarConfiguracoes();
 }catch(e){
  console.error(e); msg("❌ Não foi possível carregar as configurações.",true);
 }
}
async function carregarConfiguracoes(){
 const snap=await db.ref("configuracoes/sistema").once("value");
 const c=snap.val()||{};
 document.getElementById("nomeSistema").value=c.nomeSistema||"Controle de Containers";
 document.getElementById("quantidadeContainers").value=c.quantidadeContainers||60;
 document.getElementById("modoAcesso").value=c.modoAcesso||"normal";
 document.getElementById("acessoDigital").checked=c.acessoDigital!==false;
 document.getElementById("notificacoesGerais").checked=c.notificacoesGerais!==false;
 document.getElementById("avisosEntrada").checked=c.avisosEntrada!==false;
 document.getElementById("avisosRecusa").checked=c.avisosRecusa!==false;
}
async function salvarConfiguracoes(){
 try{
  const dados={
   nomeSistema:document.getElementById("nomeSistema").value.trim()||"Controle de Containers",
   quantidadeContainers:Number(document.getElementById("quantidadeContainers").value)||60,
   modoAcesso:document.getElementById("modoAcesso").value,
   acessoDigital:document.getElementById("acessoDigital").checked,
   notificacoesGerais:document.getElementById("notificacoesGerais").checked,
   avisosEntrada:document.getElementById("avisosEntrada").checked,
   avisosRecusa:document.getElementById("avisosRecusa").checked,
   atualizadoEm:firebase.database.ServerValue.TIMESTAMP
  };
  await db.ref("configuracoes/sistema").set(dados);
  msg("✅ Configurações salvas com sucesso.");
 }catch(e){console.error(e);msg("❌ Erro ao salvar configurações.",true);}
}
iniciar();
