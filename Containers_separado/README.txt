SEPARAÇÃO DO SISTEMA CONTROLE DE CONTAINERS

Base preservada:
- index.html atual da pasta Contêineres_separados
- assets/sistema.js
- assets/estilos.css
- páginas separadas de containers, relatórios, kardex, produtos e usuários
- original/index (41)(2).html

PERMISSÕES CENTRALIZADAS

ADMINISTRADOR
- Containers
- Relatórios
- Kardex
- Cadastro de Produtos
- Cadastro de Usuários
- Configurações/gerenciamento administrativo, quando o arquivo de configuração estiver presente

USUÁRIO COMUM
- Containers
- Kardex
- Operações de estoque permitidas pelo sistema principal são mantidas sob as regras já existentes em sistema.js

USUÁRIO EXTERNO
- Containers
- Modo de consulta/leitura externa
- Não acessa Relatórios, Kardex, Cadastro de Produtos ou Cadastro de Usuários

REGRAS IMPORTANTES
1. O perfil é obtido em Firebase Realtime Database em:
   /perfisUsuarios/<UID>
2. O tipo é normalizado para:
   admin, usuario ou externo.
3. O código não usa window.usuarioLogadoAtual para determinar a permissão,
   porque sistema.js declara usuarioLogadoAtual como variável global "let".
4. O acesso ao menu e o acesso direto por URL usam a mesma matriz de permissões.
5. O sistema aguarda a restauração da sessão Firebase e a leitura do perfil
   antes de bloquear uma tela.
6. As proteções administrativas já existentes em sistema.js foram preservadas.
7. Não foi adicionado localStorage para controle de permissões.

OBSERVAÇÃO
A pasta config/ deste pacote contém somente README.txt. O arquivo
config/configuracao.html não está presente neste ZIP e, portanto, não foi
inventado ou substituído. O botão de gerenciamento de usuários continua
apontando para config/configuracao.html, conforme a estrutura atual.
