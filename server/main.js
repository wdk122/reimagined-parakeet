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
// const gracePeriod       = 60000;
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
function follow(id, count) {
  // if(count < 200) {
  if(count < 2) {
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
          // TODO: handle error 108 (cannot find specified user)
          // handles case where Twitter can't find a lead
          } else if(error[0].code === 108) {
            console.log(error[0].message);
            resolve(error[0].code);
          } else {
            console.log(error);
            // console.log(error[0].message);
          }
        }));
      // TODO: use 1 min timeout in prod
      // }, 70000)
      }, 5000)
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

    // TODO: invoke unfollow here
    unfollow();  
  }
}


// unfollows autoFollowed users that
// have not followed back after three days
// and have not yet been unfollowed
// TODO: add unfollowed: true to disgraced leads 
function unfollow() {
  const deadLeads = Leads.find(
    { 
      $and: [
        { autoFollowed: { $lte: new Date().valueOf() - gracePeriod } },
        { followingOwner: false },
        { unfollowed: false }
      ] 
    }
  ).fetch();
  // console.log('autoFollowed handles to unfollow:');
  deadLeads.forEach((lead) => {
    console.log(lead.handle);
    // TODO: destroy friendship here
    let params = { user_id: lead.id }
    let cb = Meteor.bindEnvironment((error, data, resp) => {
      if (!error) {
        console.log('unfollowed ' + lead.handle);
        // TODO: update Leads collection parameters to reflect the unfollow
        Leads.update(
          { handle: lead.handle },
          { $set: { unfollowed: true } }
        );
      } else {
        console.log(error);
      }
    })
    client.post('friendships/destroy', params, cb);
  });
  // TODO: remove the code below: it is just for testing purposes
  // follow(561561561561565166556, 1);
}


// returns id of randomly chosen followable lead
function randomFollowableID(coll) {
  const list = coll.find({followable: true}).fetch();
  const len  = list.length;
  const choice = Math.floor(Math.random() * len);
  return list[choice].id;
};




