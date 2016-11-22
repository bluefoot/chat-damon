// Define routes
var chatutils = require('./chatutils.js');
var db = require('./database.js');
var io;
var timeoutDisconnects = {};
var status = {AVAILABLE:'av',BUSY:'b',AWAY:'aw'};

exports.putUser = function(req, res) {
  // this method does not require authentication (per requirements)
  // any user can register itself
  var user = {name:req.body.name, email:req.body.email, password:req.body.password};
  user.userid = req.params.userid;
  db.userFind({userid:user.userid}, function(err, item){
    if(item) {
      // PUT is idempotent, so if exists it needs to either replace or return
      res.send(item);
    } else {
      db.userInsert(user, function(err, item){
        if (err) {
          res.status(500).send(err);
        } else {
          res.status(201).send(item);
        }
      });
    }
  });
};

exports.index = function(req, res) {
  if(req.session.user) {
    res.redirect('/chat');
  } else {
    res.render('index', {title : 'Chat application'});
  }
};

exports.registration = function(req, res) {
  res.render('registration', {title : 'New registration page'});
};

exports.login = function(req, res) {
  res.render('login', {title : 'Login'});
};

exports.dologin = function(req, res) {
  req.body.password = chatutils.hashpwd(req.body.password);
  db.userFind({'userid':req.body.userid, 'password':req.body.password}, function(err, item) {
    if(item) {
      req.session.user = item;
      res.redirect('/chat');
    } else {
      req.flash('error', 'Match not found');
      res.redirect('/login');
    }
  });
};

exports.logout = function(req, res){
  if(req.session.user) {
    var sockets = getUserSockets(req.session.user.userid);
    for(var i = 0; i < sockets.length; i++) {
      sockets[i].broadcast.emit('userdisconnect', {userid:sockets[i].user.userid});
      sockets[i].disconnect();
    }
    req.session.destroy();
  }
  res.redirect('/');
};


exports.chat = function(req, res) {
  if(req.session.user) {
    res.render('chat', {title : 'Chat page'});
  } else {
    res.redirect('/');
  }
};

exports.setupIO = function(http, sessionMiddleware) {
  io = require('socket.io')(http);
  io.engine.pingTimeout = 60000 * 10; // 10 minutes without activity, user is disconnected

  io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
  });

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

}
// Auxiliary Socket.IO functions
disconnectUser = function(sock) {
  sock.broadcast.emit('userdisconnect', {userid:sock.user.userid});
  sock.disconnect();
  delete timeoutDisconnects[sock.user.userid];
}

getUserSockets = function(userid) {
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
getOnlineUsers = function() {
  var sockets = io.sockets.sockets;
  var users = {};
  for(var key in sockets) {
    users[sockets[key].user.userid] = sockets[key].user.status;
  }
  return users;
}