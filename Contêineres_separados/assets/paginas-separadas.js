/* ==========================================================
   PÁGINAS SEPARADAS — RELATÓRIOS / KARDEX / PRODUTOS / USUÁRIOS
   Fonte de dados: Firebase Realtime Database
   ========================================================== */
(function(){
"use strict";

function esc(v){
  return String(v==null?"":v).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  });
}
function arr(v){ return Array.isArray(v)?v:(v&&typeof v==="object"?Object.values(v):[]); }
function fmtData(v){
  if(!v) return "—";
  const d=new Date(v);
  if(!isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  return String(v);
}
function tipoUsuarioItem(x){
  return String(x && (x.tipoUsuario||x.usuarioTipo||x.perfil||x.tipo||"")).trim().toLowerCase();
}
function ehExterno(x){
  const t=tipoUsuarioItem(x);
  return t==="externo" || t==="usuario externo" || t==="usuário externo";
}
function ordenarDataDesc(a,b){
  return String(b.dataHora||b.data||b.hora||b.criadaEm||b.processadoEm||"").localeCompare(
    String(a.dataHora||a.data||a.hora||a.criadaEm||a.processadoEm||"")
  );
}
async function ler(path){
  const snap=await firebaseDB.ref(path).once("value");
  return snap.exists()?snap.val():null;
}

/* ==========================================================
   RELATÓRIOS
   ========================================================== */
async function carregarDadosRelatorios(){
  const [hist,sol] = await Promise.all([
    ler("historico"),
    ler("solicitacoesMercadoria")
  ]);
  const historico=arr(hist);
  const solicitacoes=arr(sol);

  // Movimentações: somente operações realizadas nos containers.
  // ENTRADA e SAÍDA ficam exclusivamente no relatório "Registros".
  const movimentacoes=historico.filter(x=>{
    const t=String(x.tipo||"").trim().toUpperCase();
    return t && t!=="ENTRADA" && t!=="SAÍDA";
  }).sort(ordenarDataDesc);

  // Registros: somente entradas e saídas.
  const registros=historico.filter(x=>{
    const t=String(x.tipo||"").trim().toUpperCase();
    return t==="ENTRADA" || t==="SAÍDA";
  }).sort(ordenarDataDesc);

  // Solicitações: somente solicitações de usuários externos.
  const solicitacoesExternas=solicitacoes.filter(ehExterno).sort(ordenarDataDesc);

  return {movimentacoes,registros,solicitacoesExternas};
}

function tabelaRelatorio(lista,tipo){
  const area=document.getElementById("relatorio-resultado");
  if(!area)return;

  let titulo="",headers=[],rows=[];
  if(tipo==="movimentacoes"){
    titulo="🔄 Movimentações dos Containers";
    headers=["Data/Hora","Tipo","Container","Produto","Código","Lote","Qtd.","Peso","NF","Operador","Detalhes"];
    rows=lista.map(x=>[
      fmtData(x.dataHora||x.data),
      x.tipo||"—", x.num||x.container||"—", x.prod||x.produto||"—",
      x.codigo||"—",x.lote||"—",x.qtd??"—",x.peso??x.kg??"—",x.nf||"—",
      x.operador||x.usuario||"—",x.detalhes||"—"
    ]);
  }else if(tipo==="registros"){
    titulo="📥 Registros de Entrada e Saída";
    headers=["Data/Hora","Tipo","Container","Produto","Código","Lote","Qtd.","Peso","NF","Fornecedor","Operador"];
    rows=lista.map(x=>[
      fmtData(x.dataHora||x.data),x.tipo||"—",x.num||x.container||"—",
      x.prod||x.produto||"—",x.codigo||"—",x.lote||"—",x.qtd??"—",
      x.peso??x.kg??"—",x.nf||"—",x.fornecedor||"—",x.operador||x.usuario||"—"
    ]);
  }else{
    titulo="📨 Solicitações de Usuários Externos";
    headers=["Data/Hora","Status","Container","Produto","Código","Lote","Qtd.","Peso","Solicitante","Filial","NF"];
    rows=lista.map(x=>[
      fmtData(x.dataHora||x.data||x.criadaEm),x.status||"pendente",
      x.container||x.num||x.containerOrigem||"—",x.produto||x.prod||"—",
      x.codigo||"—",x.lote||"—",x.quantidade??x.qtd??"—",
      x.peso??x.kg??"—",x.solicitante||x.nome||x.usuario||x.email||"—",
      x.filial||"—",x.nf||x.notaFiscal||"—"
    ]);
  }

  const thead=headers.map(h=>"<th>"+esc(h)+"</th>").join("");
  const tbody=rows.length?rows.map(r=>"<tr>"+r.map(c=>"<td>"+esc(c)+"</td>").join("")+"</tr>").join(""):
    '<tr><td colspan="'+headers.length+'" class="vazio">📭 Nenhum registro encontrado.</td></tr>';

  area.innerHTML='<div class="painel-relatorio">'+
    '<div class="cabecalho-relatorio"><h2>'+titulo+'</h2><span>'+lista.length+' registro(s)</span></div>'+
    '<div class="tabela-relatorio-wrap"><table class="tabela-relatorio"><thead><tr>'+thead+'</tr></thead><tbody>'+tbody+'</tbody></table></div>'+
    '</div>';
}
async function abrirRelatorioSeparado(tipo){
  const area=document.getElementById("relatorio-resultado");
  if(area) area.innerHTML='<div class="painel"><div class="vazio">⏳ Carregando dados do Firebase...</div></div>';
  try{
    const dados=await carregarDadosRelatorios();
    const lista=tipo==="movimentacoes"?dados.movimentacoes:tipo==="registros"?dados.registros:dados.solicitacoesExternas;
    tabelaRelatorio(lista,tipo);
    window._dadosRelatorioAtual={tipo,lista};
  }catch(e){
    console.error(e);
    if(area) area.innerHTML='<div class="painel"><div class="vazio">❌ Não foi possível carregar o relatório.</div></div>';
  }
}
window.abrirRelatorioMovimentacoes=function(){abrirRelatorioSeparado("movimentacoes");};
window.abrirRelatorioRegistros=function(){abrirRelatorioSeparado("registros");};
window.abrirRelatorioSolicitacoes=function(){abrirRelatorioSeparado("solicitacoes");};

/* ==========================================================
   KARDEX COMPLETO
   ========================================================== */
let kardexCompleto=[];
function linhaKardex(origem,x){
  return {
    origem:origem,
    data:fmtData(x.dataHora||x.data||x.criadaEm||x.processadoEm),
    tipo:x.tipo||x.status||origem,
    container:x.num||x.container||x.containerOrigem||x.containerDestino||"—",
    produto:x.prod||x.produto||"—",
    codigo:x.codigo||"—",
    lote:x.lote||"—",
    qtd:x.qtd??x.quantidade??"—",
    peso:x.peso??x.kg??"—",
    nf:x.nf||x.notaFiscal||"—",
    solicitante:x.solicitante||x.nome||x.usuario||x.operador||"—",
    filial:x.filial||"—",
    detalhes:x.detalhes||""
  };
}
async function carregarKardexCompleto(){
  const [hist,estoque,sol]=await Promise.all([
    ler("historico"),ler("estoque"),ler("solicitacoesMercadoria")
  ]);
  const h=arr(hist), e=arr(estoque), s=arr(sol);

  const lista=[];
  h.forEach(x=>lista.push(linhaKardex("HISTÓRICO",x)));
  s.forEach(x=>{
    if(ehExterno(x)) lista.push(linhaKardex("SOLICITAÇÃO EXTERNA",x));
  });
  e.forEach(x=>lista.push(linhaKardex("ESTOQUE ATUAL",x)));

  lista.sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  kardexCompleto=lista;
  return lista;
}
function renderizarKardexTabela(lista){
  const head=document.getElementById("kardex-cabecalho-titulos");
  const body=document.getElementById("kardex-corpo");
  const vazio=document.getElementById("kardex-vazio");
  if(!head||!body)return;
  const headers=["Origem","Data/Hora","Tipo/Status","Container","Produto","Código","Lote","Qtd.","Peso","NF","Solicitante/Operador","Filial","Detalhes"];
  head.innerHTML=headers.map(h=>"<th style='padding:8px;border-bottom:1px solid var(--borda);text-align:left;'>"+esc(h)+"</th>").join("");
  body.innerHTML=lista.map(x=>{
    const vals=[x.origem,x.data,x.tipo,x.container,x.produto,x.codigo,x.lote,x.qtd,x.peso,x.nf,x.solicitante,x.filial,x.detalhes];
    return "<tr>"+vals.map(v=>"<td style='padding:7px;border-bottom:1px solid var(--borda);'>"+esc(v)+"</td>").join("")+"</tr>";
  }).join("");
  if(vazio) vazio.style.display=lista.length?"none":"block";
}
window.renderizarKardex=async function(){
  try{
    const lista=await carregarKardexCompleto();
    renderizarKardexTabela(lista);
  }catch(e){console.error("Kardex:",e);}
};

function dadosExportacaoKardex(){
  return kardexCompleto.map(x=>({
    "Origem":x.origem,"Data/Hora":x.data,"Tipo/Status":x.tipo,"Container":x.container,
    "Produto":x.produto,"Código":x.codigo,"Lote":x.lote,"Quantidade":x.qtd,
    "Peso":x.peso,"NF":x.nf,"Solicitante/Operador":x.solicitante,"Filial":x.filial,
    "Detalhes":x.detalhes
  }));
}
async function garantirKardex(){
  if(!kardexCompleto.length) await window.renderizarKardex();
  return kardexCompleto;
}
window.exportarKardexExcel=async function(){
  const lista=await garantirKardex();
  if(!lista.length){alert("Não há dados para exportar.");return;}
  if(window.XLSX){
    const ws=XLSX.utils.json_to_sheet(dadosExportacaoKardex());
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Kardex");
    XLSX.writeFile(wb,"Kardex_Completo.xlsx");
  }else{
    const csv=gerarCSV(dadosExportacaoKardex());
    baixarArquivo(csv,"Kardex_Completo.csv","text/csv;charset=utf-8");
  }
};
function gerarCSV(lista){
  if(!lista.length)return "";
  const h=Object.keys(lista[0]);
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  return "\uFEFF"+h.map(q).join(";")+"\n"+lista.map(x=>h.map(k=>q(x[k])).join(";")).join("\n");
}
function baixarArquivo(conteudo,nome,tipo){
  const blob=new Blob([conteudo],{type:tipo});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=nome; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
window.exportarKardexWord=async function(){
  const lista=await garantirKardex();
  if(!lista.length){alert("Não há dados para exportar.");return;}
  const headers=Object.keys(dadosExportacaoKardex()[0]);
  const html='<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:9pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:4px}th{background:#e5e7eb}</style></head><body><h2>Kardex Completo — Controle de Containers</h2><table><tr>'+headers.map(h=>"<th>"+esc(h)+"</th>").join("")+"</tr>"+lista.map(x=>"<tr>"+headers.map(h=>"<td>"+esc(x[h])+"</td>").join("")+"</tr>").join("")+'</table></body></html>';
  baixarArquivo(html,"Kardex_Completo.doc","application/msword;charset=utf-8");
};
window.exportarKardexPdf=async function(){
  const lista=await garantirKardex();
  if(!lista.length){alert("Não há dados para exportar.");return;}
  const dados=dadosExportacaoKardex(), headers=Object.keys(dados[0]);
  if(!window.jspdf || !window.jspdf.jsPDF){alert("Biblioteca PDF não carregada.");return;}
  const doc=new jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  doc.setFontSize(12); doc.text("Kardex Completo — Controle de Containers",10,10);
  doc.autoTable({head:[headers],body:dados.map(x=>headers.map(h=>String(x[h]??""))),startY:14,styles:{fontSize:5,cellPadding:1.2},headStyles:{fontSize:5}});
  doc.save("Kardex_Completo_A4.pdf");
};
window.compartilharKardex=async function(){
  const lista=await garantirKardex();
  if(!lista.length){alert("Não há dados para compartilhar.");return;}
  if(!window.jspdf || !window.jspdf.jsPDF){alert("Biblioteca PDF não carregada.");return;}
  const dados=dadosExportacaoKardex(), headers=Object.keys(dados[0]);
  const doc=new jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  doc.setFontSize(12); doc.text("Kardex Completo — Controle de Containers",10,10);
  doc.autoTable({head:[headers],body:dados.map(x=>headers.map(h=>String(x[h]??""))),startY:14,styles:{fontSize:5,cellPadding:1.2},headStyles:{fontSize:5}});
  const blob=doc.output("blob");
  const file=new File([blob],"Kardex_Completo_A4.pdf",{type:"application/pdf"});
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{await navigator.share({title:"Kardex Completo",text:"Kardex completo — A4.",files:[file]});return;}catch(e){if(e.name==="AbortError")return;}
  }
  baixarArquivo(blob,"Kardex_Completo_A4.pdf","application/pdf");
  alert("O compartilhamento nativo não está disponível neste navegador. O PDF A4 foi baixado.");
};

/* ==========================================================
   PRODUTOS — CRUD REAL NO FIREBASE
   ========================================================== */
let produtoEdicao=-1;
function listaProdutosAtual(){ return Array.isArray(produtosCadastrados)?produtosCadastrados:[]; }
function renderProdutos(){
  const area=document.getElementById("lista-produtos-cadastro");
  const cont=document.getElementById("contador-produtos-cadastro");
  if(!area)return;
  const busca=String(document.getElementById("busca-produtos-cadastro")?.value||"").trim().toLowerCase();
  const lista=listaProdutosAtual().map((p,i)=>({p,i})).filter(o=>{
    return !busca || String(o.p.codigo||"").toLowerCase().includes(busca) || String(o.p.nome||"").toLowerCase().includes(busca);
  }).sort((a,b)=>String(a.p.nome||"").localeCompare(String(b.p.nome||""),"pt-BR"));
  if(cont)cont.textContent="Produtos cadastrados: "+listaProdutosAtual().length+" • Exibindo: "+lista.length;
  area.innerHTML=lista.length?lista.map(o=>{
    const p=o.p;
    return '<div class="produto-item produto-cadastro-linha">'+
      '<div><strong>'+esc(p.codigo||"—")+'</strong> — '+esc(p.nome||"Sem nome")+'</div>'+
      '<div class="acoes-item">'+
      '<button class="btn-acao" title="Editar" onclick="editarProdutoCadastro('+o.i+')">✏️</button>'+
      '<button class="btn-acao" title="Excluir" onclick="excluirProdutoCadastroFirebase('+o.i+')">🗑️</button>'+
      '</div></div>';
  }).join(""):'<div class="vazio">📭 Nenhum produto encontrado.</div>';
}
window.renderizarProdutosCadastro=async function(){
  try{
    const snap=await firebaseDB.ref("produtos").once("value");
    produtosCadastrados=arr(snap.val());
  }catch(e){console.error(e);}
  renderProdutos();
};
window.filtrarProdutosCadastro=renderProdutos;
window.editarProdutoCadastro=function(i){
  const p=listaProdutosAtual()[i]; if(!p)return;
  produtoEdicao=i;
  const c=document.getElementById("novo-produto-codigo"),n=document.getElementById("novo-produto-nome"),b=document.getElementById("btn-cancelar-produto-cadastro");
  if(c)c.value=p.codigo||""; if(n)n.value=p.nome||""; if(b)b.style.display="inline-block";
  window.scrollTo({top:0,behavior:"smooth"});
};
window.cancelarEdicaoProdutoCadastro=function(){
  produtoEdicao=-1;
  const c=document.getElementById("novo-produto-codigo"),n=document.getElementById("novo-produto-nome"),b=document.getElementById("btn-cancelar-produto-cadastro");
  if(c)c.value="";if(n)n.value="";if(b)b.style.display="none";
};
window.salvarProdutoCadastro=async function(){
  if(!usuarioEhAdmin()){alert("🔒 Apenas o administrador pode alterar produtos.");return;}
  const codigo=String(document.getElementById("novo-produto-codigo")?.value||"").trim();
  const nome=String(document.getElementById("novo-produto-nome")?.value||"").trim();
  if(!nome){alert("Informe o nome do produto.");return;}
  const lista=listaProdutosAtual().slice();
  if(produtoEdicao>=0 && lista[produtoEdicao]){
    lista[produtoEdicao]=Object.assign({},lista[produtoEdicao],{codigo,nome});
  }else{
    if(lista.some(p=>String(p.nome||"").trim().toLowerCase()===nome.toLowerCase())){
      alert("Este produto já está cadastrado.");return;
    }
    lista.push({codigo,nome});
  }
  try{
    await salvarProdutosFirebase(lista);
    window.cancelarEdicaoProdutoCadastro();
    renderProdutos();
    alert("✅ Produto salvo no Firebase.");
  }catch(e){console.error(e);alert("❌ Não foi possível salvar o produto no Firebase.");}
};
window.excluirProdutoCadastroFirebase=async function(i){
  if(!usuarioEhAdmin()){alert("🔒 Apenas o administrador pode excluir produtos.");return;}
  const lista=listaProdutosAtual().slice(), p=lista[i]; if(!p)return;
  if(!confirm("Excluir o produto \""+(p.nome||p.codigo)+"\"?"))return;
  lista.splice(i,1);
  try{await salvarProdutosFirebase(lista);renderProdutos();alert("✅ Produto excluído do Firebase.");}
  catch(e){console.error(e);alert("❌ Não foi possível excluir o produto.");}
};

/* ==========================================================
   USUÁRIOS
   ========================================================== */
async function iniciarPaginaUsuarios(){
  if(!usuarioEhAdmin())return;
  const area=document.getElementById("lista-usuarios-cadastrados");
  if(area && typeof renderizarUsuariosCadastradosAdmin==="function"){
    await renderizarUsuariosCadastradosAdmin();
  }
}
window.atualizarListaUsuariosPagina=iniciarPaginaUsuarios;

function iniciarPagina(){
  const pagina=String(document.body?.dataset?.pagina||"").toLowerCase();
  const executar=function(){
    if(pagina==="relatorios") setTimeout(()=>abrirRelatorioSeparado("movimentacoes"),300);
    if(pagina==="kardex") setTimeout(()=>window.renderizarKardex(),300);
    if(pagina==="produtos") setTimeout(()=>window.renderizarProdutosCadastro(),300);
    if(pagina==="usuarios") setTimeout(()=>iniciarPaginaUsuarios(),300);
  };
  if(typeof firebaseAuth!=="undefined"){
    let executado=false;
    firebaseAuth.onAuthStateChanged(function(user){
      if(user && !executado){ executado=true; executar(); }
    });
  }else{
    executar();
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciarPagina);
else iniciarPagina();

})();
