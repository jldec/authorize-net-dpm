/**
 * authorize-net-dpm.js
 * Express.js middleware for enabling Authorize.Net DPM payments
 * designed to support static payment form
 *
 * 1.  payment form filled in by user
 * 2a. postFingerprint receives ajax form data and returns DPM fingerprint
 *   OR
 * 2b. postNoCharge receives ajax form data and returns thank-you URL
 *     (3-5 occur for 2a. only)
 * 3.  payment form with credit card etc. submitted to payment processor gateway
 * 4.  gateway posts transaction results to postDPMrelay url
 * 5.  postDPMrelay receives payment result and returns redirect to thank-you page
 *
 *
 * NOTE: depends on express-session store api via parameter sessionStore
 * This is used to get/set "order" data POSTed by users
 * and correlated with relay receipts POSTed by the payment gateway
 * (https://github.com/expressjs/session)
 * ==> recommend using persistent session store to avoid data loss
 *
 * copyright 2015, Jurgen Leschner - github.com/jldec - MIT license
**/

var crypto = require('crypto');

module.exports = function(opts, sessionStore) {

  var TRANSACTIONKEY = process.env.ANK;   // Authorize.Net transaction key
  var LOGINID =        process.env.ANID;  // Authorize.Net login id
  var MD5HASH =        process.env.ANM;   // Authorize.Net MD5 hash

  if (!TRANSACTIONKEY || !LOGINID || !MD5HASH) throw new Error('authorize-net-dpm missing credentials');

  opts = opts || {};

  opts.appUrl =         opts.appUrl   || process.env.APP;   // appUrl base e.g. https://example.com
  opts.relay =          opts.relay    || process.env.ANR;   // url path to relay response e.g. /authnet/relay
  opts.thankYou =       opts.thankYou || process.env.THKU;  // url path to thank-you page e.g. /thank-you

  var dpm = {

    // Express request handlers
    postNoCharge:    postNoCharge,                                // No-charge direct post handler
    postFingerprint: postFingerprint,                             // fingerprint post handler
    postDPMrelay:    postDPMrelay,                                // DPM relay response post handler

    // hooks for custom processing
    saveFormData:    opts.saveFormData     || saveFormData,       // (called by postFingerprint)
    savePaymentData: opts.savePaymentData  || savePaymentData,    // (called by postDPMrelay)
    processOrder:    opts.processOrder     || processOrderStub,   // (called after savePaymentData)
    formDataString:  opts.formDataString   || formDataStringStub, // extra string for formData hash

    hashFormData:    hashFormData,                                // maybe useful to expose this also
  };

  return dpm;

  //--//--//--//--//--//--//--//--//--//--//

  // AJAX no-charge direct post handler
  // performs single-step order processing, bypassing the payment gateway
  // returns thank-you url via JSON
  function postNoCharge(req, res) {

    var data = req.body;
    if (!data.nocharge || data.validated !== 'jawohl!') return res.status(403).end();

    data.session_id      = req.sessionID;
    data.timestamp       = (Date.now()+'').slice(0,-3);
    data.order_id        = hashFormData(data);
    data.x_auth_code     = 'no-charge';
    data.x_response_code = 1;

    if (req.user) { data.user = req.user; } // helpful for processOrder

    // ignore save errors
    dpm.saveFormData(req, data, function() {
      dpm.processOrder(data, function(err, url) {
        if (err) return res.status(500).send(err);
        res.send( { url:(url || defaultThankYouUrl(data)) } );
      });
    });
  }


  // AJAX fingerprint post handler
  // returns JSON DPM fingerprint values based on x_amount and other values
  // attempts to save form data before form is submitted to Authorize.Net
  // assumes system clock is correct
  function postFingerprint(req, res) {

    var data = req.body || {};

    if (data.validated !== 'jawohl!') return res.status(403).end();

    data.session_id    = req.sessionID;
    data.x_login       = LOGINID;
    data.x_relay_url   = (/^http/i.test(opts.relay) ? '' : opts.appUrl) + opts.relay;
    data.x_amount      = Number((data.x_amount || '').replace(/[$,\s]/g,'')).toFixed(2);

    // copy x_fp_timestamp and x_fp_sequence values not passed to relay response
    data.timestamp     = data.x_fp_timestamp = (Date.now()+'').slice(0,-3);
    data.order_id      = data.x_fp_sequence  = hashFormData(data);

    // the actual fingerprint hmac
    data.x_fp_hash     = crypto.createHmac('md5', TRANSACTIONKEY)
                        .update(data.x_login + '^' +
                                data.x_fp_sequence + '^' +
                                data.x_fp_timestamp + '^' +
                                data.x_amount + '^')
                        .digest('hex');

    // ignore save errors
    dpm.saveFormData(req, data, function() {
      res.send(data);
    });
  }


  // extra form data hash validated in postDPMrelay
  // designed to prevent tampering with important form data fields
  // replace dpm.formDataString() to validate other merchant-specific fields
  // NOTE: avoid fields which may contain utf-8 extended chars
  //       as these may be corrupted in relay response
  function hashFormData(data) {

    var s = data.session_id + '^' +
            MD5HASH + '^' +
            data.x_amount + '^' +
            data.timestamp + '^' +
            dpm.formDataString(data);

    return crypto.createHash('md5').update(s).digest('hex');
  }


  // default to hashing just the above fields
  function formDataStringStub(data) { return ''; }


  // default to session.store to save form data (todo: review store api)
  function saveFormData(req, data, cb) {
    if (req.session && sessionStore) {
      if (!req.session.orders) { req.session.orders = {}; }
      req.session.orders[data.order_id] = data;
      sessionStore.set(data.session_id, req.session, function(err) {
        return cb(err);
      });
    }
    else return cb(new Error('No session storage to save form data.'));
  }


  // relay response handler for Authorize.Net gateway
  // validates form data, merges payment results, and redirects back to origin
  // processOrder can override default redirect url
  function postDPMrelay(req, res) {
    var data = req.body;

    data.x_MD5_Hash_Validated = validateGatewayMD5(data);
    data.formData_Validated = (data.order_id === hashFormData(data));

    if (!data.x_MD5_Hash_Validated || !data.formData_Validated) return res.status(403).end();

    // merge and save - returns order object with merged payment data - ignore save errors
    dpm.savePaymentData(data, function(saveErr, order) {

      // process - returns thank-you url - adds additional data to order
      dpm.processOrder(order, function(processErr, url) {

        // merge and save again - returns yet another object with merged data - ignore save errors
        dpm.savePaymentData(order, function(saveErr, savedOrder) {

          if (processErr) return res.status(500).send(processErr);
          url = url || defaultThankYouUrl(savedOrder);

          // redirect
          var resp = '<html><head>' +
            '<script type="text/javascript" charset="utf-8">window.location="' + url + '";</script>' +
            '<noscript><meta http-equiv="refresh" content="0;url=' + url + '"></noscript>' +
            '</head><body>Please go to <a href="' + url + '">' + url + '</a></body></html>';

          res.send(resp);

        });
      });
    });
  }

  // Compute MD5 from payment gateway data and compare with x_MD5_Hash
  function validateGatewayMD5(data) {
    if (!data || !data.x_MD5_Hash) return false;
    var s = MD5HASH + LOGINID + data.x_trans_id + data.x_amount;
    return (data.x_MD5_Hash === crypto.createHash('md5').update(s).digest('hex').toUpperCase());
  }

  function defaultThankYouUrl(data) {
    return ((/^http/i.test(opts.thankYou) ? '' : opts.appUrl) +
            opts.thankYou + '?id=' + encodeURIComponent(data.order_id));
  }


  // default payment form postprocessor
  // tries to merge payment data into order data saved in session earlier
  // does not fail if there is no session - payments can be posted without sessions
  // returns either the merged data or, if there was no session, just the paymentData
  function savePaymentData(paymentData, cb) {

    if (!sessionStore) return cb(null, paymentData);

    sessionStore.get(paymentData.session_id, function(err, session) {
      var order;
      if (err ||
        !session ||
        !session.orders ||
        !(order = session.orders[paymentData.order_id])) return cb(null, paymentData);

      var keys = Object.keys(paymentData);
      keys.forEach(function(key) {
        if (!order[key]) {
          order[key] = paymentData[key];
        }
      });

      sessionStore.set(paymentData.session_id, session, function(err){
        if (session.passport && session.passport.user) { order.user = session.passport.user; }
        return cb(null, order);
      });
    });
  }

  // stub
  function processOrderStub(orderData, cb) { return cb(); }

}