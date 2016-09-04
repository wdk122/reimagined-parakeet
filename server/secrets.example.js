// TODO: iterate through all TODO items on page, then rename file as secrets.js

import { Meteor } from 'meteor/meteor';

Meteor.startup(() => {
  // code to run on server at startup
});

module.exports = {

  tokens: {

    // TODO: add your twitter account's app's tokens below
    consumerKey: '',
    consumerSecret: '',
    accessToken: '',
    accessSecret: ''

  },
  // TODO: replace targets with handles that have followers you want to target
  targets: ['foo', 'bar', 'baz'],


  // this account 'owns' the app
  // this handle is target of 'get app owner followers' function
  // TODO: replace user with your twitter handle
  user: 'myTwitterHandle'
}


