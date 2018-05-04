const express = require('express');
const app = express();
const fs = require('fs');
const fse = require('fs-extra');
const Duplex = require('stream').Duplex;

const path = require('path');
const gm = require('gm');
const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));  //body-parser 解析json格式数据
app.use(bodyParser.urlencoded({            //此项必须在 bodyParser.json 下面,为参数编码
  limit: '50mb',
  extended: true
}));


const CONFIG = {
  TIMEOUTDELETE: 60 * 1000,
  TEMPDIRNAME: 'temp',
  projectPath: '/minicrop',
  PORT: 3001
}

// 每次启动都清空临时文件夹
fse.emptyDir(CONFIG.TEMPDIRNAME, err => {
  if (err) return console.error(err)
  console.log('emptyDir ' + CONFIG.TEMPDIRNAME + ' success!')
})

// 模板
const htmlString = fs.readFileSync('index.html', "utf8");
app.get(CONFIG.projectPath, (req, res) => {
  console.log('/htmlString')
  res.send(htmlString);
});

// 根据名字下载服务器上的临时图片
app.get(CONFIG.projectPath + '/downloadByName', (req, res) => {
  console.log('/downloadByName');
  const tempName = req.query.tempName;
  const fileName = encodeURI(req.query.fileName);
  const filePath = path.join(__dirname + '/' + CONFIG.TEMPDIRNAME + '/', tempName);
  fs.stat(filePath, function (err, stats) {
    if (err) {
      res.json({ code: 0, msg: '文件已经过期，不能下载（服务器只会保存数分钟的时间）' });
      return console.error(err);
    }
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename=' + fileName,
      'Content-Length': stats.size
    });
  });
  fs.createReadStream(filePath).pipe(res);
});

// 把base64 转换成图片后，裁剪/压缩，保存的临时目录，定时清理
app.post(CONFIG.projectPath + '/base64ToFile', (req, res) => {
  console.log('/base64ToFile');
  const _base64 = req.body.data.base64;
  const base64 = _base64.replace(/^data:image\/\w+;base64,/, '');
  const sx = Math.round(req.body.data.sx);
  const sy = Math.round(req.body.data.sy);
  const sw = Math.round(req.body.data.sw);
  const sh = Math.round(req.body.data.sh);
  const w = Math.round(req.body.data.w);
  const h = Math.round(req.body.data.h);
  const inputBuffer = Buffer.from(base64, 'base64');
  const tempName = new Date().getTime();
  const tempPath = CONFIG.TEMPDIRNAME + '/' + tempName;

  gm(inputBuffer)
    .crop(sw, sh, sx, sy)
    .resize(w, h)
    .write(tempPath, function (err) {
      if (err) {
        console.log(err);
        res.json({ code: 0, msg: err });
        return;
      }
      console.log('successfully save temp file ' + tempPath);
      res.json({ code: 1, msg: 'ok', tempName: tempName });
      setTimeout(() => {
        fs.stat(tempPath, function (err, stats) {
          if (err) {
            return console.error(err);
          }
          fs.unlink(tempPath, (err) => {
            if (err) throw err;
            console.log('successfully deleted ' + tempPath);
          });
        });
      }, CONFIG.TIMEOUTDELETE);
    });
});

app.listen(CONFIG.PORT, function () {
  console.log('app listening on port ' + CONFIG.PORT);
});


// http://blog.csdn.net/liyijun4114/article/details/51743068
// https://itbilu.com/nodejs/core/Nkvh9yS4W.html
