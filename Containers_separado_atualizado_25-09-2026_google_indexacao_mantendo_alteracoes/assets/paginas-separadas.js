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
function dataMovimentacao(x){
  if(!x) return "";
  if(x.dataHora) return x.dataHora;
  if(x.criadaEm) return x.criadaEm;
  if(x.processadoEm) return x.processadoEm;
  if(x.entradaEm) return x.entradaEm;
  if(x.timestamp!=null) return x.timestamp;
  if(x.updatedAt) return x.updatedAt;
  if(x.createdAt) return x.createdAt;
  if(x.data && x.hora) return String(x.data)+"T"+String(x.hora);
  return x.data||x.hora||"";
}
function valorDataOrdenacao(v){
  if(v==null || v==="") return NaN;
  if(typeof v === "number" && Number.isFinite(v)) return v < 100000000000 ? v*1000 : v;
  const texto=String(v).trim();
  if(/^\d{10,13}$/.test(texto)){
    const n=Number(texto);
    return texto.length===10 ? n*1000 : n;
  }
  const iso=Date.parse(texto);
  if(Number.isFinite(iso)) return iso;
  const br=texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if(br){
    const h=Number(br[4]||0),m=Number(br[5]||0),sec=Number(br[6]||0);
    return new Date(Number(br[3]),Number(br[2])-1,Number(br[1]),h,m,sec).getTime();
  }
  return NaN;
}
function ordenarDataDesc(a,b){
  const tb=valorDataOrdenacao(dataMovimentacao(b)), ta=valorDataOrdenacao(dataMovimentacao(a));
  if(Number.isFinite(tb) && Number.isFinite(ta)) return tb-ta;
  if(Number.isFinite(tb)) return -1;
  if(Number.isFinite(ta)) return 1;
  return String(dataMovimentacao(b)||"").localeCompare(String(dataMovimentacao(a)||""));
}
function tipoMovimentoNormalizado(x){
  const t=String(x && x.tipo || "").trim().toUpperCase();
  if(t==="ENTRADA" || t.startsWith("ENTRADA ")) return "ENTRADA";
  if(t==="SAÍDA" || t==="SAIDA" || t.startsWith("SAÍDA ") || t.startsWith("SAIDA ") || t==="CONTAINER ZERADO") return "SAÍDA";
  return t;
}
function quantidadeMovimento(x,tipo){
  const t=tipoMovimentoNormalizado(x);
  if(t===String(tipo||"").trim().toUpperCase()){
    return x?.qtd ?? x?.quantidade ?? "—";
  }
  return "—";
}
async function ler(path){
  const snap=await firebaseDB.ref(path).once("value");
  return snap.exists()?snap.val():null;
}

/* ==========================================================
   RELATÓRIOS — LISTAS, FILTROS, EXCLUSÃO E EXPORTAÇÃO
   ========================================================== */
let relatorioEstado={tipo:"",itens:[],filtrados:[],headers:[],rows:[]};
let relatorioListenersIniciados=false;
let relatorioAtualizacaoPendente=false;

async function carregarDadosRelatorios(){
  const [hist,sol] = await Promise.all([ler("historico"),ler("solicitacoesMercadoria")]);
  const historico=arr(hist).map((x,i)=>Object.assign({},x,{__sourceIndex:i}));
  const solicitacoes=arr(sol).map((x,i)=>Object.assign({},x,{__sourceIndex:i}));
  const movimentacoes=historico.filter(x=>{
    const t=tipoMovimentoNormalizado(x);
    return t && t!=="ENTRADA" && t!=="SAÍDA";
  }).sort(ordenarDataDesc);
  const registros=historico.filter(x=>{
    const t=tipoMovimentoNormalizado(x);
    return t==="ENTRADA" || t==="SAÍDA";
  }).sort(ordenarDataDesc);
  const solicitacoesExternas=solicitacoes.filter(ehExterno).sort(ordenarDataDesc);
  return {movimentacoes,registros,solicitacoesExternas};
}

function gerarCSV(lista){
  if(!lista.length)return "";
  const h=Object.keys(lista[0]);
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  return "\uFEFF"+h.map(q).join(";")+"\n"+lista.map(x=>h.map(k=>q(x[k])).join(";")).join("\n");
}
function baixarArquivo(conteudo,nome,tipo){
  const blob=conteudo instanceof Blob?conteudo:new Blob([conteudo],{type:tipo});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function configuracaoRelatorio(tipo){
  if(tipo==="movimentacoes") return {
    titulo:"🔄 Movimentações dos Containers",
    headers:["Data/Hora","Tipo","Container","Produto","Código","Lote","Qtd.","Peso","NF","Operador","Detalhes"],
    valores:x=>[fmtData(dataMovimentacao(x)),x.tipo||"—",x.num||x.container||"—",x.prod||x.produto||"—",x.codigo||"—",x.lote||"—",x.qtd??"—",x.peso??x.kg??"—",x.nf||"—",x.operador||x.usuario||"—",x.detalhes||"—"]
  };
  if(tipo==="registros") return {
    titulo:"📥 Registros de Entrada e Saída",
    headers:["Data/Hora","Entrada","Saída","Tipo","Container","Produto","Código","Lote","Qtd.","Peso","NF","Fornecedor","Operador"],
    valores:x=>[fmtData(dataMovimentacao(x)),quantidadeMovimento(x,"ENTRADA"),quantidadeMovimento(x,"SAÍDA"),x.tipo||"—",x.num||x.container||"—",x.prod||x.produto||"—",x.codigo||"—",x.lote||"—",x.qtd??"—",x.peso??x.kg??"—",x.nf||"—",x.fornecedor||"—",x.operador||x.usuario||"—"]
  };
  return {
    titulo:"📨 Solicitações de Usuários Externos",
    headers:["Data/Hora","Status","Container","Produto","Código","Lote","Qtd.","Peso","Solicitante","Filial","NF"],
    valores:x=>[fmtData(x.dataHora||x.data||x.criadaEm),x.status||"pendente",x.container||x.num||x.containerOrigem||"—",x.produto||x.prod||"—",x.codigo||"—",x.lote||"—",x.quantidade??x.qtd??"—",x.peso??x.kg??"—",x.solicitante||x.nome||x.usuario||x.email||"—",x.filial||"—",x.nf||x.notaFiscal||"—"]
  };
}
function linhasRelatorio(itens,tipo){
  const cfg=configuracaoRelatorio(tipo);
  return itens.map(x=>cfg.valores(x));
}
function renderizarRelatorio(lista,tipo,filtros){
  const area=document.getElementById("relatorio-resultado"); if(!area)return;
  const cfg=configuracaoRelatorio(tipo); const rows=linhasRelatorio(lista,tipo);
  relatorioEstado={tipo,itens:lista,filtrados:lista,headers:cfg.headers,rows};
  const inputs=cfg.headers.map((h,i)=>'<th><input class="filtro-coluna-relatorio" data-col="'+i+'" placeholder="🔎 '+esc(h)+'" value="'+esc((filtros&&filtros[i])||"")+'"></th>').join("");
  const body=rows.length?rows.map((r,idx)=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join("")+'<td class="relatorio-acoes"><button class="btn-acao" title="Apagar linha" onclick="excluirLinhaRelatorio('+idx+')">🗑️</button></td></tr>').join(""):'<tr><td colspan="'+(cfg.headers.length+1)+'" class="vazio">📭 Nenhum registro encontrado.</td></tr>';
  area.innerHTML='<div class="painel-relatorio">'+
    '<div class="cabecalho-relatorio"><div><h2>'+cfg.titulo+'</h2><span>'+lista.length+' registro(s)</span></div><div class="relatorio-botoes">'+
    '<button class="btn-produto" onclick="exportarRelatorioExcel()">📊 Excel</button>'+
    '<button class="btn-produto" onclick="exportarRelatorioWord()">📄 Word</button>'+
    '<button class="btn-produto" onclick="compartilharRelatorio()">📤 Compartilhar</button>'+
    '<button class="btn-apagar-historico" onclick="excluirTodosRelatorio()">🗑️ Apagar tudo</button></div></div>'+
    '<div class="relatorio-subacoes"><button class="btn-vis" onclick="abrirRelatorioSeparado(\''+tipo+'\')">🔄 Atualizar</button></div>'+
    '<div class="tabela-relatorio-wrap"><table class="tabela-relatorio"><thead><tr>'+cfg.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'<th>Ações</th></tr><tr class="relatorio-filtros">'+inputs+'<th></th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
  area.querySelectorAll('.filtro-coluna-relatorio').forEach(input=>input.addEventListener('input',aplicarFiltrosRelatorio));
}
function aplicarFiltrosRelatorio(){
  const area=document.getElementById('relatorio-resultado'); if(!area)return;
  const tipo=relatorioEstado.tipo, cfg=configuracaoRelatorio(tipo);
  const filtros=Array.from(area.querySelectorAll('.filtro-coluna-relatorio')).map(x=>String(x.value||'').toLowerCase().trim());
  const filtrados=relatorioEstado.itens.filter(item=>{
    const row=cfg.valores(item).map(v=>String(v??'').toLowerCase());
    return filtros.every((f,i)=>!f || row[i].includes(f));
  });
  const rows=linhasRelatorio(filtrados,tipo);
  relatorioEstado.filtrados=filtrados; relatorioEstado.rows=rows;
  const tbody=area.querySelector('.tabela-relatorio tbody');
  if(tbody) tbody.innerHTML=rows.length?rows.map((r,idx)=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'<td class="relatorio-acoes"><button class="btn-acao" title="Apagar linha" onclick="excluirLinhaRelatorio('+idx+')">🗑️</button></td></tr>').join(''):'<tr><td colspan="'+(cfg.headers.length+1)+'" class="vazio">📭 Nenhum registro encontrado.</td></tr>';
}
function iniciarListenersRelatoriosTempoReal(){
  if(relatorioListenersIniciados || typeof firebaseDB==='undefined' || !firebaseDB)return;
  relatorioListenersIniciados=true;
  const reagendar=function(){
    if(relatorioAtualizacaoPendente)return;
    relatorioAtualizacaoPendente=true;
    setTimeout(async function(){
      relatorioAtualizacaoPendente=false;
      const tipoAtual=relatorioEstado.tipo;
      if(!tipoAtual || !document.getElementById('relatorio-resultado'))return;
      const area=document.getElementById('relatorio-resultado');
      const filtros=area?Array.from(area.querySelectorAll('.filtro-coluna-relatorio')).map(function(x){return String(x.value||'');}):[];
      try{
        const dados=await carregarDadosRelatorios();
        const lista=tipoAtual==='movimentacoes'?dados.movimentacoes:tipoAtual==='registros'?dados.registros:dados.solicitacoesExternas;
        renderizarRelatorio(lista,tipoAtual,filtros);
        window._dadosRelatorioAtual={tipo:tipoAtual,lista:lista};
      }catch(e){console.error('Atualização em tempo real do relatório:',e);}
    },120);
  };
  firebaseDB.ref('historico').on('value',reagendar);
  firebaseDB.ref('solicitacoesMercadoria').on('value',reagendar);
}

async function abrirRelatorioSeparado(tipo){
  const area=document.getElementById("relatorio-resultado");
  if(area) area.innerHTML='<div class="painel"><div class="vazio">⏳ Carregando dados do Firebase...</div></div>';
  iniciarListenersRelatoriosTempoReal();
  try{
    const dados=await carregarDadosRelatorios();
    const lista=tipo==="movimentacoes"?dados.movimentacoes:tipo==="registros"?dados.registros:dados.solicitacoesExternas;
    renderizarRelatorio(lista,tipo,{});
    window._dadosRelatorioAtual={tipo,lista};
  }catch(e){console.error(e);if(area)area.innerHTML='<div class="painel"><div class="vazio">❌ Não foi possível carregar o relatório.</div></div>';}
}
window.abrirRelatorioSeparado=abrirRelatorioSeparado;
window.abrirRelatorioMovimentacoes=function(){abrirRelatorioSeparado("movimentacoes");};
window.abrirRelatorioRegistros=function(){abrirRelatorioSeparado("registros");};
window.abrirRelatorioSolicitacoes=function(){abrirRelatorioSeparado("solicitacoes");};

async function salvarListaRelatorioFirebase(path,lista){
  if(!firebaseAuth.currentUser) throw new Error('Usuário não autenticado.');
  await firebaseDB.ref(path).set(lista);
}
async function excluirLinhaRelatorio(posicao){
  if(typeof usuarioPodeOperarTela==='function' ? !usuarioPodeOperarTela('relatorios') : !usuarioEhAdmin()){alert('🔒 Você não tem permissão para alterar os relatórios.');return;}
  const item=relatorioEstado.filtrados[posicao]; if(!item)return;
  const tipo=relatorioEstado.tipo;
  const path=tipo==='solicitacoes'?'solicitacoesMercadoria':'historico';
  if(!confirm('Apagar este registro do Firebase?\n\nO estoque atual não será alterado.'))return;
  try{
    const snap=await firebaseDB.ref(path).once('value');
    const lista=arr(snap.val());
    let idx=-1;
    if(item.id) idx=lista.findIndex(x=>x&&String(x.id)===String(item.id));
    if(idx<0) idx=Number(item.__sourceIndex);
    if(idx<0 || idx>=lista.length) throw new Error('Registro não encontrado no Firebase.');
    lista.splice(idx,1);
    await salvarListaRelatorioFirebase(path,lista);
    await abrirRelatorioSeparado(tipo);
    alert('✅ Registro apagado.');
  }catch(e){console.error(e);alert('❌ Não foi possível apagar o registro.\n\n'+(e.message||e));}
}
async function excluirTodosRelatorio(){
  if(typeof usuarioPodeOperarTela==='function' ? !usuarioPodeOperarTela('relatorios') : !usuarioEhAdmin()){alert('🔒 Você não tem permissão para alterar os relatórios.');return;}
  const tipo=relatorioEstado.tipo; const path=tipo==='solicitacoes'?'solicitacoesMercadoria':'historico';
  const nome=tipo==='movimentacoes'?'todas as movimentações':tipo==='registros'?'todos os registros de entrada e saída':'todas as solicitações externas';
  if(!confirm('Tem certeza que deseja apagar '+nome+' do Firebase?\n\nO estoque atual NÃO será apagado.'))return;
  try{
    const snap=await firebaseDB.ref(path).once('value'); const lista=arr(snap.val());
    const manter=lista.filter(x=>{
      if(tipo==='solicitacoes') return !ehExterno(x);
      const t=tipoMovimentoNormalizado(x);
      return tipo==='movimentacoes' ? (t==='ENTRADA'||t==='SAÍDA') : !(t==='ENTRADA'||t==='SAÍDA');
    });
    await salvarListaRelatorioFirebase(path,manter);
    await abrirRelatorioSeparado(tipo);
    alert('✅ '+nome.charAt(0).toUpperCase()+nome.slice(1)+' foram apagadas.');
  }catch(e){console.error(e);alert('❌ Não foi possível apagar os registros.\n\n'+(e.message||e));}
}
window.excluirLinhaRelatorio=excluirLinhaRelatorio;
window.excluirTodosRelatorio=excluirTodosRelatorio;

function dadosRelatorioExportacao(){
  const cfg=configuracaoRelatorio(relatorioEstado.tipo);
  return relatorioEstado.filtrados.map(x=>cfg.valores(x));
}
function gerarXlsxRelatorio(){
  const dados=dadosRelatorioExportacao(); if(!dados.length)return null;
  const headers=relatorioEstado.headers;
  if(window.XLSX){
    const ws=XLSX.utils.aoa_to_sheet([headers,...dados]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Relatório');
    return {blob:null,download:true,workbook:wb};
  }
  return null;
}
window.exportarRelatorioExcel=function(){
  const dados=dadosRelatorioExportacao(); if(!dados.length){alert('Não há dados para exportar.');return;}
  const nome='Relatorio_'+relatorioEstado.tipo+'.xlsx';
  if(window.XLSX){const ws=XLSX.utils.aoa_to_sheet([relatorioEstado.headers,...dados]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Relatório');XLSX.writeFile(wb,nome);return;}
  baixarArquivo(gerarCSV(dados.map(r=>Object.fromEntries(relatorioEstado.headers.map((h,i)=>[h,r[i]])))),nome.replace('.xlsx','.csv'),'text/csv;charset=utf-8');
};
window.exportarRelatorioWord=function(){
  const dados=dadosRelatorioExportacao(); if(!dados.length){alert('Não há dados para exportar.');return;}
  const html='<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:9pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:4px}th{background:#e5e7eb}</style></head><body><h2>'+esc(configuracaoRelatorio(relatorioEstado.tipo).titulo)+'</h2><table><tr>'+relatorioEstado.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>'+dados.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</table></body></html>';
  baixarArquivo(html,'Relatorio_'+relatorioEstado.tipo+'.doc','application/msword;charset=utf-8');
};
window.compartilharRelatorio=async function(){
  const dados=dadosRelatorioExportacao();
  if(!dados.length){alert('Não há dados para compartilhar.');return;}
  if(!window.jspdf || !window.jspdf.jsPDF){
    alert('Biblioteca PDF não carregada. Atualize a página e tente novamente.');
    return;
  }
  try{
    const cfg=configuracaoRelatorio(relatorioEstado.tipo);
    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    doc.setFontSize(12);
    doc.text(String(cfg.titulo||'Relatório — Controle de Containers').replace(/[📊🔄📥📨]/g,''),10,10);
    doc.autoTable({head:[relatorioEstado.headers],body:dados.map(function(row){return row.map(function(v){return String(v==null?'':v);});}),startY:14,styles:{fontSize:5,cellPadding:1.2,overflow:'linebreak'},headStyles:{fontSize:5}});
    const blob=doc.output('blob');
    const nome='Relatorio_'+relatorioEstado.tipo+'_A4.pdf';
    const file=new File([blob],nome,{type:'application/pdf'});
    if(typeof navigator!=='undefined' && typeof navigator.share==='function'){
      try{
        const podeCompartilhar=typeof navigator.canShare!=='function' || navigator.canShare({files:[file]});
        if(podeCompartilhar){await navigator.share({title:cfg.titulo,text:'Relatório — Controle de Containers',files:[file]});return;}
      }catch(e){if(e && e.name==='AbortError')return;console.warn('Compartilhamento nativo do relatório:',e);}
    }
    baixarArquivo(blob,nome,'application/pdf');
    alert('O compartilhamento nativo não está disponível neste navegador. O PDF A4 foi gerado e baixado para você compartilhar.');
  }catch(e){console.error('Erro ao compartilhar relatório:',e);alert('Não foi possível gerar o arquivo para compartilhamento.\n\n'+(e.message||e));}
};

/* ==========================================================
   KARDEX COMPLETO — EXCLUSÃO POR LINHA E LIMPEZA TOTAL
   ========================================================== */
let kardexCompleto=[];
let kardexListenersIniciados=false;
let kardexAtualizacaoPendente=false;
function linhaKardex(origem,x,sourceIndex){
  const tipo=x?.tipo||x?.status||origem;
  return {
    origem:origem,sourceIndex:Number.isFinite(sourceIndex)?sourceIndex:-1,id:x&&x.id?String(x.id):'',
    data:fmtData(dataMovimentacao(x)),_dataOrdenacao:valorDataOrdenacao(dataMovimentacao(x)),
    tipo:tipo,entrada:quantidadeMovimento(x,"ENTRADA"),saida:quantidadeMovimento(x,"SAÍDA"),
    container:x.num||x.container||x.containerOrigem||x.containerDestino||'—',
    produto:x.prod||x.produto||'—',codigo:x.codigo||'—',lote:x.lote||'—',qtd:x.qtd??x.quantidade??'—',peso:x.peso??x.kg??'—',
    nf:x.nf||x.notaFiscal||'—',solicitante:x.solicitante||x.nome||x.usuario||x.operador||'—',filial:x.filial||'—',detalhes:x.detalhes||''
  };
}
async function carregarKardexCompleto(){
  const [hist,estoque,sol]=await Promise.all([ler('historico'),ler('estoque'),ler('solicitacoesMercadoria')]);
  const h=arr(hist),e=arr(estoque),s=arr(sol),lista=[];
  h.forEach((x,i)=>lista.push(linhaKardex('HISTÓRICO',x,i)));
  s.forEach((x,i)=>{if(ehExterno(x))lista.push(linhaKardex('SOLICITAÇÃO EXTERNA',x,i));});
  e.forEach((x,i)=>lista.push(linhaKardex('ESTOQUE ATUAL',x,i)));
  lista.sort((a,b)=>{
    const db=Number.isFinite(b._dataOrdenacao)?b._dataOrdenacao:valorDataOrdenacao(b.data);
    const da=Number.isFinite(a._dataOrdenacao)?a._dataOrdenacao:valorDataOrdenacao(a.data);
    if(Number.isFinite(db)&&Number.isFinite(da)) return db-da;
    if(Number.isFinite(db)) return -1;
    if(Number.isFinite(da)) return 1;
    return String(b.data||"").localeCompare(String(a.data||""));
  });
  kardexCompleto=lista; return lista;
}
function garantirKardex(){
  return kardexCompleto.length ? Promise.resolve(kardexCompleto) : carregarKardexCompleto();
}
function dadosExportacaoKardex(){
  const lista=Array.isArray(kardexCompleto) ? kardexCompleto : [];
  return lista.map(x=>({
    "Origem":x.origem||"",
    "Data/Hora":x.data||"",
    "Entrada":x.entrada??"",
    "Saída":x.saida??"",
    "Tipo/Status":x.tipo||"",
    "Container":x.container||"",
    "Produto":x.produto||"",
    "Código":x.codigo||"",
    "Lote":x.lote||"",
    "Qtd.":x.qtd??"",
    "Peso":x.peso??"",
    "NF":x.nf||"",
    "Solicitante/Operador":x.solicitante||"",
    "Filial":x.filial||"",
    "Detalhes":x.detalhes||""
  }));
}
function renderizarKardexTabela(lista){
  const head=document.getElementById('kardex-cabecalho-titulos'),body=document.getElementById('kardex-corpo'),vazio=document.getElementById('kardex-vazio');if(!head||!body)return;
  const headers=['Origem','Data/Hora','Entrada','Saída','Tipo/Status','Container','Produto','Código','Lote','Qtd.','Peso','NF','Solicitante/Operador','Filial','Detalhes'];
  head.innerHTML=headers.map(h=>'<th style="padding:8px;border-bottom:1px solid var(--borda);text-align:left;">'+esc(h)+'</th>').join('')+'<th>Ações</th>';
  body.innerHTML=lista.map((x,idx)=>{const vals=[x.origem,x.data,x.entrada,x.saida,x.tipo,x.container,x.produto,x.codigo,x.lote,x.qtd,x.peso,x.nf,x.solicitante,x.filial,x.detalhes];return '<tr>'+vals.map(v=>'<td style="padding:7px;border-bottom:1px solid var(--borda);">'+esc(v)+'</td>').join('')+'<td><button class="btn-acao" title="Apagar linha" onclick="excluirLinhaKardex('+idx+')">🗑️</button></td></tr>';}).join('');
  if(vazio)vazio.style.display=lista.length?'none':'block';
}
function iniciarListenersKardexTempoReal(){
  if(kardexListenersIniciados || typeof firebaseDB==='undefined' || !firebaseDB)return;
  kardexListenersIniciados=true;
  const reagendar=function(){
    if(kardexAtualizacaoPendente)return;
    kardexAtualizacaoPendente=true;
    setTimeout(async function(){
      kardexAtualizacaoPendente=false;
      const tela=document.getElementById('tela-kardex');
      if(!tela || tela.style.display==='none')return;
      try{const lista=await carregarKardexCompleto();renderizarKardexTabela(lista);}catch(e){console.error('Atualização em tempo real do Kardex:',e);}
    },120);
  };
  firebaseDB.ref('historico').on('value',reagendar);
  firebaseDB.ref('estoque').on('value',reagendar);
  firebaseDB.ref('solicitacoesMercadoria').on('value',reagendar);
}
window.renderizarKardex=async function(){
  try{iniciarListenersKardexTempoReal();const lista=await carregarKardexCompleto();renderizarKardexTabela(lista);}catch(e){console.error('Kardex:',e);}
};
window.excluirTudoKardex=async function(){
  if(typeof usuarioPodeOperarTela==='function' ? !usuarioPodeOperarTela('kardex') : !usuarioEhAdmin()){alert('🔒 Você não tem permissão para alterar o Kardex.');return;}
  if(!confirm('APAGAR TUDO DO KARDEX?\n\nIsso limpará o histórico, as solicitações externas e o estoque atual exibidos no Kardex. Esta ação não pode ser desfeita.'))return;
  try{await Promise.all([firebaseDB.ref('historico').set([]),firebaseDB.ref('solicitacoesMercadoria').set([]),firebaseDB.ref('estoque').set([])]);kardexCompleto=[];await window.renderizarKardex();alert('✅ Kardex apagado completamente.');}
  catch(e){console.error(e);alert('❌ Não foi possível apagar o Kardex.\n\n'+(e.message||e));}
};
window.exportarKardexExcel=async function(){const lista=await garantirKardex();if(!lista.length){alert('Não há dados para exportar.');return;}if(window.XLSX){const ws=XLSX.utils.json_to_sheet(dadosExportacaoKardex());const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Kardex');XLSX.writeFile(wb,'Kardex_Completo.xlsx');}else{baixarArquivo(gerarCSV(dadosExportacaoKardex()),'Kardex_Completo.csv','text/csv;charset=utf-8');}};
window.exportarKardexWord=async function(){const lista=await garantirKardex();if(!lista.length){alert('Não há dados para exportar.');return;}const headers=Object.keys(dadosExportacaoKardex()[0]);const html='<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;font-size:9pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:4px}th{background:#e5e7eb}</style></head><body><h2>Kardex Completo — Controle de Containers</h2><table><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>'+lista.map(x=>'<tr>'+headers.map(h=>'<td>'+esc(x[h])+'</td>').join('')+'</tr>').join('')+'</table></body></html>';baixarArquivo(html,'Kardex_Completo.doc','application/msword;charset=utf-8');};
window.exportarKardexPdf=async function(){const lista=await garantirKardex();if(!lista.length){alert('Não há dados para exportar.');return;}const dados=dadosExportacaoKardex(),headers=Object.keys(dados[0]);if(!window.jspdf||!window.jspdf.jsPDF){alert('Biblioteca PDF não carregada.');return;}const doc=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});doc.setFontSize(12);doc.text('Kardex Completo — Controle de Containers',10,10);doc.autoTable({head:[headers],body:dados.map(x=>headers.map(h=>String(x[h]??''))),startY:14,styles:{fontSize:5,cellPadding:1.2},headStyles:{fontSize:5}});doc.save('Kardex_Completo_A4.pdf');};
window.compartilharKardex=async function(){const lista=await garantirKardex();if(!lista.length){alert('Não há dados para compartilhar.');return;}if(!window.jspdf||!window.jspdf.jsPDF){alert('Biblioteca PDF não carregada.');return;}const dados=dadosExportacaoKardex(),headers=Object.keys(dados[0]);const doc=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});doc.setFontSize(12);doc.text('Kardex Completo — Controle de Containers',10,10);doc.autoTable({head:[headers],body:dados.map(x=>headers.map(h=>String(x[h]??''))),startY:14,styles:{fontSize:5,cellPadding:1.2},headStyles:{fontSize:5}});const blob=doc.output('blob'),file=new File([blob],'Kardex_Completo_A4.pdf',{type:'application/pdf'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({title:'Kardex Completo',text:'Kardex completo — A4.',files:[file]});return;}catch(e){if(e.name==='AbortError')return;}}baixarArquivo(blob,'Kardex_Completo_A4.pdf','application/pdf');alert('O compartilhamento nativo não está disponível neste navegador. O PDF A4 foi baixado.');};

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
  if(typeof usuarioPodeOperarTela==='function' ? !usuarioPodeOperarTela('produtos') : !usuarioEhAdmin()){alert("🔒 Você não tem permissão para alterar produtos.");return;}
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
  if(typeof usuarioPodeOperarTela==='function' ? !usuarioPodeOperarTela('produtos') : !usuarioEhAdmin()){alert("🔒 Você não tem permissão para excluir produtos.");return;}
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
  const area=document.getElementById("lista-usuarios-cadastrados");
  if(!area || typeof renderizarUsuariosCadastradosAdmin!=="function") return;

  // O perfil pode chegar ao Realtime Database alguns instantes depois
  // do Firebase Authentication. Tenta novamente automaticamente para
  // que a lista já apareça aberta ao entrar na tela.
  let tentativas=0;
  const tentar=async function(){
    tentativas++;
    const podeGerenciarUsuarios = typeof usuarioPodeOperarTela==='function' ? usuarioPodeOperarTela('usuarios') : usuarioEhAdmin();
    if(podeGerenciarUsuarios){
      try{
        await renderizarUsuariosCadastradosAdmin(true);
      }catch(e){
        console.error("Erro ao carregar usuários:",e);
      }
      return true;
    }
    return tentativas>=20;
  };

  if(await tentar()) return;

  const intervalo=setInterval(async function(){
    if(await tentar()){
      clearInterval(intervalo);
    }
  },300);
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
