## Authorize.NET Direct Post Method sandbox example

This is a small node.js Express server for sandbox testing the Authorize.Net DPM payment processing interface using the [authorize-net-dpm](authorize-net-dpm) module.

### local installation

```sh
git clone https://github.com/jldec/authorize-net-dpm.git
cd authorize-net-dpm/example
npm install
```

### configure a tunnel to your machine using localtunnel.me

```sh
npm install -g localtunnel
lt --port 3001 --subdomain {yourname}
```

- this should give you an externally reachable endpoint at https://{yourname}.localtunnel.me


### Authorize.Net setup
- get a developer sandbox account on [Authorize.Net](http://developer.authorize.net/)
- use the merchant interface to obtain (1) your login and (2) your transaction key
- define (3) your MD5 hash string (for validating relay responses)
- configure (4) relay respsonse URL as `https://{yourname}.localtunnel.me/server/authnet/relay-response`
- make a copy of the env.sh.example script `cp env.sh.example env`
- record the settings and inject into your environment with `source ./env`

### test locally
- start the server with `node server`
- browse to https://{yourname}.localtunnel.me/echo to see your session data (if you don't have a JSON viewer addon in your browser, use /echohtml instead). Each time you refresh, the `reqcnt` should increase by 1, but the sessionID should remain fixed.
- browse to https://{yourname}.localtunnel.me/ to see the test payment form
- modify the price on the form, then navigate to another field
- each change should trigger an ajax request for fingerprint data and fill in the blank fields (see static/dpm.js)
- submitting the form with a non-zero amount should perform the full DPM payment process and present a thank-you page
- entering a zero amount should hide the credit card fields and submitting it, perform a noCharge payment, also resulting in a thankyou page.
- after the transaction round trip, you should be able to see the data stored in your session, by re-visiting /echo.

### notes on required fields
All of the fields below except firstname, lastname, and ZIP are required for payment processing. The fields without an `x_` prefix are used internally by the authorize-net-dpm module for additional validation.

```html
<form id="form" method="post" action="https://test.authorize.net/gateway/transact.dll">
  <br>
  <label for="x_first_name">First name</label><input id="x_first_name" name="x_first_name" value=""><br>
  <label for="x_last_name">Last name</label><input id="x_last_name" name="x_last_name" value=""><br>
  <label for="x_amount">amount</label><input id="x_amount" name="x_amount" value="1.99"><br>

  <label class="ccard" for="x_card_num">card number</label><input class="ccard" id="x_card_num" name="x_card_num" value="4111 1111 1111 1111"><br>
  <label class="ccard" for="x_exp_date">expiration</label><input class="ccard" id="x_exp_date" name="x_exp_date" value="11/15"><br>

  <label for="x_zip">zip</label><input id="x_zip" name="x_zip" value="02421"><br>
  <br>
  <label for="timestamp">timestamp</label><input id="timestamp" name="timestamp" value=""><br>
  <label for="order_id">order ID</label><input id="order_id" name="order_id" value=""><br>
  <label for="session_id">session ID</label><input id="session_id" name="session_id" value=""><br>
  <br><br>
  <input id="x_fp_hash" name="x_fp_hash" value=""> hash <br>
  <input id="x_fp_sequence" name="x_fp_sequence" value=""> sequence <br>
  <input id="x_fp_timestamp" name="x_fp_timestamp" value=""> timestamp <br>
  <input id="x_login" name="x_login" value=""> login <br>
  <br>
  <input id="x_relay_url" name="x_relay_url" value=""> relay url <br>
  <input id="x_relay_response" name="x_relay_response" value="TRUE"> relay response <br>
  <input id="x_version" name="x_version" value="3.1"> version <br>
  <br><br>
  <input type="submit" value="submit"><br>
  <input type="hidden" id="validated" name="validated" value="">
  <input type="hidden" id="nocharge" name="nocharge" value="">
</form>
```
