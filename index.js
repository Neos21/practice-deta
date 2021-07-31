const { Deta } = require('deta');
const express = require('express');
const serveFavicon = require('serve-favicon');

require('dotenv').config();


// Setup
// ====================================================================================================

const app = express();

// For POST JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Project Key を指定して初期化する
const deta = Deta(process.env.DETA_PROJECT_KEY);
// Deta Base に接続 (初回は新規 DB 作成) する
const db = deta.Base('posts');

// 投稿は全 100 件保持する
const postLimit = 100;
// 投稿1件のテキストは 200 文字を上限とする (`length` でチェックするのでガバ)
const textLimit = 200;

const log      = (...messages) => console.log  (new Date().toISOString(), ...messages);
const logError = (...messages) => console.error(new Date().toISOString(), ...messages);


// Web Page
// ====================================================================================================

['/', '/index.html'].forEach(path => {
  app.get(path, (_req, res) => {
    log(`[GET ] [${path}]`);
    res.sendFile(`${__dirname}/index.html`);
  });
});

app.use(serveFavicon(`${__dirname}/favicon.ico`));


// API
// ====================================================================================================

app.get('/posts', async (_req, res) => {
  const logPrefix = '[GET ] [/posts]';
  log(logPrefix);
  try {
    const query   = { type: 'post' };
    const options = { limit: postLimit };
    const result  = await db.fetch(query, options);  // `type` プロパティが `post` である Item を全件取得する
    const posts = result.items.sort((a, b) => (a.id < b.id) ? 1 : (a.id > b.id) ? -1 : 0);  // ID の降順
    log(`${logPrefix} : Count [${result.count}]`);
    res.status(200).json({ posts: posts });
  }
  catch(error) {
    logError(`${logPrefix} : Error : `, error);
    res.status(500).json({ errorMessage: 'Failed To Get Posts' });
  }
});

app.put('/posts', async (req, res) => {
  const logPrefix = '[PUT ] [/posts]';
  log(logPrefix);
  try {
    // 投稿テキストの入力チェック
    const text = req.body.text;
    if(isInvalidText(text)) return res.status(400).json({ errorMessage: 'Invalid Text' });
    
    // シーケンス値を取得・更新して投稿する
    const currentSeq = await getSeq();
    const newSeq = currentSeq + 1;
    const posted = await db.put({
      type: 'post',
      id  : newSeq,
      text: text
        .replace((/&/g), '&amp;').replace((/</g), '&lt;').replace((/>/g), '&gt;').replace((/"/g), '&quot;').replace((/'/g), '&#039;')  // Escape
        .replace((/\t|\r|\n/g), ' ').replace((/\s\s+/g), ' ')  // Spaces
    });  // キーは未指定
    log(`${logPrefix} : Posted`);
    
    // シーケンスを更新する
    const updatedSeq = await db.put({ type: 'seq', seq: newSeq }, 'seq');
    log(`${logPrefix} : Seq updated [${updatedSeq.seq}]`);
    
    // 古い投稿を削除する・基本的に古い投稿は1件だけヒットしココで削除される想定
    const targetSeq = newSeq - postLimit;  // この ID 以下の投稿を削除する
    const query = {
      type    : 'post',
      'id?lte': targetSeq
    };
    const result = await db.fetch(query);
    if(result.count) {
      log(`${logPrefix} : Items to be deleted [${result.count}]`);
      for(let targetPost of result.items) await db.delete(targetPost.key);
      log(`${logPrefix} : Items removed. Finished`);
    }
    else {
      log(`${logPrefix} : No items to be deleted. Finished`);
    }
    
    res.status(200).json({ post: posted });
  }
  catch(error) {
    logError(`${logPrefix} : Error : `, error);
    res.status(500).json({ errorMessage: 'Failed To Put Post' });
  }
  
  /** 投稿テキストの入力チェック・エラーがあれば `true` */
  function isInvalidText(text) {
    if(text == null) {
      log(`${logPrefix} : Invalid Text : Text is null`);
      return true;
    }
    if(!text.trim()) {
      log(`${logPrefix} : Invalid Text : Text is empty`);
      return true;
    }
    if(text.length > textLimit) {
      log(`${logPrefix} : Invalid Text : Too long text`);
      return true;
    }
    return false;
  }
  
  /** シーケンス値を取得する・シーケンス管理用のレコードがなければ作る */
  async function getSeq() {
    try {
      let seq = await db.get('seq');
      if(seq == null) {
        log(`${logPrefix} : Get Seq : It has not been created. Creating...`);
        seq = await db.insert({ type: 'seq', seq: 0 }, 'seq');
      }
      log(`${logPrefix} : Get Seq : Seq [${seq.seq}]`);
      return seq.seq;
    }
    catch(error) {
      logError(`${logPrefix} : Get Seq : Error : `, error);
      throw error;
    }
  }
});


// Default Middlewares
// ====================================================================================================

app.use((req, res, _next) => {
  log(`[404 ] [${req.method}] [${req.url}]`);
  res.status(404).send('[404] Not Found');
});

app.use((error, req, res, _next) => {
  logError(`[500 ] [${req.method}] [${req.url}] : Error [${error.toString()}] Stack :\n${error.stack}`);
  res.status(500).send('[500] Internal Server Error');
});


// Exports : Deta Micros では `app.listen()` しない : https://docs.deta.sh/docs/micros/deploy
// ====================================================================================================

module.exports = app;
