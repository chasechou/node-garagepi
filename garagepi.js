var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var GPIO = require("onoff").Gpio;
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var startTakingSnaps = false;

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

var state = 'closed';

app.get('/api/clickbutton', function(req, res) {
  outputSequence(7, '10', 1000);
  state = state == 'open' ? 'closed' : 'open';
  console.log(`action: clickbutton  state: ${state}`);
  res.setHeader('Content-Type', 'application/json');
  res.end(state);
});

app.get('/api/openclose', function(req, res) {
  let body = ''; 
  if(req.query.state !== 'status') {
    // only do action if not already in desired state
    if((req.query.state == 'on' && state == 'closed') ||
       (req.query.state == 'off' && state == 'open')) {
      outputSequence(7, '10', 1000);
      state = req.query.state == 'on' ? 'open' : 'closed';
      console.log(`action: openclose  state: ${state}`);
    }
  }
  body = state;
  res.setHeader('Content-Type', 'application/json');
  res.end(state);
});

app.get('/api/sensor', function(req, res) {
  let body = ''; 
  if(req.query.state !== 'status') {
    state = req.query.state == 'on' ? 'open' : 'closed';
  }
  body = state;

  res.setHeader('Content-Type', 'application/json');
  res.end(state);
});

app.get('/api/status', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ state: state }));
  console.log('returning state: ' + state);
});

function outputSequence(pin, seq, timeout) {
  var gpio = new GPIO(4, 'out');
  gpioWrite(gpio, pin, seq, timeout);
}

function gpioWrite(gpio, pin, seq, timeout) {
  if (!seq || seq.length <= 0) { 
    console.log('closing pin:', pin);
    gpio.unexport();
    return;
  }

  var value = seq.substr(0, 1);
  seq = seq.substr(1);
  setTimeout(function() {
    console.log('gpioWrite, value:', value, ' seq:', seq);
    gpio.writeSync(value);
    gpioWrite(gpio, pin, seq, timeout);
  }, timeout);
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

function takeSnaps() {
  var autoSnapshot = setTimeout(function() {
    var imgPath = path.join(__dirname, 'public/images');
    var cmd = 'raspistill -w 640 -h 480 -q 80 -o ' + imgPath + '/garage.jpg';
    var exec = require('child_process').exec;
    exec(cmd, function (error, stdout, stderr) {
      if (error !== null) {
        console.log('exec error: ' + error);
        return;
      }
      io.emit('snapshot', 'ready');
      console.log('snapshot created...');
      if(startTakingSnaps) {
        takeSnaps();
      }
    });
  }, 0);

  return autoSnapshot;
}

io.on('connection', function(socket){
  console.log('a user connected');
  startTakingSnaps = true;
  takeSnaps();

  socket.on('disconnect', function(){
    console.log('user disconnected');
    startTakingSnaps = false;
  });
});

var port = process.env.PORT || 8000;
server.listen(port, function() {
  console.log('GaragePi listening on port:', port);
});
