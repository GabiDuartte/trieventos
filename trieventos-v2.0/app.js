const express = require("express");
const ejs = require('ejs');
const path = require('path');
const {Pool} = require('pg');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const bcrypt = require('bcryptjs');
const match = require('assert');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');



const chave = '3eventsxcz';
const chaveEstab = 'qw,ckdsl';

const app = express();

app.set('view engine', 'ejs');


app.use(express.json());
//para servir arquivos estáticos ao CSS
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

const pool = new Pool(
    {
        user: 'postgres',
        password: '',
        host: 'localhost',
        port: 5432,
        database: ''
    }
);

function generateToken(user) {
    const token = jwt.sign({ id: user.id, role: user.role }, secretKey, { expiresIn: '1h' });
    return token;
  }
  

  function authenticateToken(req, res, next) {
    const token = req.cookies.token;
  
    if (!token) {
      return res.redirect('/login');
    }
  
    try {
      const decoded = jwt.verify(token, chave);
      req.user = decoded;
  
      // Verificar se o usuário é do tipo 'usuario'
      if (decoded.tipo !== 'usuario' ) {
        return res.redirect('/login');
      }
  
      next();
    } catch (error) {
      return res.redirect('/login');
    }
  }

  function autenthicateTokenEstab(req, res, next){
    const token = req.cookies.token;
    //console.log(token);

    if (!token) {
      return res.redirect('/login');
    }

    try {
      const decoded = jwt.verify(token, chaveEstab);
      req.user = decoded;
      next();
    } catch (error) {
      return res.redirect('/login');
    }
  }


app.get('/', async (req, res) => {
    //console.log(res.json);
    try {
        const result = await pool.query('select * from estabelecimentos');
        const dadosObtidos = result.rows;
        //console.log(dadosObtidos[0].titulo_card);
        //console.log(dadosObtidos.length);
        res.render('home', {titleTag: 'Home', estabelecimento: dadosObtidos});
    } catch (error) {
        console.error('Erro ao buscar dados: ', error);
        res.sendStatus(500).send('Erro interno');
    }
});

app.get('/sobre', function(req, res){
    res.render('sobre', {titleTag: 'Sobre'});
});

app.get('/sobre/planos', function(req, res){
    res.render('planos', {titleTag: 'Planos'});
});

app.get('/estabelecimentos/x', function(req,res){
    res.render('estabelecimentos', {titleTag: 'Estabelecimentos'});
});

app.get('/estabelecimentos/:nome_estabelecimento', async (req,res) => {
  const nome = req.params.nome_estabelecimento;
  try {
      const result = await pool.query(`select * from estabelecimentos where estabelecimento_nome = '${nome}'`);
      const dadosObtidos = result.rows;
      const titleTag = dadosObtidos[0].estabelecimento_nome;
      //console.log(titleTag);
      //console.log(dadosObtidos);
      res.render('usuarios-comuns/render-estabelecimentos.ejs', {titleTag: titleTag, estabelecimento: dadosObtidos});
  } catch (error) {
      console.error('Erro ao buscar dados: ', error);
      res.sendStatus(500).send('Erro Interno');
  }
  //res.render('estabelecimentos', {titleTag: 'Estabelecimentos'});
});

app.get('/estabelecimentos/:nome_estabelecimento/horarios', async (req,res) => {
  const nome = req.params.nome_estabelecimento;

  try {
    const result = await pool.query(`select horario_funcionamento, horario_disponibilidade from horarios inner join estabelecimentos
    on horarios.estabelecimento_id = estabelecimentos.estabelecimento_id where estabelecimento_nome = '${nome}'`);
    const dadosObtidos = result.rows;
    var dadosSorted = dadosObtidos.sort();
    //console.log(dadosObtidos);
    console.log(dadosObtidos.length);
    var horarios = [];
    //console.log(dadosSorted);
    for (let i = 0; i < dadosObtidos.length; i++){
      let combo = []
      combo.push(dadosObtidos[i].horario_funcionamento);
      combo.push(dadosObtidos[i].horario_disponibilidade);
      horarios.push(combo);
    }

    horarios = horarios.sort();
    


    console.log(horarios);
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    res.render('usuarios-comuns/horarios', {titleTag: 'Horários', dias: dias, horarios: horarios, nome: nome}); 
  } catch (error) {
    console.error('Erro ao buscar dados: ', error);
    res.sendStatus(500).send('Erro Interno');
  }
  //Os horários de cada local são definidos pelo estabelecimento, sendo assim, armazenaremos no banco de dados;
});

app.get('/estabelecimentos/:nome_estabelecimento/alugar', (req, res) => {
  const nome_estabelecimento = req.params.nome_estabelecimento;
  const error = null;
  const success = null; 

  res.render('alugar', { nome_estabelecimento, error, success });
});


app.post('/estabelecimentos/:nome_estabelecimento/alugar', async (req, res) => {
  const nome = req.params.nome_estabelecimento;
  const { usuario_id, hora_selecionada, dia_selecionado } = req.body;

  try {
    // Verificar se o estabelecimento existe
    const estabelecimentoResult = await pool.query(`SELECT * FROM estabelecimentos WHERE estabelecimento_nome = '${nome}'`);
    const estabelecimento = estabelecimentoResult.rows[0];
    
    if (!estabelecimento) {
      return res.status(404).send('Estabelecimento não encontrado');
    }
    
    // Verificar disponibilidade do horário
    const horarioResult = await pool.query(`
      SELECT * FROM horarios
      WHERE estabelecimento_id = ${estabelecimento.estabelecimento_id}
        AND horario_funcionamento = '${hora_selecionada}'
        AND horario_disponibilidade = '${dia_selecionado}'
        AND status = true
    `);
    
    if (horarioResult.rows.length === 0) {
      return res.status(400).send('Horário indisponível');
    }
    
    // Registrar a locação
    const locacaoResult = await pool.query(`
      INSERT INTO locacoes (usuario_id, estabelecimento_id, hora_selecionada, dia_selecionado)
      VALUES (${usuario_id}, ${estabelecimento.estabelecimento_id}, '${hora_selecionada}', '${dia_selecionado}')
      RETURNING *
    `);
    
    const locacao = locacaoResult.rows[0];
    
    // Redirecionar para a página de confirmação
    res.redirect('/locacao-confirmada');
  } catch (error) {
    console.error('Erro ao processar a solicitação: ', error);
    res.sendStatus(500).send('Erro Interno');
  }
});



//gets-logins
//login padrão
app.get('/login', function(req, res){
    res.render('login/inicial', {titleTag: 'Login'});
});

//login de usuário comum
app.get('/login-locatarios', async(req, res) => {
    const erro = '';
    res.render('login/login-usuarios', {titleTag: 'Login', erro: erro, sucesso: ''});
});

//redefinir senha usuário comum
app.get('/locatarios/redefinir-senha', async(req, res) => {
  res.render('login/redefinir-senha-usuarios', {titleTag: 'Redefinir Senha', erro: 'E-mail', sucesso: ''});
})

app.post('/redefinir-senha-usuarios', async(req, res) => {
  const email = req.body.email;
  const senha = req.body.senha;
  const confirmarSenha = req.body.confirmarSenha;
  //console.log(email, senha, confirmarSenha);

  if (!email){
    return res.render('login/redefinir-senha-usuarios', {titleTag: 'Redefinir Senha', erro: 'E-mail', sucesso: ''});
  }
  
  if (!senha){
    return res.render('login/redefinir-senha-usuarios', {titleTag: 'Redefinir Senha', erro: 'Senha', sucesso: ''});
  }

  if (!confirmarSenha) {
    return res.render('login/redefinir-senha-usuarios', {titleTag: 'Redefinir Senha', erro: 'Confirmar Senha', sucesso: ''});
  }

  if (senha != confirmarSenha){
    return res.render('login/redefinir-senha-usuarios', {titleTag: 'Redefinir Senha', erro: 'Diferentes', sucesso: ''});
  }

  const hashSenha = await bcrypt.hash(senha, 10);

  try{
    const result = await pool.query(`select * from usuarios where usuario_email = '${email}'`);
    const dadosObtidos = result.rows;
    const dados = JSON.stringify(dadosObtidos);
    
    if (dados == '[]'){
      return res.render('login/redefinir-senha-usuarios', {titleTag: 'Redefinir Senha', erro: 'Não Encontrado'});
    } else {
      const insertQuery = await pool.query(`update usuarios set usuario_senha = '${hashSenha}' where usuario_email = '${email}'`);
      return res.render('login/login-usuarios', {titleTag: 'Redefinir Senha', erro: '', sucesso: 'Atualizado'})
    }


  } catch (error) {
    console.error('Erro ao buscar dados: ', error);
    res.sendStatus(500).send('Erro Interno');
  }
})

//redefinir senha estabelecimentos
app.get('/redefinir-senha/estabelecimentos', function(req, res){
  res.render('login/redefinir-senha-estabelecimentos', {titleTag: 'Redefinir Senha', erro: ''});
});

app.post('/redefinir-senha-estabelecimentos', async(req, res) => {
  const email = req.body.email;
  const senha = req.body.senha;
  const confirmarSenha = req.body.confirmarSenha;

  //console.log(email, senha, confirmarSenha);
  if (!email){
    return res.render('login/redefinir-senha-estabelecimentos', {titleTag: 'Redefinir Senha', erro: 'E-mail'});
  }

  if (!senha){
    return res.render('login/redefinir-senha-estabelecimentos', {titleTag: 'Redefinir Senha', erro: 'Senha'});
  }

  if (!confirmarSenha){
    return res.render('login/redefinir-senha-estabelecimentos', {titleTag: 'Redefinir Senha', erro: 'Confirmar Senha'});
  }

  if (senha != confirmarSenha){
    return res.render('login/redefinir-senha-estabelecimentos', {titleTag: 'Redefinir Senha', erro: 'Diferentes'});
  }

  const hashSenha = await bcrypt.hash(senha, 10);

  try{
    const result = await pool.query(`select * from estabelecimentos where estabelecimento_email = '${email}'`);
    const dadosObtidos = result.rows;
    const dados = JSON.stringify(dadosObtidos);

    //console.log(dadosObtidos);
    //console.log(dados);
    
    if (dados == '[]'){
      return res.render('login/redefinir-senha-estabelecimentos', {titleTag: 'Redefinir Senha', erro: 'Não Encontrado'});
    } else {
      const insertQuery = await pool.query(`update estabelecimentos set estabelecimento_senha = '${hashSenha}' where estabelecimento_email = '${email}'`);
      return res.render('login/login-estabelecimentos', {titleTag: 'Redefinir Senha', erro: '', sucesso: 'Atualizado'})
    }

  } catch(error){
    console.error('Erro ao buscar dados: ', error);
    res.sendStatus(500).send('Erro Interno');
  }

});

//login de estabelecimentos
app.get('/login-estabelecimentos', async(req, res) => {
    res.render('login/login-estabelecimentos', {titleTag: 'Estabelecimentos', erro: '', sucesso: ''});

});

app.get('/perfil', authenticateToken, function(req, res){
    console.log(req.id + 'chamou a rota');
    res.render('perfil', {titleTag: 'Perfil'});
});

app.get('/cadastrar-usuario', function(req, res){
    res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: '', sucesso: ''});
});

app.get('/cadastrar-estabelecimento', function(req, res){
    res.render('estabelecimentos/cadastro-estabelecimentos.ejs', {titleTag: 'Cadastrar Estabelecimento', erro: '', sucesso: ''});
})

app.get('/redefinir-senha', function(req, res){
    res.render('redefinir-senha', {titleTag: 'Redefinir Senha'});
})

app.get('/x/gerenciar', authenticateToken, function(req, res){
  console.log(req.id + ' chamou a rota');
  const user = req.user; // Obtém o objeto de usuário do token
  res.render('alterar-perfil', {titleTag: 'Alterar Perfil', user: user });
})

app.get('/x/locacoes', authenticateToken, function(req, res){
    res.render('locacoes', {titleTag: 'Histórico de Locações'});
})

app.get('/alterar-dados', authenticateToken, function(req, res){
  const user = req.user;
  res.render('alterar-dados', { titleTag: 'Alterar Dados', user: user });
});

// Posts
app.post('/alterar-dados', authenticateToken, function(req, res){
  const user = req.user;
  const { nome, email } = req.body;
  
  const updateQuery = "UPDATE usuarios SET usuario_nome = $1, usuario_email = $2 WHERE usuario_id = $3";
  const values = [nome, email, user.usuario_id];

  pool.query(updateQuery, values, (err, result) => {
    if (err) {
      console.error(err);
      res.redirect('/perfil');
    } else {
      res.redirect('/perfil');
    }
  });
});


app.post('/logout', function(req, res) {
  // Limpar o cookie de token
  res.clearCookie('token');
  
  res.redirect('/');
});

app.post('/login-locatarios', async (req, res) => {
    const email = req.body.nome;
    const senha = req.body.senha;

    if(!email){
        const erro = 'Usuário';
        return res.render('login/login-usuarios', {titleTag: 'Login', erro: erro, sucesso: ''});
        //return res.status(400).json({ message: 'Campo "Usuário" não preenchido' });
    }

    if(!senha){
      const erro = 'Senha';
        return res.render('login/login-usuarios', {titleTag: 'Login', erro: erro, sucesso: ''});
    }
    

    try {
      const result = await pool.query(`SELECT * FROM usuarios WHERE usuario_email = '${email}'`);
      const user = result.rows[0];

      if (user === undefined){
        const erro = 'Cadastro'
        return res.render('login/login-usuarios', {titleTag: 'Login', erro: erro, sucesso: ''});
      }


      //console.log(user);

      //if (user.length < 1){}
  
      // Comparar a senha fornecida com a senha armazenada no banco de dados
      const compararSenha = await bcrypt.compare(senha, user.usuario_senha);

      if (compararSenha === false) {
        const erro = 'Inválida';
        return res.render('login/login-usuarios', {titleTag: 'Login', erro: erro, sucesso: ''});
      }
  
      const token = jwt.sign({ id: user.usuario_id, tipo: 'usuario' }, chave, {expiresIn: 1800});
      const infos = [user.usuario_id, user.usuario_nome];
      res.cookie('infos', infos, { maxAge: 1800000, httpOnly: true});
      res.cookie('token', token, { maxAge: 1800000, httpOnly: true});
      //res.json({auth: true, token });
      //console.log(token);
      res.redirect('/');
    } catch (error) {
      console.error('Erro de autenticação', error);
      res.sendStatus(500);
    }
  });
  
  

//gets de estabelecimentos

app.post('/login-estabelecimentos', async (req, res) => {
  const email = req.body.nome;
  const senha = req.body.senha;

  if(!email){
    const erro = 'Usuário';
    return res.render('login/login-estabelecimentos', {titleTag: 'Estabelecimentos', erro: erro, sucesso: ''});
    //return res.status(400).json({ message: 'Campo "Usuário" não preenchido' });
  }

  if(!senha){
    const erro = 'Senha';
    return res.render('login/login-estabelecimentos', {titleTag: 'Estabelecimentos', erro: erro, sucesso: ''});
  }

  try {
    const result = await pool.query(`SELECT * FROM estabelecimentos WHERE estabelecimento_email = '${email}'`);
    const estabelecimento = result.rows[0];
    //console.log(estabelecimento);
    

    if (estabelecimento === undefined || estabelecimento.length == 0){
      const erro = 'Cadastro';
      return res.render('login/login-estabelecimentos', {titleTag: 'Estabelecimentos', erro: erro, sucesso: ''});
    }

    const estabelecimentoNome = estabelecimento.estabelecimento_nome;

    const compararSenha = await bcrypt.compare(senha, estabelecimento.estabelecimento_senha);

    if (compararSenha === false) {
      const erro = 'Inválida';
      return res.render('login/login-estabelecimentos', {titleTag: 'Estabelecimentos', erro: erro, sucesso: ''});
    }

    const token = jwt.sign({id: estabelecimento.estabelecimento_id, tipo: 'estabelecimento'}, chaveEstab, {expiresIn: 1800});
    const infos = [estabelecimento.estabelecimento_id, estabelecimento.estabelecimento_nome,
      estabelecimento.estabelecimento_descricao_card];
    res.cookie('infos', infos, { maxAge: 1800000, httpOnly: true});
    res.cookie('token', token, { maxAge: 1800000, httpOnly: true});

      
    res.redirect(`/estabelecimento/${estabelecimentoNome}`);

  } catch (error) {
    console.error('Erro ao autentificar estabelecimento', error);
    res.sendStatus(500);
  }
});

//tela inicial dos estabelecimentos
app.get('/estabelecimento/:nome', autenthicateTokenEstab, async (req, res) => {
    const nome = req.params.nome;
    
    try {
      const result = await pool.query(`select * from estabelecimentos where estabelecimento_nome = '${nome}'`);
      const dadosObtidos = result.rows;
      const titleTag = dadosObtidos[0].estabelecimento_nome;
      //console.log(titleTag);
      console.log(dadosObtidos);
      res.render('estabelecimentos/home', {titleTag: titleTag, estabelecimento: dadosObtidos, aviso: ''});
    } catch (error) {
        console.error('Erron ao buscar dados: ', error);
        res.sendStatus(500).send('Erro Interno');
    }

    //trocar o local para pegar o usuário pelo parâmetro
    //res.render('/', {titleTag: 'Home'});
})

//posts
app.post('/cadastrar-usuario', async (req, res) => {
    const nome = req.body.nome;
    const email = req.body.email;
    const senha = req.body.senha;
    const confirmarSenha = req.body.confirmarSenha;

    //console.log(nome, email, senha, confirmarSenha)
    
    // Verificar se todos os campos foram preenchidos
    if (!nome) {
      const erro = 'Nome';
      return res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: erro, sucesso: ''});
    }

    if (!email) {
      const erro = 'E-mail';
      return res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: erro, sucesso: ''});
    }

    if (!senha) {
      const erro = "Senha";
      return res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: erro, sucesso: ''});
    }
    if (!confirmarSenha) {
      const erro = 'Confirmar Senha';
      return res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: erro, sucesso: ''});
    }
    // Verificar se a senha e a confirmação de senha são iguais
    if (senha !== confirmarSenha) {
      const erro = 'Não confere';
      return res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: erro, sucesso: ''});
    }
  
    const hashSenha = await bcrypt.hash(senha, 10);

    // Verificar se o usuário já está cadastrado (exemplo com consulta no banco de dados)
    const query = `SELECT * FROM usuarios WHERE usuario_email = '${email}'`;
  
    pool.query(query, (error, result) => {
      if (error) {
        console.error('Erro ao verificar usuário no banco de dados:', error);
        return res.status(500).json({ message: 'Erro interno' });
      }
  
      if (result.rows.length > 0) {
        const erro = 'Já Cadastrado';
        return res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário', erro: erro, aviso: ''});
        //return res.status(400).json({ message: 'Usuário já cadastrado' });
      }
  
      // Cadastrar o usuário (exemplo com inserção no banco de dados)
      const insertQuery = `INSERT INTO usuarios (usuario_nome, usuario_email, usuario_senha) VALUES ('${nome}', '${email}', '${hashSenha}')`;
      //const insertValues = [nome, email, senha];
  
      pool.query(insertQuery, (insertError, insertResult) => {
        if (insertError) {
          console.error('Erro ao cadastrar usuário no banco de dados:', insertError);
          return res.status(500).json({ message: 'Erro interno' });
        }

        //CRIAR UM MODELO QUE POSSA ENVIAR A MENSAGEM DE CADASTRO ENVIADO COM SUCESSO E A TELA DE LOGIN (FEITO)
        return res.render('login/login-usuarios', {titleTag: 'Login', erro: '', sucesso: 'Enviado'});
      });
    });
  });
  
  app.post('/cadastrar-estabelecimento', async (req, res) => {
    const nome = req.body.nome;
    const email = req.body.email;
    const senha = req.body.senha;
    const confirmarSenha = req.body.confirmarSenha;



    //console.log(nome, email, senha, confirmarSenha)
    
    // Verificar se todos os campos foram preenchidos
    if (!nome) {
      return res.render('estabelecimentos/cadastro-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: 'Nome', sucesso: ''});
    }

    if (!email) {
      return res.render('estabelecimentos/cadastro-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: 'E-mail', sucesso: ''});
    }

    if (!senha) {
      return res.render('estabelecimentos/cadastro-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: 'Senha', sucesso: ''});
    }
    if (!confirmarSenha) {
      return res.render('estabelecimentos/cadastro-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: 'Confirmar Senha', sucesso: ''});
    }
    // Verificar se a senha e a confirmação de senha são iguais
    if (senha !== confirmarSenha) {
      return res.render('estabelecimentos/cadastro-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: 'Não Confere', sucesso: ''});
    }
  
    const hashSenha = await bcrypt.hash(senha, 10);

    // Verificar se o estabelecimento já está cadastrado
    const query = `SELECT * FROM estabelecimentos WHERE estabelecimento_email = '${email}'`;

    pool.query(query, (error, result) => {
      if (error) {
        console.error('Erro ao verificar estabelecimento no banco de dados:', error);
        return res.status(500).json({ message: 'Erro interno' });
      }

      if (result.rows.length > 0) {
        return res.render('estabelecimentos/cadastro-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: 'Já Cadastrado', sucesso: ''});
      }

      const insertQuery = `INSERT INTO estabelecimentos (estabelecimento_nome, estabelecimento_email, estabelecimento_senha, tipo_usuario) VALUES ('${nome}', '${email}', '${hashSenha}', 'estabelecimentos')`;
      //const insertValues = [nome, email, senha, 'estabelecimentos'];
  
      pool.query(insertQuery, (insertError, insertResult) => {
        if (insertError) {
          console.error('Erro ao cadastrar usuário no banco de dados:', insertError);
          return res.status(500).json({ message: 'Erro interno' });
        }

        res.render('login/login-estabelecimentos', {titleTag: 'Cadastrar Estabelecimento', erro: '', sucesso: 'Enviado'});
      });
    });
  });

app.post('/', function(req, res){
    //aqui, devemos pegar os dados passados pelo login e buscar no banco de dados para ver se o usuário e a senha estão certos
    //se tiver tudo certo: redireciona para a tela home, se não, exibe uma mensagem de erro e permanece na tela de login
    res.redirect('/');
})

//PATCHES
app.patch('/estabelecimentocard', (req, res) => {
  const dadosAtualizados = req.body;
  const token = req.cookies.token;
  const infos = req.cookies.infos;
  console.log(dadosAtualizados);
  //console.log(token);
  console.log('Essas são as informações: ',  infos);
  
  var query = '';

  if (dadosAtualizados.novoEmail != '' && dadosAtualizados.descricaoCard != ''){
    query = `update estabelecimentos set estabelecimento_email = ${dadosAtualizados.novoEmail},
      estabelecimento_descricao_card = ${dadosAtualizados.descricaoCard} where estabelecimento_id = ${infos[0]}`;
  } else {
    if (dadosAtualizados.novoEmail != '' && dadosAtualizados.descricaoCard == ''){
      query = `update estabelecimentos set estabelecimento_email = ${dadosAtualizados.novoEmail}
      where estabelecimento_id = ${infos[0]}`;
    } else {
      if (dadosAtualizados.novoEmail == '' && dadosAtualizados.descricaoCard != ''){
        query = `update estabelecimentos set estabelecimento_descricao_card = ${dadosAtualizados.descricaoCard}
        where estabelecimento_id = ${infos[0]}`;
      }
    }
  }

  console.log('Essa é a query: ', query);

  //SE A QUERY ESTIVER VAZIA, APENAS LANÇA UM ALERT
  //Se não, faz a alteração e informa ao usuário com o Alert 

  /*try{
    

    
  }
  catch(error){
    console.error('Erron ao buscar dados: ', error);
    res.sendStatus(500).send('Erro Interno');
  }*/
});

app.post('/local', function(req, res){
    //aqui devemos pegar as informações de login e buscar no banco de dados
    res.redirect('/local');
})

app.listen(3000, function(req, res){
    console.log('Server running on 3000');
})

