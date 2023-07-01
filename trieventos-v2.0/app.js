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

const app = express();

app.set('view engine', 'ejs');


app.use(express.json());
//para servir arquivos estáticos ao CSS
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

const pool = new Pool(
    {
        user: '',
        password: '',
        host: 'localhost',
        port: 5432,
        database: ''
    }
);


function generateToken(user) {
  const token = jwt.sign({ id: user.id, tipo: user.tipo }, chave, { expiresIn: '1h' });
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
  
function authenticateTokenEstabelecimentos(req, res, next) {
    const token = req.cookies.token;
  
    if (!token) {
      return res.redirect('/login-estabelecimentos');
    }
  
    try {
      const decoded = jwt.verify(token, chave);
      req.user = decoded;
  
      if (decoded.tipo_usuario !== 'estabelecimento') {
        return res.redirect('/login-estabelecimentos');
      }
  
      next();
    } catch (error) {
      return res.redirect('/login-estabelecimentos');
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
        const titleTag = dadosObtidos[0].titulo_card;
        //console.log(titleTag);
        //console.log(dadosObtidos);
        res.render('usuarios-comuns/render-estabelecimentos.ejs', {titleTag: titleTag, estabelecimento: dadosObtidos});
    } catch (error) {
        console.error('Erron ao buscar dados: ', error);
        res.sendStatus(500).send('Erro Interno');
    }
    //res.render('estabelecimentos', {titleTag: 'Estabelecimentos'});
});

app.get('/estabelecimentos/x/horarios', function(req,res){
    const horas = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00'];
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const ocupados = [{dia: 'Segunda', hora:'18:00'}, {dia: 'Sexta', hora: '22:00'},
                    {dia: 'Sábado', hora: '21:00'}, {dia: 'Sábado', hora: '20:00'}];
    res.render('horarios', { horas, diasSemana, titleTag: 'Horários', ocupados});
});

//gets-logins
//login padrão
app.get('/login', function(req, res){
    res.render('login/inicial', {titleTag: 'Login'});
});

//login de usuário comum
app.get('/login-locatorio', async(req, res) => {
    res.render('login/login-usuarios', {titleTag: 'Login'});
});

//login de estabelecimentos
app.get('/login-estabelecimentos', async(req, res) => {
    res.render('login/login-estabelecimentos', {titleTag: 'Estabelecimentos'})

});

app.get('/perfil', authenticateToken, function(req, res){
    console.log(req.id + 'chamou a rota');
    res.render('perfil', {titleTag: 'Perfil'});
});

app.get('/cadastrar-usuario', function(req, res){
    res.render('cadastro-usuario', {titleTag: 'Cadastrar Usuário'});
});

app.get('/cadastrar-estabelecimento', function(req, res){
    res.render('estabelecimentos/cadastro-estabelecimentos.ejs', {titleTag: 'Cadastrar Estabelecimento'});
})

app.get('/redefinir-senha', function(req, res){
    res.render('redefinir-senha', {titleTag: 'Redefinir Senha'});
})

app.get('/x/gerenciar', authenticateToken,  function(req, res){
    res.render('alterar-perfil', {titleTag: 'Alterar Perfil'});
})

app.get('/x/locacoes', authenticateToken, function(req, res){
    res.render('locacoes', {titleTag: 'Histórico de Locações'});
})

// Posts
app.post('/login-locatorio', async (req, res) => {
  const nome = req.body.nome;
  const senha = req.body.senha;

  if (!nome) {
    return res.status(400).json({ message: 'Campo "Usuário" não preenchido' });
  }

  if (!senha) {
    return res.status(400).json({ message: 'Campo "Senha" não preenchido' });
  }
  
  try {
    const result = await pool.query(`SELECT * FROM usuarios WHERE usuario_nome = '${nome}'`);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'Usuário não possui cadastro' });
    }

    const compararSenha = await bcrypt.compare(senha, user.usuario_senha);

    if (!compararSenha) {
      return res.status(401).json({ message: 'Credenciais Inválidas' });
    }

    const token = jwt.sign({ id: user.usuario_id, tipo: 'usuario' }, chave, { expiresIn: 1800 });

    res.cookie('token', token, { maxAge: 1800000, httpOnly: true });
    res.redirect('/perfil');
  } catch (error) {
    console.error('Erro de autenticação', error);
    res.sendStatus(500);
  }
});


//gets de estabelecimentos
app.post('/login-estabelecimentos', async (req, res) => {
  const { nome, senha } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM estabelecimentos WHERE estabelecimento_nome = $1`, [nome]);
    const estabelecimento = result.rows[0];

    if (!estabelecimento) {
      return res.status(401).json({ message: 'Credenciais Inválidas' });
    }

    const match = await bcrypt.compare(senha, estabelecimento.estabelecimento_senha);

    if (match) {
      const token = jwt.sign({ id: estabelecimento.estabelecimento_id, tipo_usuario: 'estabelecimento' }, chave, { expiresIn: '1h' });

      res.cookie('token', token, { maxAge: 3600000, httpOnly: true });
      res.redirect('/local');
    } else {
      return res.status(401).json({ message: 'Credenciais Inválidas' });
    }
  } catch (error) {
    console.error('Erro ao autenticar estabelecimento', error);
    res.sendStatus(500);
  }
});

app.get('/local', authenticateTokenEstabelecimentos, function(req, res) {
  res.render('estabelecimentos/home', { titleTag: 'Home' });
});


app.post('/logout', function(req, res) {
  // Limpar o cookie de token
  res.clearCookie('token');
  
  res.redirect('/');
});


//posts
app.post('/cadastrar-usuario', async (req, res) => {
    const nome = req.body.nome;
    const email = req.body.email;
    const senha = req.body.senha;
    const confirmarSenha = req.body.confirmarSenha;

    //console.log(nome, email, senha, confirmarSenha)
    
    // Verificar se todos os campos foram preenchidos
    if (!nome) {
      return res.status(400).json({ message: 'Campo "Nome de usuário" não preenchido' });
    }

    if (!email) {
        return res.status(400).json({ message: 'Campo "E-mail" não preenchido' });
    }

    if (!senha) {
        return res.status(400).json({ message: 'Campo "Senha" não preenchido' });
    }
    if (!confirmarSenha) {
        return res.status(400).json({ message: 'Campo "Confirmar Senha" não preenchido' });
    }
    // Verificar se a senha e a confirmação de senha são iguais
    if (senha !== confirmarSenha) {
      return res.status(400).json({ message: 'A senha e a confirmação de senha não correspondem' });
    }
  
    const hashSenha = await bcrypt.hash(senha, 10);

    // Verificar se o usuário já está cadastrado (exemplo com consulta no banco de dados)
    const query = `SELECT * FROM usuarios WHERE usuario_nome = '${nome}'`;
  
    pool.query(query, (error, result) => {
      if (error) {
        console.error('Erro ao verificar usuário no banco de dados:', error);
        return res.status(500).json({ message: 'Erro interno' });
      }
  
      if (result.rows.length > 0) {
        return res.status(400).json({ message: 'Usuário já cadastrado' });
      }
  
      // Cadastrar o usuário (exemplo com inserção no banco de dados)
      const insertQuery = `INSERT INTO usuarios (usuario_nome, usuario_email, usuario_senha) VALUES ('${nome}', '${email}', '${hashSenha}')`;
      //const insertValues = [nome, email, senha];
  
      pool.query(insertQuery, (insertError, insertResult) => {
        if (insertError) {
          console.error('Erro ao cadastrar usuário no banco de dados:', insertError);
          return res.status(500).json({ message: 'Erro interno' });
        }
  
        //res.status(200).json({ message: 'Usuário cadastrado com sucesso' });
        res.redirect('/login')
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
      return res.status(400).json({ message: 'Campo "Nome de usuário" não preenchido' });
    }

    if (!email) {
        return res.status(400).json({ message: 'Campo "E-mail" não preenchido' });
    }

    if (!senha) {
        return res.status(400).json({ message: 'Campo "Senha" não preenchido' });
    }
    if (!confirmarSenha) {
        return res.status(400).json({ message: 'Campo "Confirmar Senha" não preenchido' });
    }
    // Verificar se a senha e a confirmação de senha são iguais
    if (senha !== confirmarSenha) {
      return res.status(400).json({ message: 'A senha e a confirmação de senha não correspondem' });
    }
  
    const hashSenha = await bcrypt.hash(senha, 10);

    // Verificar se a senha e a confirmação de senha são iguais
    if (senha !== confirmarSenha) {
      return res.status(400).json({ message: 'A senha e a confirmação de senha não correspondem' });
    }

    // Verificar se o estabelecimento já está cadastrado
    const query = `SELECT * FROM estabelecimentos WHERE estabelecimento_nome = '${nome}'`;

    pool.query(query, (error, result) => {
      if (error) {
        console.error('Erro ao verificar estabelecimento no banco de dados:', error);
        return res.status(500).json({ message: 'Erro interno' });
      }

      if (result.rows.length > 0) {
        return res.status(400).json({ message: 'Estabelecimento já cadastrado' });
      }

      const insertQuery = `INSERT INTO estabelecimentos (estabelecimento_nome, estabelecimento_email, estabelecimento_senha, tipo_usuario) VALUES ('${nome}', '${email}', '${hashSenha}', 'estabelecimentos')`;
      //const insertValues = [nome, email, senha, 'estabelecimentos'];
  
      pool.query(insertQuery, (insertError, insertResult) => {
        if (insertError) {
          console.error('Erro ao cadastrar usuário no banco de dados:', insertError);
          return res.status(500).json({ message: 'Erro interno' });
        }

        res.redirect('/login-estabelecimentos');
      });
    });
  });

app.post('/', function(req, res){
    //aqui, devemos pegar os dados passados pelo login e buscar no banco de dados para ver se o usuário e a senha estão certos
    //se tiver tudo certo: redireciona para a tela home, se não, exibe uma mensagem de erro e permanece na tela de login
    res.redirect('/');
})

app.post('/local',  function(req, res){
    //aqui devemos pegar as informações de login e buscar no banco de dados
    res.redirect('/local');
})

app.listen(3000, function(req, res){
    console.log('Server running on 3000');
})

