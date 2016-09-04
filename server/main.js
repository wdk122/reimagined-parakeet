import { Meteor } from 'meteor/meteor';
import '../imports/api/leads.js';
import { Leads } from '../imports/api/leads.js';

Meteor.startup(() => {
  // code to run on server at startup
});

'use strict';
const Twitter = require('twitter');
const secrets = require('./secrets.js');
const client = new Twitter({
  consumer_key:        secrets.tokens.consumerKey,
  consumer_secret:     secrets.tokens.consumerSecret,
  access_token_key:    secrets.tokens.accessToken,
  access_token_secret: secrets.tokens.accessSecret
});

const appOwnerFollowers = {};

// ====================================================
// SHORT TEST PARAMS:
// 3 min scriptInterval
// const gracePeriod    = 0; 
// const getLeadTimeout = 7;
// const followTimeout  = 5000;
// const followCount    = 2;
// const scriptInterval = 180000;

// ====================================================
// LONG TEST PARAMS:
// run once every 20 mins
// const gracePeriod    = 0; 
// const getLeadTimeout = 70000;
// const followTimeout  = 70000;
// const followCount    = 4;
// const scriptInterval = 1200000;

// ====================================================
// LONGER TERM TEST PARAMS:
// prod params with no grace period
// const gracePeriod    = 0; 
// const getLeadTimeout = 7;
// const followTimeout  = 70000;
// const followCount    = 0;
// const followCount    = 150 + Math.ceil(Math.random() * 50);
// const scriptInterval = 86400000;

// ====================================================
// PROD PARAMS:
// grace period is three days
// run script once a day
const gracePeriod    = 259200000; 
const getLeadTimeout = 70000;
const followTimeout  = 70000;
const followCount    = 150 + Math.ceil(Math.random() * 50);
const scriptInterval = 86400000;

// ====================================================


// recursively gets and filters all the leads
console.log('follow count: ' + followCount);
getLeadPage(-1, 0);
Meteor.setInterval(() => {
  getLeadPage(-1, 0);
}, scriptInterval);

function getLeadPage(cur, index) {
  if(index < secrets.targets.length) {
    const prom = new Promise((resolve, reject) => {
      const params = { 
        screen_name: secrets.targets[index],
        cursor: cur,
        count: 199,
        skip_status: true,
        include_user_entities: false
      };
      // console.log('starting... ');
      Meteor.setTimeout(() => {
        client.get('followers/list', params, Meteor.bindEnvironment((error, data, response) => {
          if (!error) {
            data.users.forEach((user) => {
              if(!Leads.find( { id: user.id } ).fetch().length) {
                Leads.insert({
                  name: user.name,
                  handle: user.screen_name,
                  id: user.id,
                  description: user.description,
                  protected: user.protected,
                  profile_image_url: user.profile_image_url.split('/')[4],
                  followable: true,
                  followingOwner: false,
                  unfollowed: false
                });
              }
            });
            resolve(data.next_cursor);
          } else {
            console.log(error);
          }
        }));
      }, getLeadTimeout);
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
  } else {
    const getAOF = new Promise((resolve, reject) => {
      const params = { screen_name: secrets.user };
      client.get('followers/ids', 
                 params, 
                 Meteor.bindEnvironment((error, data, response) => {
        if (!error) {
          data.ids.forEach((id) => {
            appOwnerFollowers[id] = id;
            Leads.update(
              { id: id },
              { $set: { 
                followingOwner: true,
                followable:     false,
              } },
            );
          });
        } else {
          console.log(error);
        }
        resolve(appOwnerFollowers);
      }));
    });
    getAOF.then((res) => {
      console.log('===================');
      console.log('app owner followers');
      console.log(Object.keys(appOwnerFollowers).length);

      // console.log('leads');
      // console.log(Leads.find({ followable: true }).fetch().length);

      trimCurrentFollowers();
      console.log('leads after removing app owner followers');
      console.log(Leads.find({ followable: true }).fetch().length);

      trimProtectedFeeds();
      console.log('after removing handles w/ protected feeds');
      console.log(Leads.find({ followable: true }).fetch().length);

      trimMysteryEggs();
      console.log('after removing eggs with no profile text');
      console.log(Leads.find({ followable: true }).fetch().length);
      
      follow(randomFollowableID(Leads), 0);
    });
  }
};

function trimCurrentFollowers() {
  for (let k in appOwnerFollowers) {
    k = ~~k;
    Leads.update(
      { id: k },
      { $set: { followable: false } }
    );
  }
};

function trimProtectedFeeds() {
  Leads.update(
    { protected: true },
    { $set: { followable: false } },
    { multi: true }
  );
};

function trimMysteryEggs() {
  Leads.find().fetch().forEach((lead) => {
    if(!lead.description) {
      let foo = lead.profile_image_url;
      if(foo === 'default_profile_images') {
        Leads.update(
          { id: lead.id },
          { $set: { followable: false } }
        );
      };
    };
  })
};

// follow(randomFollowableID(Leads), 0);
function follow(id, count) {
  if(count < followCount) {
    const prom = new Promise((resolve, reject) => {
      const params = {
        user_id: id,
        follow: true
      };
      Meteor.setTimeout(() => {
        client.post('friendships/create', 
                    params, 
                    Meteor.bindEnvironment((error, data, resp) => {
          if (!error) {
            Leads.update(
              { id: id },
              { $set: { 
                  autoFollowed: new Date().valueOf(),
                  followable:   false
              } }
            );
            resolve('ok');
          // handles case where Twitter can't find a lead
          } else if(error[0].code === 108) {
            console.log(error[0].message);
            resolve(error[0].code);
          } else {
            console.log(error);
            // console.log(error[0].message);
          }
        }));
      }, followTimeout * (Math.random() + 1))
    });
    prom.then((res) => {
      if(res === 'ok') {
        console.log('followed ' + Leads.findOne({ id: id }).handle);
        count++;
        follow(randomFollowableID(Leads), count);
      } else if(res === 108) {
        console.log('resolving promise after code 108');
        follow(randomFollowableID(Leads), count);
      } else {
        console.log('follow promise unresolved.');
      }
    });
  } else {
    // console.log('followed 200 leads');
    console.log('followed 2 leads, now starting the unfollow process...');
    // console.log(Leads.find(
    //   { autoFollowed: { $lt: new Date().valueOf() - 2000 } }
    // ).fetch());

    unfollow(-1, []);  
  }
}


// unfollows autoFollowed users that
// have not followed back after three days
// and have not yet been unfollowed
function unfollow(index, deadLeads) {
  if (index === -1) {
    console.log('getting deadLeads');
    const prom = new Promise((resolve, reject) => {
      // resolve an array of dead lead objects
      resolve(
        Leads.find(
          { 
            $and: [
              { autoFollowed: { $lte: new Date().valueOf() - gracePeriod } },
              { followingOwner: false },
              { unfollowed: false }
            ] 
          }
        ).fetch()
      );
    });
    prom.then((res) => {
      unfollow(0, res);
    });

  } else if (index < deadLeads.length) {
    console.log('index: ' + index);
    let timeout = followTimeout * (Math.random() + 1);
    console.log('timeout: ' + timeout);
    let params = { user_id: deadLeads[index].id }
    let cb = Meteor.bindEnvironment((error, data, resp) => {
      if (!error) {
        console.log('unfollowed ' + deadLeads[index].handle);
        Leads.update(
          { handle: deadLeads[index].handle },
          { $set: { unfollowed: true } }
        );
      } else {
        console.log(error);
      }
    });
    // =============================
    const prom = new Promise((resolve, reject) => {
      Meteor.setTimeout(
        () => {
          client.post('friendships/destroy', params, cb);
          resolve(true);
        },
        timeout
      );
      // unfollow api action
    });
    prom.then((res) => {
      // do stuff
      unfollow(index + 1, deadLeads);
    })
  } else if (index === deadLeads.length) {
    console.log('unfollow batch finished for this round');
  } else {
    console.log('ERROR: index greater than deadLeads.length');
  }
}


// returns id of randomly chosen followable lead
function randomFollowableID(coll) {
  const list = coll.find({followable: true}).fetch();
  const len  = list.length;
  const choice = Math.floor(Math.random() * len);
  return list[choice].id;
};




