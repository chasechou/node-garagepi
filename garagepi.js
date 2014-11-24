var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var gpio = require("pi-gpio");
var app = express();

require('console-stamp')(console, '[HH:MM:ss]');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.render('index.html');
});

app.get('/api/clickbutton', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'done' }));
  outputSequence(7, '10', 1000);
});

function outputSequence(pin, seq, timeout) {
  gpio.open(pin, 'output pullup', function(err) {
    gpioWrite(pin, seq, timeout);
  }, timeout);
}

function gpioWrite(pin, seq, timeout) {
  if (!seq || seq.length <= 0) { 
    console.log('closing pin:', pin);
    gpio.close(pin);
    return;
  }

  var value = seq.substr(0, 1);
  seq = seq.substr(1);
  setTimeout(function() {
    console.log('gpioWrite, value:', value, ' seq:', seq);
    gpio.write(pin, value, function() {
      gpioWrite(pin, seq, timeout);
    })
  }, timeout);
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

var autoSnapshot = setInterval(function() {
  var imgPath = path.join(__dirname, 'public/images');
  var cmd = 'raspistill -w 640 -h 480 -q 80 -o ' + imgPath + '/garage.jpg';
  var exec = require('child_process').exec;
  exec(cmd, function (error, stdout, stderr) {
    if (error !== null) {
      console.log('exec error: ' + error);
      return;
    }
    console.log('snapshot created...');
  });
}, 30000);

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('GaragePi listening on port:', port);
});
