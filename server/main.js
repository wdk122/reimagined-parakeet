import { Meteor } from 'meteor/meteor';
import '../imports/api/leads.js';
import { Leads } from '../imports/api/leads.js';

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

const appOwnerFollowers = {};
const followedToday     = {};
// three days in milliseconds
// TODO: toggle between testing and prod
// const gracePeriod       = 259200000;
const gracePeriod       = 0;

// recursively gets and filters all the leads
getLeadPage(-1, 0);
// TODO: make sure getLeadPage completes before follow200 starts
// follow200(0); 


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
      console.log('starting... ');
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
                  followingOwner: false
                });
              }
            });
            resolve(data.next_cursor);
          } else {
            console.log(error);
          }
        }));
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
      
      // follow200(0);
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
// TODO: disallow following of leads that are following owner
function follow(id, count) {
  // if(count < 200) {
  if(count < 2) {
    const prom = new Promise((resolve, reject) => {
      const params = {
        user_id: id,
        follow: true
      };
      client.post('friendships/create', 
                  params, 
                  Meteor.bindEnvironment((error, data, resp) => {
        if (!error) {
          Leads.update(
            { id: id },
            { $set: { 
                autoFollowed: new Date(),
                followable:   false
            } }
          );
          resolve(count);
        } else {
          console.log(error);
        }
      }));
    });
    prom.then((res) => {
      console.log('followed ' + Leads.findOne({ id: id }).name);
      count++;
      follow(randomFollowableID(Leads), count);
    });
  } else {
    // console.log('followed 200 leads');
    console.log('followed 2 leads, now starting the unfollow process...');
    // TODO: invoke unfollow here
    // unfollow();
  }
}

// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 


// unfollows autoFollowed users that
// have not followed back after three days
// TODO: remove id as a required parameter
// TODO: add gracePeriod as parameter
// TODO: add unFollowed: true to disgraced leads
// function unfollow(gracePeriod) {
//   Leads.find({}).fetch().forEach((args) => {
//     stuff
//   })

//   const prom = new Promise((resolve, reject) => {
//     // TODO: iterate over all autoFollowed
//     const params = { user_id: id };
//     client.post('friendships/destroy', params, function(error, data, resp) {
//       if (!error) {
//         resolve(data);
//       } else {
//         console.log(error);
//       }
//     });
//   });
//   prom.then((res) => {
//     console.log('unfollowed user');
//   });


// };


// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 


// returns id of randomly chosen followable lead
function randomFollowableID(coll) {
  // console.log(coll);
  const list = coll.find({followable: true}).fetch();
  // console.log(list);
  const len  = list.length;
  const choice = Math.floor(Math.random() * len);
  // get array of keys
  // const keys   = Object.keys(coll);
  // choose random key
  // const choice = Math.floor(Math.random() * keys.length);
  return list[choice].id;
};

function leadsCollection() {
  return Leads.find().fetch();
}



// console.log(leadsCollection().length);














