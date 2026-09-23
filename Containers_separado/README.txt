SEPARAÇÃO DO SISTEMA CONTROLE DE CONTAINERS

Base preservada: index (41)(2).html
Modelo visual do Menu Principal: index (54).html

index.html = Menu Principal
containers/index.html = Containers
relatorios/index.html = Relatórios
kardex/index.html = Kardex
produtos/index.html = Cadastro de Produtos
usuarios/index.html = Cadastro de Usuários (abre Configurações/Acesso Digital existente)
config/ = pasta reservada para a configuração existente; não foi sobrescrita
assets/sistema.js = código JavaScript preservado do sistema atual
assets/estilos.css = CSS preservado + estilo do menu
assets/navegacao-separada.js = navegação/permissões entre as páginas
original/ = cópia do index original enviado

PERMISSÕES
Admin: todas as telas
Usuário comum: Containers e Kardex
Usuário externo: Containers somente visualização

Observação: o Firebase Authentication e Realtime Database continuam sendo os mesmos; não foi criado banco separado e não foi utilizado localStorage para controlar permissões.

IMPORTANTE: o arquivo config/configuracao.html existente não estava anexado neste turno; por isso a separação não sobrescreve nem inventa esse arquivo. Ao instalar, mantenha sua pasta config atual junto do pacote.
