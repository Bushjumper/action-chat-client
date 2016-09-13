import Ember from 'ember';
import ENV from 'action-chat-client/config/environment';

const {
  Controller,
  $,
  observer,
  inject: {
    service
  },
  on,
  run,
  computed,
  computed: {
    alias
  },
  isEmpty
} = Ember;

const NUDGE_OFFSET_PX = 60; // Pixels for determining nudge vs scroll for new comment
const NUDGE_PX = 24; // Pixels for distance to nudge
const PAGE_SIZE = 5;

export default Controller.extend({

  session: service(),

  cable: service(),

  queryParams: ['page', 'size'],

  page: 1,
  size: PAGE_SIZE,

  user: alias('session.person'),

  stream: null,
  members: alias('stream.members'),
  comments: [],

  commentsElement: null,
  commentsSubscription: null,
  streamsSubscription: null,
  isLoadingEarlier: false,
  isKeyboardOpen: false,

  setup: on('init', function() {
    this.subscribeComments();
    this.subscribeStreams();

    run.schedule('afterRender', this, function() {
      this.commentsElement = $('.section-body');
      this.chatBox = $('.stream-chat-footer');
      this.scrollToBottom();

      if (window.Keyboard) {
        // window.Keyboard.shrinkView(true);
      }
      if (window.cordova && window.cordova.plugins.Keyboard) {
        this.setupKeyboardEvents();
      }
    });

  }),

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
    let scrollHeight = this.commentsElement.get(0).scrollHeight; // TODO: Use object destructing

    this.commentsElement.css({
      'transform': `translateY(-${height}px)`,
      '-webkit-transform': `translateY(-${height}px)`
    });

    this.chatBox.css({
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
    this.commentsElement.css({
      'transform': `translateY(-0px)`,
      '-webkit-transform': `translateY(-0px)`,
    });

    this.chatBox.css({
      'transform': `translateY(0px)`,
      '-webkit-transform': `translateY(0px)`
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

  subscribeComments() {
    var consumer = this.get('cable').createConsumer(ENV.socket);
    var subscription = consumer.subscriptions.create("CommentsChannel", {
      received: (data) => {
        let comment = this.store.peekRecord('comment', data.comment.id);
        if (isEmpty(comment)) {
          if (data.action === 'created') {

            let bottomOffset = this.bottomOffset();

            this.pushComment(data.comment);

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
      }
    });

    this.set('commentsSubscription', subscription);
  },

  subscribeStreams() {
    let consumer = this.get('cable').createConsumer(ENV.socket);
    let subscription = consumer.subscriptions.create('StreamsChannel', {
      received: (data) => {
        let member = this.get('members').findBy('person.id', data.member.person_id);
        if (member.get('person.id') !== this.get('user.id')) {
          member.setTypingAt(new Date(data.member.typing_at));
        }
      }
    });

    this.set('streamsSubscription', subscription);
  },

  typers: computed.filterBy('members', 'isTyping'),

  typingNotice: computed('typers.[]', function() {
    let names = this.get('typers').mapBy('person.name');
    switch (names.get('length')) {
      case 0:
        return '';
      case 1:
        return `${names.objectAt(0)} is typing ...`;
      case 2:
        return `${names.objectAt(0)} and ${names.objectAt(1)} are typing...`;
      case 3:
        return `${names.objectAt(0)}, ${names.objectAt(1)} and 1 other are typing...`;
      default:
        return `${names.objectAt(0)}, ${names.objectAt(1)} and ${(names.get('length') - 2)} others are typing...`;
    }
  }),

  isNoticeVisible: computed('isLoadingEarlier', 'typingNotice', function() {
    return this.get('isLoadingEarlier') || this.get('typingNotice.length');
  }),

  memberNames: computed('members.[]', function() {
    console.log(this.get('members'));
    return this.get('members').mapBy('person.name').compact().join(', ');
  }),

  headerContent: computed('typingNotice', 'memberNames', function() {
    return this.get('typingNotice') || this.get('memberNames');
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
              'id': data.person_id
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
    let scrollHeight = this.commentsElement.get(0).scrollHeight; // TODO: Use object destructing
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

  actions: {
    createComment(body) {
      let newId = 1 + parseInt(this.get('comments').mapBy('id').get('lastObject'));

      let comment = this.store.createRecord('comment', {
        body,
        person: this.get('user'),
        id: newId
      });

      // Scroll to bottom so that new comment is visible
      run.next(this, this.scrollToBottom);

      this.get('commentsSubscription').send({
        comment: {
          body: comment.get('body'),
          person_id: comment.get('person.id')
        },
        action: 'create'
      });

    },

    updateComment(comment) {
      this.get('commentsSubscription').send({
        comment_id: comment.get('id'),
        comment: {
          body: comment.get('body'),
          person_id: comment.get('person.id')
        },
        action: 'update'
      });
    },

    deleteComment(comment) {
      this.unloadComment(comment);

      this.get('commentsSubscription').send({
        comment_id: comment.get('id'),
        action: 'destroy'
      });
    },

    loadEarlier() {
      this.setProperties({
        isLoadingEarlier: true,
        previousTop: this.commentsElement.get(0).scrollHeight + this.commentsElement.scrollTop()
      });

      // This will trigger a model reload
      this.set('size', this.get('size') + PAGE_SIZE);
    },

    doneLoadingEarlier() {
      run.next(this, function() {
        this.commentsElement.scrollTop(this.commentsElement.get(0).scrollHeight - this.get('previousTop'));
      });

      this.set('isLoadingEarlier', false);
    },

    doTyping() {
      let typingAt = new Date();
      this.get('streamsSubscription').send({
        member: {
          person_id: this.get('user.id'),
          typing_at: typingAt
        }
      });
    }
  }
});