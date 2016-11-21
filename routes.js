// Define routes
var chatutils = require('./chatutils.js');
var db = require('./database.js');

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

exports.logout = function(req, res) {
  req.session.destroy();
  res.redirect('/');
};


exports.chat = function(req, res) {
  if(req.session.user) {
    res.render('chat', {title : 'Chat page'});
  } else {
    res.redirect('/');
  }
};