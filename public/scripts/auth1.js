var client_id = "TgzqtF7oa0cZSY6TAndwEyGty7DCaYMhFfBk7szn";

function redirector() {
  var redirectUrl = "http://localhost:3000/bstart/";
  var url = "https://internet.channeli.in/oauth/authorise/?client_id=" + client_id + "&redirect_uri=" + redirectUrl;
  window.location = url;
}
