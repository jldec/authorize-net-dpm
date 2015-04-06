// authnet dpm test

$(function() {

// install form event handlers
$('#form').change(getFingerPrint);
$('#form').submit(checkForm);

// small defense to foil spammers
$('#validated').val('jawohl!');

function getFingerPrint() {

  // formHide disables fields => never send credit card details to server
  formHide($('.ccard'));
  var data = $('#form').serialize();

  // don't show credit card fields if the amount is zero.
  if (!noCharge()) {
    formShow($('.ccard'));
  }

  $.post('/server/authnet/fingerprint', data, null, 'json')
  .done(function(respData) {
      $('#x_amount').val(respData.x_amount); // overwrite so that field matches string used for fingerprint
      $('#x_fp_hash').val(respData.x_fp_hash);
      $('#x_fp_sequence').val(respData.x_fp_sequence);
      $('#x_fp_timestamp').val(respData.x_fp_timestamp);
      $('#x_login').val(respData.x_login);
      $('#x_relay_url').val(respData.x_relay_url);
      $('#x_relay_response').val("TRUE");
      $('#x_version').val("3.1");
      $('#timestamp').val(respData.timestamp);
      $('#order_id').val(respData.order_id);
      $('#session_id').val(respData.session_id);
  });
}

function checkForm() {
  var nocharge = noCharge();
  $('#nocharge').val(nocharge || ''); // have to set nocharge field
  if (nocharge) {
    var data = $('#form').serialize();
    $.post('/server/nocharge', data, null, 'json')
    .done(function(respData) {
      window.location.href = respData.url;
    })
    .fail(function(jqXHR) {
      $('#log').html(jqXHR.status + ' error submitting to /server/nocharge');
    })
    return false;
  }
  return true; // submit paid form using normal form action
}

function noCharge() { return (Number($('#x_amount').val().replace(/[$,\s]/g,'')) === 0); }
function formHide($el) { $el.attr('disabled', 'disabled').hide(); }
function formShow($el) { $el.removeAttr('disabled').show(); }

});


