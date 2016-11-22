/*eslint-env node */

// TODO put all socket.io logic on routes.js, also logout logic
// TODO implement busy
//------------------------------------------------------------------------------
// gewtonj-chat (Chat system by gewtonj@br.ibm.com)
//------------------------------------------------------------------------------

var express = require('express');
var path = require('path');
var swig = require('swig');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var flash = require('express-flash');
var routes = require('./routes');
var db = require('./database.js');
var cfenv = require('cfenv');

// create a new express server
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
io.engine.pingTimeout = 60000 * 10; // 10 minutes without activity, user is disconnected

//activating parser for http forms, using it as JSON in req.body 
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// session setup. more info at https://expressjs.com/en/resources/middleware/session.html
app.set('trust proxy', 1) // trust first proxy
var sessionm = session({
  secret: 'Q7xqHO2PjduytZREygvd',
  resave: false,
  saveUninitialized: true
});

//flash config. kinda like JSF/spring MVC https://github.com/RGBboy/express-flash
app.use(cookieParser('Q7xqHO2PjduytZREygvd'));
app.use(flash());

// view engine setup (swig: https://github.com/paularmstrong/swig)
app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// Socket IO configuration with session
io.use(function(socket, next) {
  sessionm(socket.request, socket.request.res, next);
});
app.use(sessionm);
var status = {AVAILABLE:'av',BUSY:'b',AWAY:'aw'};
var timeoutDisconnects = {};
function disconnectUser(sock) {
  sock.broadcast.emit('userdisconnect', {userid:sock.user.userid});
  sock.disconnect();
  delete timeoutDisconnects[sock.user.userid];
}

io.on('connection', function(socket){
  // Get user from session. If not found, disconnects.
  if(!socket.request.session || !socket.request.session.user) {
    return socket.disconnect();
  }
  
  // Saves user info in the socket room, so it can be retrieved later
  socket.user={userid:socket.request.session.user.userid,status:status.AVAILABLE};
  
  // Check if user only recently lost connection. If positive, then no need to
  // notify everyone that the user came back. Might have been just a page refresh.
  if(timeoutDisconnects[socket.user.userid]) {
    // User reconnected
    clearTimeout(timeoutDisconnects[socket.user.userid]);
    delete timeoutDisconnects[socket.user.userid];
  } else {
    // User connected
    // Sends a message to everyone else that this user has connected, so they
    // can update their "online" list
    var userinfo = {};
    userinfo[socket.user.userid] = socket.user.status;
    socket.broadcast.emit('userconnect', userinfo);
  }
  
  // Sends a message to the just connected (or just re-connected) user with some 
  // initial data. Currently the only data sent is the list of online users
  socket.emit('initialdata', {onlineUsers:getOnlineUsers()});

  // If disconnected, starts a timeout of 1 minute. If no response after 1/2 minute,
  // notify everyone that user has disconnected.
  socket.on('disconnect', function(){
    timeoutDisconnects[socket.user.userid] = setTimeout(function(){
      disconnectUser(socket);
    }, 30000);
  });
  
  // Triggered when user has no activity after a while, broadcasts to everyone
  socket.on('idle', function(){
    socket.user.status = status.AWAY;
    io.emit('userstatus', socket.user);
  });
  
  // Triggered when user marks itself as busy, broadcasts to everyone
  socket.on('busy', function(){
    socket.user.status = status.BUSY;
    io.emit('userstatus', socket.user);
  });
  
  // Triggered when user marks itself as available, broadcasts to everyone
  socket.on('available', function(){
    socket.user.status = status.AVAILABLE;
    io.emit('userstatus', socket.user);
  });
  
  // Triggered when a new message arrives
  socket.on('newmessage', function(msg){
    socket.broadcast.emit('newmessage', {userid:socket.user.userid,msg:msg});
  });
  
  // On every heartbeat, check if user still logged on. If not, disconnect socket.
  socket.conn.on('heartbeat', function() {
    if(!socket.request.session || !socket.request.session.user) {
      socket.disconnect();
    }
  });
});

function getUserSockets(userid) {
  var sockets = io.sockets.sockets;
  var userSockets = [];
  for(var key in sockets) {
    var socket = sockets[key];
    if(socket.user && socket.user.userid==userid) {
      userSockets.push(socket);
    }
  }
  return userSockets;
}

// Iterates over all connected sockets and return their "userid" attribute, set above
function getOnlineUsers() {
  var sockets = io.sockets.sockets;
  var users = {};
  for(var key in sockets) {
    users[sockets[key].user.userid] = sockets[key].user.status;
  }
  return users;
}

// Routes
// GET    /                             view start page
app.all('*', function(req, res, next) {
  // Check if mongodb finished connecting and loading bootstrap data
  if(!db.isDbReady()) {
    res.status(500).send('Application still loading, try again');
  } else {
    // Set session user (if available) to a global variable to be used by views
    res.locals.user = req.session.user || null;
    // Continue in the chain
    next();
  }
});
app.put('/api/user/:userid', routes.putUser);
app.get('/', routes.index);
app.get('/register', routes.registration);
app.get('/login', routes.login);
app.post('/login', routes.dologin);
app.get('/logout', function(req, res){
  if(req.session.user) {
    var sockets = getUserSockets(req.session.user.userid);
    for(var i = 0; i < sockets.length; i++) {
      sockets[i].disconnect();
    }
    req.session.destroy();
  }
  res.redirect('/');
});
app.get('/chat', routes.chat);

//get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
http.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
