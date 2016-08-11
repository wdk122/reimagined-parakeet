import { Template } from 'meteor/templating';

import { Leads } from '../api/leads.js';
 
import './body.html';
 
Template.body.helpers({
  leads() {
    return Leads.find({}, { sort: { createdAt: -1 } });
  },
});

Template.body.events({
  'submit .new-lead'(event) {
    // Prevent default browser form submit
    event.preventDefault();
 
    // Get value from form element
    const target = event.target;
    const name = target.text.value;
 
    // Insert a lead into the collection
    Leads.insert({
      name,
      createdAt: new Date(), // current time
    });
 
    // Clear form
    target.text.value = '';
  },
});