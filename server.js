/*
Public Access Me Server
Jonas Lund, 2012
 */
var url = require('url'),
    fs = require('fs'),
    fu = exports,
    util = require('util'),
    exec = require('child_process').exec,
    awss3url = "/path/to/aws-s3-bucket/",
    knox = require('knox'),
    users = 0,
    socketkey = "",
    express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(1338);

app.configure('production', function(){
  app.use(express.errorHandler());
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
});

//start server
server.listen(1337);

io.configure('production', function(){
  io.enable('browser client minification');
  io.enable('browser client etag');
  io.enable('browser client gzip');
  io.set('log level', 1);
  io.set('transports', [
      'websocket',
      'flashsocket',
      'htmlfile',
      'xhr-polling',
      'jsonp-polling'
  ]);
});

//AWS S3
var s3 = knox.createClient({
  key: 'aws-key',
  secret: 'aws-secret',
  bucket: 'aws-bucket'
});

//mysql
var mysql = require('mysql'),
    poolModule = require('generic-pool');

var pool = poolModule.Pool({
    name     : 'mysql',
    create   : function(callback) {
        var c = mysql.createConnection({
                  host: "",
                  user: "",
                  password: "",
                  database: ""
                });
        c.connect();
        callback(null, c);
    },
    destroy  : function(client) { client.end(); },
    max      : 10,
    idleTimeoutMillis : 30000,
    log : false
});


//Get User Count
app.get('/count/', function (req, res) {
  res.send("USER COUNT " + users + " AWESOME");
});

//Load First View From DB
app.get('/', function(req, res) {
  pool.acquire(function(err, connection) {
    connection.query('SELECT * FROM hashes WHERE type=1 ORDER BY date DESC LIMIT 1', function(err, info) {
      var hash = info[0].hash,
          type = info[0].type,
          url = info[0].url,
          title = info[0].title,
          favicon = info[0].favicon;

          res.render('index', {
            "src": currentHost+"/img/"+hash,
            "url": url,
            "title": title,
            "favicon": favicon
          });
    
      pool.release(connection);
    });
  });
});

//static files
app.use("/src/", express.static(__dirname + '/src/'));
app.use("/files/", express.static(__dirname + '/files/'));
app.use("/img/", express.static(__dirname + '/img/'));


//on connection
io.sockets.on('connection', function (socket) {
  users++;
  
  //get last added from DB
  pool.acquire(function(err, connection) {
    connection.query('SELECT * FROM hashes ORDER BY date DESC LIMIT 1', function(err, info) {
      var hash = info[0].hash,
          type = info[0].type,
          url = info[0].url,
          title = info[0].title,
          favicon = info[0].favicon;

      if(type === 1) {
        io.sockets.emit("pictua", {src: currentHost+"/img/"+hash, url: url, title: title, favicon: favicon});
      } else {
        io.sockets.emit('screenshot', {src: currentHost+"/src/"+hash, url: url});
      }
    
      //get frame size
      connection.query('SELECT * FROM settings ORDER BY date DESC LIMIT 1', function(err, info) {
        var height = info[0].height,
            width = info[0].width;

        io.sockets.emit("screenSize", {height: height, width: width});
        pool.release(connection);
      });
    });
  });

  //accept incoming html-screen from the chrome extension
  socket.on('screen', function (data) {
     var key = data.key;
     if(key === socketkey) {
              
      var url = data.url;
      var filename = GUID();
      var src = "src/" + filename + ".html";
      var buffer = new Buffer(data.data);
      var title = data.title;
      var favicon = data.favicon;

      var headers = {
        'Content-Type': 'text/html'
      };
      
       s3.putBuffer(buffer, '/src/' + filename + ".html", headers, function(err, res){
          if(err) {
            console.log(err);
          } else {
            io.sockets.emit('screenshot', {src: currentHost+"/"+src, url: url, title: title, favicon: favicon});
          }
        });

        //insert hash into db
        pool.acquire(function(err, connection) {
          var date = new Date();
          connection.query('INSERT INTO hashes SET hash = ?, type = ?, url = ?, title = ?, favicon = ?, date = ?',[filename + ".html", 0, url, title, favicon, date], function(err, info) {
            pool.release(connection);
          });
        });

      } else {
        console.log("invalid key");
      }
  });
  
  //accept incoming picture from the chrome extension
  socket.on('picture', function (data) {
    var key = data.key;
     if(key === socketkey) {

      var imageData = data.data.replace(/^data:image\/\w+;base64,/, "");
      var buf = new Buffer(imageData, 'base64');
      var url = data.url;
      var title = data.title;
      var favicon = data.favicon;
      var path = "/home/slice/v/ssweb/img/";
      var filename = GUID() + ".jpg";

      var headers = {
        'Content-Type': 'image/jpeg'
      };

      s3.putBuffer(buf, '/img/' + filename, headers, function(err, res){
        io.sockets.emit("pictua", {src: currentHost+"/img/"+filename, url: url, title: title, favicon:favicon});
      });
    
      //insert hash into db
      pool.acquire(function(err, connection) {
        var date = new Date();
        connection.query('INSERT INTO hashes SET hash = ?, type = ?, url = ?, title = ?, favicon = ?, date = ?',[filename, 1, url, title, favicon, date], function(err, info) {
          pool.release(connection);
        });
      });

    } else {
      console.log("invalid key");
    }
  });
  
  //accept incoming screensize from the chrome extension
  socket.on("screenSize", function(data) {
    var height = data.height,
        width = data.width,
        date = new Date();

    pool.acquire(function(err, connection) {
      var date = new Date();
      connection.query('INSERT INTO settings SET height = ?, width = ?, date = ?',[height, width, date], function(err, info) {
        pool.release(connection);
        io.sockets.emit("screenSize", {height: height, width: width});
      });
    });
  });

  socket.on("disconnect", function() {
    users--;
  });

});

//make unique date-GUID
function GUID() {
  var now = new Date();
  var d = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

  var S4 = function () {
    return Math.floor(Math.random() * 0x10000).toString(16);
  };

  return (
    d +
    S4() + S4() + "-" +
    S4() + "-" +
    S4() + "-" +
    S4() + "-" +
    S4() + S4() + S4()
  );
}