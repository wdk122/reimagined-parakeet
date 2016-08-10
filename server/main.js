import { Meteor } from 'meteor/meteor';
import '../imports/api/leads.js';

Meteor.startup(() => {
  // code to run on server at startup
});

// this script gets leads that follow influencers,
// one influencer at a time
// ====================================================

'use strict';
const Twitter = require('twitter');
const secrets = require('./secrets.js');
const client = new Twitter({
  consumer_key:        secrets.tokens.consumerKey,
  consumer_secret:     secrets.tokens.consumerSecret,
  access_token_key:    secrets.tokens.accessToken,
  access_token_secret: secrets.tokens.accessSecret
});
const handleLeads       = {};
const appOwnerFollowers = {};
const followedToday     = {};

// recursively gets and filters all the leads
getLeadPage(-1, 0);

function trimCurrentFollowers() {
  for (let k in appOwnerFollowers) {
    if (handleLeads[k]){
      delete handleLeads[k];
    }
  }
};

function getLeadPage(cur, index) {
  if(index === secrets.targets.length) {
    console.log(handleLeads);
    console.log(Object.keys(handleLeads).length);
    const getAOF = new Promise((resolve, reject) => {
      const params = { screen_name: secrets.user };
      client.get('followers/ids', params, function(error, data, response) {
        if (!error) {
          data.ids.forEach((id) => {
            appOwnerFollowers[id] = id;
          });
        } else {
          console.log(error);
        }
        resolve(appOwnerFollowers);
      });
    });
    getAOF.then((res) => {
      console.log('===================');
      console.log('app owner followers');
      console.log(Object.keys(appOwnerFollowers).length);

      console.log('leads');
      console.log(Object.keys(handleLeads).length);

      trimCurrentFollowers();
      console.log('after removing app owner followers');
      console.log(Object.keys(handleLeads).length);

      trimProtectedFeeds();
      console.log('after removing handles w/ protected feeds');
      console.log(Object.keys(handleLeads).length);

      trimMysteryEggs();
      console.log('after removing eggs with no profile text');
      console.log(Object.keys(handleLeads).length);      
    });
  } else {
    const prom = new Promise((resolve, reject) => {
      const params = { 
        screen_name: secrets.targets[index],
        cursor: cur,
        count: 199,
        skip_status: true,
        include_user_entities: false
      };
      console.log('starting... ');
      console.log(Object.keys(handleLeads).length);
      setTimeout(() => {
        client.get('followers/list', params, function(error, data, response) {
          if (!error) {
            data.users.forEach((user) => {
              // TODO: store subset of user object
              // handleLeads[user.id] = user;
              
              handleLeads[user.id] = {
                id: user.id,
                name: user.name,
                description: user.description,
                protected: user.protected,
                profile_image_url: user.profile_image_url,
              };
            });
            resolve(data.next_cursor);
          } else {
            console.log(error);
          }
        });
        // production timeout      
      // }, 70000);
      // testing timeout
      }, 7);
    });
    prom.then((res) => {
      // if nonzero cursor
      if (res) {
        console.log('getting next page for ' + secrets.targets[index]);
        getLeadPage(res, index);
      // if cursor is zero
      } else {
        index++;
        console.log('last target complete');
        getLeadPage(-1, index);
      }
    })
  }
};

function trimProtectedFeeds() {
  for (let k in handleLeads) {
    if(handleLeads[k].protected) {
      delete handleLeads[k];
    };
  }
};

function trimMysteryEggs() {
  for (let k in handleLeads) {
    if(!handleLeads[k].description) {
      let foo = handleLeads[k].profile_image_url.split('/')[4];
      if(foo === 'default_profile_images') {
        delete handleLeads[k];
      }
    };
  }
};

function follow(id) {
  const prom = new Promise((resolve, reject) => {
    const params = {
      user_id: id,
      follow: true
    };
    client.post('friendships/create', params, function(error, data, resp) {
      if (!error) {
        // TODO: assign todays date to autofollowed
        handleLeads[id].autofollowed = true;
        console.log(handleLeads[id]);
        resolve(data);
      } else {
        console.log(error);
      }
    });
  });
  prom.then((res) => {

    console.log('followed new user');
  });
};

function unfollow(id) {
  const prom = new Promise((resolve, reject) => {
    const params = {
      user_id: id,
    };
    client.post('friendships/destroy', params, function(error, data, resp) {
      if (!error) {
        resolve(data);
      } else {
        console.log(error);
      }
    });
  });
  prom.then((res) => {
    console.log('unfollowed user');
  });
};

function unfollowAllStale() {
};

function randomKey(obj) {
  // get array of keys
  const keys   = Object.keys(obj);
  // choose random key
  const choice = Math.floor(Math.random() * keys.length);
  return keys[choice];
};

function follow200(count) {
  // TODO: use lower count for tesing vs. prod
  // if(count === 200) {
  if(count === 2) {
    console.log('followed 200 leads');
    return;
  } else {
    // follow random lead
    follow(randomKey(handleLeads));
    count++;
    follow200(count);
  }
};

// console.log(Object.keys(handleLeads).length);














