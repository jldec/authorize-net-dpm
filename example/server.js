/**
 * authorize-net-dpm example server.js
 *
 * copyright 2015, Jurgen Leschner - github.com/jldec - MIT license
**/

var debug = require('debug')('dpm:example');
var express = require('express');
var util = require('util');
var assert = require('assert');
var esc = require('lodash.escape');

assert(process.env.APP, 'please provide base url and other authnet credentials in environment');

var app = express();
var reqcnt = 0;                               // see countRequests()

app.use(countRequests);

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var session = require('express-session');

// not using "secure" session cookies
var sessionOpts = {
  name: 'sid',
  resave: false,
  saveUninitialized: true,
  secret: 'awesome',
  store: new session.MemoryStore
};

var sessionHandler = session(sessionOpts);
app.use(sessionHandler);

// Authorize.Net
var aNetConfig = {
  appUrl: process.env.APP,                    // heroku or localtunnel app url
  relay: '/server/authnet/relay-response',    // as configured in sandbox
  fingerprint: '/server/authnet/fingerprint', // see dpm.js
  noCharge: '/server/nocharge',               // not used in this example
  thankYou: '/server/reg-thank-you'
};

var dpm = require('../authorize-net-dpm')(aNetConfig, sessionOpts.store);

app.post(aNetConfig.relay,       dpm.postDPMrelay);
app.post(aNetConfig.fingerprint, dpm.postFingerprint);
app.post(aNetConfig.noCharge,    dpm.postNoCharge);

// other useful generic routes
app.use('/error', errorResponse);
app.use('/echo', echo);
app.use('/echohtml', echoHtml);
app.use('/env', env);
app.use('/envhtml', envHtml);

// statics
app.use(express.static(__dirname + '/static'));

app.use(errHandler);

var port = process.env.PORT || '3001';

app.listen(port);
console.log('Listening on port ' + port);
console.log('Point your browser to ' + process.env.APP);

app.get(aNetConfig.thankYou, function(req, res) {
  var orderid = req.query.id || '';
  var order = orderid && req.session && req.session.orders && req.session.orders[orderid];
  if (order) return res.send('<h2>Thank you.</h2>'+htmlify(order));
  res.send('orderid: '+orderid+' not found');
});

///////////////////
// generic handlers
///////////////////

// echo request as HTML
function echoHtml(req, res) {
  res.send(htmlify(echoreq(req)));
}

// echo request as json
function echo(req, res) {
  res.send(echoreq(req));
}

// respond with error code in req.query.err (or 403)
function errorResponse(req, res) {
  var errNum = Number(req.query.err || 403);
  res.status(errNum).send(err);
}

// echo environment as json (don't do this on heroku if there are real credentials there)
function env(req, res) {
  res.send(process.env);
}

// echo environment as json (don't do this on heroku if there are credentials there)
function envHtml(req, res) {
  res.send(htmlify(process.env));
}

// request counter middleware
// not used for anything real but nice to see these counters change as you refresh browser
function countRequests(req, res, next) {
  reqcnt++;
  if (req.session) {
    req.session.reqcnt = (req.session.reqcnt || 0) + 1;
  }
  next();
}

// generic error handler - better than crashing node
function errHandler(err, req, res, next) {
  console.log(err.stack || err);
  res.status(500).send(htmlify(err));
}

///////////////////
// helper functions
///////////////////

// minimal html object inspector
function htmlify(obj) {
  return '<pre>' + esc(util.inspect(obj)) + '</pre>'
}

// return serializable parts of req
function echoreq(req) {
  var r = {
    reqcnt: reqcnt,
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    query: req.query,
    params: req.params,
    body: req.body,
    cookies: req.cookies,
    sessionID: req.sessionID,
    user: req.user,
    session: req.session
  };
  return r;
}
