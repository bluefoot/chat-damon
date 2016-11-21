/*eslint-env node */

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
io.on('connection', function(socket){
  // Get user from session. If not found, disconnects.
  var user = socket.request.session.user;
  if(!user) {
    return socket.disconnect();
  }
  // Saves user info in the socket room, so it can be retrieved later
  socket.userid=user.userid;
  // Sends a message to the recently-connected users with some initial data.
  // Currently only data sent is the list of online users
  socket.emit('initialdata', {onlineUsers:getOnlineUsers()});
  // Now sends a message to everyone else that this user has connected, so they
  // can update their "online" list
  socket.broadcast.emit('userconnect', {userid:user.userid});
  // Send everyone a message when it arrives
  socket.on('newmessage', function(msg){
    socket.broadcast.emit('newmessage', {userid:user.userid,msg:msg});
  });
  // Send everyone a signal that this user has disconnected
  socket.on('disconnect', function(){
    socket.broadcast.emit('userdisconnect', {userid:user.userid});
  });
});

// Iterates over all connected sockets and return their "userid" attribute, set above
function getOnlineUsers() {
  var sockets = io.sockets.sockets;
  var users = [];
  for(var key in sockets) {
    users.push(sockets[key].userid);
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
app.get('/logout', routes.logout);
app.get('/chat', routes.chat);

//get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
http.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
