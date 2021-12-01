"use strict"

var config = require ('config.json')('./settings.json');

var http = require('http');
var httpProxy = require('http-proxy');

var addresses = config.servers;

//Create a set of proxy servers
var proxyServers = addresses.map(function (target) {
    return new httpProxy.createProxyServer({
      target: target
    });
  });
  
  var server = http.createServer(function (req, res) {
    var proxy = proxyServers.shift();
  
    proxy.web(req, res);
  
    proxyServers.push(proxy);
  });
  
  server.listen(config.port);
