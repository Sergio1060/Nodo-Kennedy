const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.argv[2] || 5173;

const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.csv':'text/csv','.json':'application/json'};

http.createServer((req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/index.html';
  const full = path.join(root, file);
  if (!full.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(full);
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(port, () => console.log('dev server on http://localhost:' + port));
