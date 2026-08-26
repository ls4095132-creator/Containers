// CONFIGURAÇÕES DO SEU REPOSITÓRIO
const TOKEN = "ghp_KwaxCmRhuu1CI5cEQ0IxzMz8Q4pGfT0LNTFA"; 
const OWNER = "ls4095132-creator";
const REPO = "Contêineres";
const PATH = "banco_dados/clientes.json";

document.getElementById('formCliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('nome').value;
    const telefone = document.getElementById('telefone').value;
    const novoCliente = { id: Date.now(), nome, telefone };

    try {
        // 1. Pega o arquivo atual do GitHub para não apagar os clientes antigos
        const url = `https://github.com{OWNER}/${REPO}/contents/${PATH}`;
        const resposta = await fetch(url, {
            headers: { "Authorization": `token ${TOKEN}` }
        });
        const arquivo = await resposta.json();
        
        // Decodifica o conteúdo atual (o GitHub guarda em formato Base64)
        const conteudoAtual = JSON.parse(atob(arquivo.content));
        
        // Adiciona o novo cliente na lista existente
        conteudoAtual.push(novoCliente);

        // 2. Envia a lista atualizada de volta para o GitHub
        const novoConteudoBase64 = btoa(JSON.stringify(conteudoAtual, null, 2));
        
        const atualizacao = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `token ${TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "Novo cliente cadastrado pelo site",
                content: novoConteudoBase64,
                sha: arquivo.sha // O SHA é obrigatório para o GitHub aceitar a alteração
            })
        });

        if (atualizacao.ok) {
            alert("Cliente salvo com sucesso na memória do GitHub!");
            document.getElementById('formCliente').reset();
        } else {
            alert("Erro ao salvar dados.");
        }

    } catch (erro) {
        console.error(erro);
        alert("Erro na conexão com o banco de dados.");
    }
});
