SISTEMA CONTROLE DE CONTAINERS — PACOTE PARA GITHUB PAGES

RAIZ DO SITE
- https://ls4095132-creator.github.io/Containers/

RAIZ DO SISTEMA SEPARADO
- /Containers/Contêineres_separados/
- Página inicial: /Containers/Contêineres_separados/index.html

ESTRUTURA
- index.html
- assets/
- containers/
- relatorios/
- kardex/
- produtos/
- usuarios/
- config/
- firebase-messaging-sw.js
- manifest.webmanifest
- icon-192.png
- icon-512.png

PERMISSÕES
ADMINISTRADOR
- Containers
- Relatórios
- Kardex
- Cadastro de Produtos
- Cadastro de Usuários
- Configurações

USUÁRIO COMUM
- Containers
- Kardex

USUÁRIO EXTERNO
- Containers em modo externo/leitura, conforme as regras existentes do sistema.

AUTENTICAÇÃO E PERMISSÕES
- Firebase Authentication é usado para autenticação.
- O perfil é lido em /perfisUsuarios/<UID>.
- O tipo é normalizado para admin, usuario ou externo.
- As permissões do menu e o acesso direto às URLs usam a mesma matriz.
- Não foi adicionado localStorage para controlar permissões.

NAVEGAÇÃO
- As telas internas possuem “← Menu Principal”.
- Voltar ao menu não encerra a sessão Firebase.
- Atualizar, Configuração e Sair ficam no Menu Principal.

NOTIFICAÇÕES
- OneSignal não faz parte do sistema ativo deste pacote.
- As notificações usam Firebase Cloud Messaging (FCM).
- O Service Worker do FCM fica na raiz de Contêineres_separados e usa caminhos relativos, compatíveis com GitHub Pages dentro de /Containers/.

CORREÇÕES DESTA VERSÃO
- Pacote sem pasta intermediária adicional: o conteúdo começa diretamente em Contêineres_separados/.
- Corrigidos os caminhos do FCM para páginas internas.
- Corrigidos os caminhos de ícones usados pelas notificações.
- criarContainers() não executa em páginas que não possuem a grade de Containers.
- Corrigido o botão duplicado “Menu Principal” da tela Containers.
- Padronizado o retorno das telas internas para “Menu Principal”.
