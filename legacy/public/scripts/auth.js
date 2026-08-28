

const redirectUrl = "http://localhost:3000/";
const clientId = "TgzqtF7oa0cZSY6TAndwEyGty7DCaYMhFfBk7szn";
const client_secret = "2HDL3JcHx7EyTU8zemx0Wm7nIpSnFN0NfYtETKgUHI9WYZ2hBaJ5PqKUgAjUHoOIVHWyXj8w6LqFadpsqoS0z1kfOkEv3NwLuCg7F1tI6MKFiQHGyBxfvrgmBY4JQwmq";


let codecomp = window.location.search;
var authorisation_code = codecomp.split('&')[0].replace('?code=', '');
console.log(authorisation_code);

const posturl = `http://channeli.in/open_auth/token/`;

var http = new XMLHttpRequest();

var grant_type = 'authorization_code';
var redirect_uri = 'http://localhost:3000/';

console.log(document.getElementById('_csrf'));

var data = 'client_id=' + clientId + '&client_secret=' + client_secret + '&grant_type=' + grant_type + '&redirect_uri=' + redirect_uri + '&code=' + authorisation_code + '&_csrf=' + document.getElementById('_csrf').value;

// console.log(redirect_uri+data);
http.open('POST', posturl);



http.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
// http.setRequestHeader('Access-Control-Allow-Origin', false);

http.send(data);
var access_token = '';


function getUserData() {
  // var http = new XMLHttpRequest();
  var url = 'http://channeli.in/open_auth/get_user_data/';
  http.open('GET', url, true);
  http.setRequestHeader('Authorization', 'Bearer ' + access_token);
  // http.setRequestHeader('Cross-Origin-Resourse-Sharing', '*');
  http.send();
  http.onreadystatechange = () => {
    if(http.status == 200 && http.readyState === XMLHttpRequest.DONE){

      console.log(http.responseText);
    }
  }
}


http.onreadystatechange = () =>{
  
  if (http.status == 200 && http.readyState === XMLHttpRequest.DONE) {
    console.log(4);
    console.log(http.responseText);
    access_token = JSON.parse(http.responseText).access_token;
    console.log(access_token);
    getUserData();
  }
  
}
