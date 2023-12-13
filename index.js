"use strict"

const fs = require('fs');
const os = require('os');
const path = require('path');

const settings_path = path.join(os.homedir(),'.pingleware-loadbalancer');
const settings_fullpathname = path.join(settings_path,'settings.json');

let noproxy = false;
let config = null;
let proxyServers = null;

// If settings path does not exist, then create the settings path
if (!fs.existsSync(settings_path)) {
  fs.mkdirSync(settings_path);
}
// If settings.json exists under the settings path, then load settings.json into config variable
if (fs.existsSync(settings_fullpathname)) {
  config = JSON.parse(fs.readFileSync(settings_fullpathname));
} else {
  noproxy = true;
}

const http = require('http');
const httpProxy = require('http-proxy');
const qs = require('querystring');

function startProxyServers(addresses) {
  console.log(addresses);
  //Create a set of proxy servers
  proxyServers = addresses.map(function (target) {
    return new httpProxy.createProxyServer({
      target: target
    });
  });  
}

// if proxy is temporality turned off, then do not create proxy server
if (!noproxy && config != null) {
  const addresses = config.servers;
  startProxyServers(addresses);
}

// create the normal HTTP server
var server = http.createServer(function (req, res) {
  if (req.method === 'GET') { 
    if (req.url === '/about') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      const _package = require('./package.json');
      res.end(JSON.stringify({name: _package.name, description: _package.description, version: _package.version, author: _package.author, homepage: _package.homepage}));
    } else if (req.url === '/edit') {
      let contents = JSON.stringify(config);
      if (config == null) {
        contents = "";
      }
      noproxy = true;
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(`<DOCTYPE html>
      <html lang="en">
        <head>
          <title>Editing SETTINGS.JSON</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
        </head>
        <body>
          <div class="w3-container">
            <form method="post" action="/edit">
              <h2 class="w3-green">Editing SETTINGS.JSON</h2>
              <label for="pathname">Full Path Name</label>
              <input type="text" id="pathname" class="w3-input w3-block w3-light-grey" value="${settings_fullpathname}" readonly />
              <label for="contents">Contents</label>
              <textarea id="contents" name="contents" class="w3-input w3-block" rows="5" placeholder='{"host":"localhost","port":8080,"servers":[{"host":"","port":0}]}'>${contents}</textarea>
              <br/>
              <input type="submit" name="save" class="w3-button w3-block w3-black" value="Save" />
              <br/>
              <a href="#" onclick="window.close()" class="w3-button w3-block w3-orange">Cancel</a> 
            </form>
            </br>
          </div>
        </body>
      </html>`);
    } else if (req.url === '/servers') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      if (config !== null) {
        res.end(JSON.stringify(config.servers));
      } else {
        res.end(JSON.stringify(`Missing ${settings_fullpathname}`));
      }
    } else {
      // by default handle proxy
      if (!noproxy) {
        var proxy = proxyServers.shift();
        proxy.web(req, res);
        proxyServers.push(proxy);   
      } 
    }    
  } else if (req.method === 'POST') {
    if (req.url === '/edit') {
      let requestBody = '';
      
      // Read the data from the request
      req.on('data', (data) => {
        requestBody += data;
      });

      // Process the data when the request ends
      req.on('end', () => {
        try {
          const postData = qs.parse(requestBody);

          // You can save or process the postData here
          console.log('Received data:', postData);

          fs.writeFileSync(settings_fullpathname,postData['contents']);
  
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end(`Data received and saved to ${settings_fullpathname}!\n`);
          config = JSON.parse(fs.readFileSync(settings_fullpathname));
          console.log(config);
          noproxy = false;
          restartServer(config);  
        } catch(error) {
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end(`${error.message}\n`);
        }
      });
    }      
  }
});

if (config !== null) {
  startServer(config.host,config.port);
} else {
  startServer("localhost",8080);
}

function startServer(host,port) {
  server.listen(port,host,function(){
    console.log(`@pingleware-load-balancer listening on http://${host}:${port}`);
  });    
}
  

function restartServer(_config) {
  console.log('Stopping server...');
  server.close(() => {
    console.log('Restarting server...');
    const addresses = _config.servers;
    startProxyServers(addresses);
    startServer(_config.host,_config.port);
  });
}