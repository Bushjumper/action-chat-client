import Ember from 'ember';

const {
  Component,
  computed,
  $,
  run
} = Ember;

export default Component.extend({
  classNames: ['c-comments-section'],
  sessionMember: null,
  comments: [],
  firstUnread: null,

  actions: {
    doTap() {
      $('#chat-area').blur();
    }
  }
});