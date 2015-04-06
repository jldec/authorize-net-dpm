# authorize-net-dpm

Using DPM, Authorize.Net payments can be posted directly from the customer browser to the Authorize.Net payment gateway, reducing PCI burdens on the merchant's website. The gateway then posts transaction details (without exposing the credit card information) to the merchant server which returns a redirect to a thank-you page. The redirect automatically brings the browser back to the merchant site with the result that the URL in the address bar stays on the same origin even though the form action points to the payment gateway.

This module provides an interface for browsers to fetch the "fingerprint" which authenticates posted transactions as coming from the merchant. The fingerprint values are injected into the form via an ajax JSON request from the browser before the form is submitted to the payment gateway. By injecting the fingerprint dynamically, the payment form can be installed in an application or served from a static website or CDN.

This module also serves the "relay-response" post from the payment gateway which is authenticated using a preconfigured secret `MD5 hash` string before recording the transaction result. With DPM, the purpose of this relay-response is to record the success or failure of the payment transaction and then redirect the browser back to the merchant website.

Finally, this module provides a post interface to process no-charge transactions directly (without any information passing throught authorize.net),  allowing a single form to handle both paid and non-paid order processing. This is useful in environments where credit cards are not the only form of payment or where free products are mixed with paid.

### environment
This module requires credentials to come from process.env varables `ANK`, `ANID`, and `ANM`.

```sh
export ANK={transaction_key}
export ANID={login}
export ANM={MD5hash}
```

### API

```javascript
// configure
var aNetConfig = {
  appUrl: process.env.APP,                       // appUrl base e.g. https://example.com
  relay: '/server/authnet/relay-response',       // url path to relay response
  fingerprint: '/server/authnet/fingerprint',    // url path to thank-you page
  noCharge: '/server/nocharge',
  thankYou: '/server/reg-thank-you'
};

// instantiate
var dpm = require('authorize-net-dpm')(aNetConfig, sessionOpts.store);

// express routes
app.post(aNetConfig.relay,       dpm.postDPMrelay);
app.post(aNetConfig.fingerprint, dpm.postFingerprint);
app.post(aNetConfig.noCharge,    dpm.postNoCharge);

```

### module parameters

- The 1st parameter is used for configuration options such as the relay-response URL (required). 

- The 2nd parameter is optional. Use it to pass an [express-session](https://github.com/expressjs/session#compatible-session-stores) store api. If this is provided and if a `session` object is found on requests at runtime, the dpm module will persist order data in `session.orders`

### additional hooks

- Set `dpm.processOrder` for custom post-processing after a payment is processed. This function will be called with the signature `processOrder(data, cb)` allowing for async post-processing e.g. to send email before responding with callback `cb()`.

- A few additional hooks are available in [the code](blob/master/authorize-net-dpm.js).

### Example
- Check out the [example](tree/master/example) for information about required form fields and other details.