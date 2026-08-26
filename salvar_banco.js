// CONFIGURAÇÕES PÚBLICAS (Sem senhas expostas!)
const OWNER = "ls4095132-creator";
const REPO = "Containers"; 

// Escuta o clique do seu botão roxo "Cadastrar Usuário"
document.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Captura os dados exatos dos campos da sua tela
    const usuario = document.querySelector('input[placeholder="Nome de usuário"]').value;
    const senha = document.querySelector('input[placeholder*="Senha"]').value;
    const tipoAcesso = document.querySelector('select').value; 
    
    // Organiza os dados que vão para a memória do GitHub
    const dadosUsuario = { 
        id: Date.now(), 
        usuario: usuario, 
        senha: senha, 
        tipo_acesso: tipoAcesso,
        data_cadastro: new Date().toISOString()
    };

    try {
        // Envia os dados para a fila de automação segura do GitHub
        const url = `https://github.com{OWNER}/${REPO}/dispatches`;
        
        const resposta = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                event_type: "novo_cadastro",
                client_payload: dadosUsuario
            })
        });

        if (resposta.status === 204 || resposta.ok) {
            alert("Solicitação de cadastro de usuário enviada! O sistema vai atualizar a lista em alguns segundos.");
            document.querySelector('form').reset();
        } else {
            alert("Erro ao enviar dados para o servidor do GitHub.");
        }

    } catch (erro) {
        console.error(erro);
        alert("Erro na conexão com o sistema.");
    }
});
