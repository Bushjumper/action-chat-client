import Ember from 'ember';

const {
  Controller,
  debug,
  $,
  observer,
  run,
  computed,
  computed: {
    alias
  },
  isEmpty
} = Ember;

const NUDGE_OFFSET_PX = 60; // Pixels for determining nudge vs scroll for new comment
const NUDGE_PX = 24; // Pixels for distance to nudge
const COMMENT_LOAD_SIZE = 10;

export {
  COMMENT_LOAD_SIZE
};

export default Controller.extend({

  stream: null,
  sessionMember: null,
  members: [],
  comments: [],

  commentsElement: null,
  commentsSubscription: null,
  streamsSubscription: null,
  isLoadingEarlier: false,
  isKeyboardOpen: false,
  isNotifierVisible: true,
  totalCommentCount: 0,
  newMessagesTop: 0,

  didRender() {
    this.commentsElement = $('.js-comments-section');
    this.chatBox = $('.js-chat-box');
    this.streamBody = $('.js-stream-body');
    this.scrollToBottom();

    if (window.Keyboard) {
      // window.Keyboard.shrinkView(true);
    }
    if (window.cordova && window.cordova.plugins.Keyboard) {
      this.setupKeyboardEvents();
    }

    this.showNewMessagesMarker();

  },

  showNewMessagesMarker() {

    let lastReadAt = this.get('sessionMember.lastReadAt');

    let unreadComments = this.get('comments').sortBy('createdAt').filter((comment) => {
      return comment.get('createdAt') > lastReadAt;
    });

    Ember.debug(`comments: ${this.get('comments.length')}`);
    Ember.debug(`unreadComments: ${unreadComments.get('length')}`);

    if (unreadComments.get('length')) {

      let unreadCommentElement = $(`#comment-${unreadComments.get('firstObject.id')}`);
      let newMessagesTop = unreadCommentElement.position().top - 10;

      this.set('newMessagesTop', newMessagesTop);

    }
  },

  setLastReadAt() {
    // let lastReadAt = new Date();
    // Ember.debug('setLastReadAt', lastReadAt);

    // this.get('membersSubscription').send({
    //   member_id: this.get('sessionMember.id'),
    //   member: {
    //     last_read_at: lastReadAt
    //   },
    //   action: 'update'
    // });
  },

  isShowingAllComments: computed('totalCommentCount', 'comments.length', function() {
    return this.get('comments.length') >= this.get('totalCommentCount');
  }),

  receivedCommentsData(data) {
    let comment = this.store.peekRecord('comment', data.comment.id);
    if (isEmpty(comment)) {
      if (data.action === 'created') {

        let bottomOffset = this.bottomOffset();

        this.pushComment(data.comment);
        this.commentCountPlusPlus();

        run.next(this, this.nudgeOrScrollBottom, bottomOffset);
        run.next(this, this.vibrate);
      }
    } else {
      if (data.action === 'destroyed') {
        this.unloadComment(comment);
      } else {
        this.updateComment(comment, data.comment);
      }
    }
  },

  setupKeyboardEvents() {
    let _this = this;

    window.addEventListener('native.keyboardshow', function(e) {
      _this.showKeyboard(e.keyboardHeight);
    });

    window.addEventListener('native.keyboardhide', function(e) {
      _this.hideKeyboard(e.keyboardHeight);
    });
  },

  showKeyboard(height) {
    let {
      scrollHeight
    } = this.commentsElement.get(0);

    this.streamBody.css({
      'transform': `translateY(-${height}px)`,
      '-webkit-transform': `translateY(-${height}px)`
    });

    // We need a run later so that scrollTop is only set after keyboard shows
    run.later(this, () => {
      this.commentsElement.scrollTop(scrollHeight + height);

      this.commentsElement.animate({
        scrollTop: scrollHeight + height
      }, 100);
    }, 120);
  },

  hideKeyboard() {
    this.streamBody.css({
      'transform': 'translateY(-0px)',
      '-webkit-transform': 'translateY(-0px)'
    });
  },

  // For development only
  isKeyboardDidChange: observer('isKeyboardOpen', function() {
    if (this.get('isKeyboardOpen')) {
      let height = 216; // iPhone 5 keyboard height
      this.showKeyboard(height);
    } else {
      this.hideKeyboard();
    }
  }),

  pushComment(data) {
    this.store.push({
      data: {
        id: data.id,
        type: 'comment',
        attributes: {
          body: data.body
        },
        relationships: {
          'person': {
            'data': {
              'type': 'person',
              'id': data.person.id
            }
          },
          'stream': {
            'data': {
              'type': 'stream',
              'id': data.stream.id
            }
          }
        }
      }
    });
  },

  updateComment(comment, data) {
    comment.set('body', data.body);
  },

  unloadComment(comment) {
    this.store.unloadRecord(comment);
  },

  doScroll(top) {
    this.commentsElement.animate({
      scrollTop: top
    }, 100);
  },

  scrollToBottom() {
    this.doScroll(this.commentsElement.get(0).scrollHeight);
  },

  nudgeBottom() {
    this.doScroll(this.commentsElement.scrollTop() + NUDGE_PX);
  },

  bottomOffset() {
    let sectionHeight = this.commentsElement.height() + 20; // TODO: 20 for margin?
    let {
      scrollHeight
    } = this.commentsElement.get(0);
    let scrollTop = this.commentsElement.scrollTop();

    // NOTE: (total scroll height) - (height of section + 20 for margin) - (scrolled distance)
    return scrollHeight - sectionHeight - scrollTop;
  },

  nudgeOrScrollBottom(bottomOffset) {
    if (bottomOffset > NUDGE_OFFSET_PX) {
      this.nudgeBottom();
    } else {
      this.scrollToBottom();
    }
  },

  vibrate() {
    if (window.navigator) {
      window.navigator.vibrate(2000); // Note: Time is ignored on iOS
    }
  },

  commentCountPlusPlus() {
    this.set('totalCommentCount', this.get('totalCommentCount') + 1);
  },

  actions: {
    toggleNotifierVisibility() {
      this.set('isNotifierVisible', false);
    },

    createComment(body) {
      debug('createComment');
      let comment = this.store.createRecord('comment', {
        body,
        person: this.get('sessionMember.person'),
        stream: this.get('stream')
      });

      this.commentCountPlusPlus();

      // Scroll to bottom so that new comment is visible
      run.next(this, this.scrollToBottom);

      comment.save().then(() => {
        debug('comment created');
      });
    },

    updateComment(comment) {
      comment.save().then(() => {
        debug('comment updated');
      });
    },

    deleteComment(comment) {
      comment.destroyRecord().then(() => {
        debug('comment destroyed');
      });
    },

    loadEarlier() {
      this.setProperties({
        isLoadingEarlier: true,
        previousTop: this.commentsElement.get(0).scrollHeight + this.commentsElement.scrollTop()
      });

      this.store.query('comment', {
        limit: COMMENT_LOAD_SIZE,
        offset: this.get('comments.length'),
        stream_id: this.get('stream.id')
      }).then(() => {
        this.send('doneLoadingEarlier');
      });
    },

    doneLoadingEarlier() {
      run.next(this, function() {
        this.commentsElement.scrollTop(this.commentsElement.get(0).scrollHeight - this.get('previousTop'));
      });

      this.set('isLoadingEarlier', false);
    },

    doTyping() {
      debug('controller doTyping');
      run.debounce(this, () => {
        let typingAt = new Date();
        this.set('sessionMember.typingAt', typingAt);
        this.get('sessionMember').save();
      }, 300);
    }
  }
});