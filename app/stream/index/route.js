import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const {
  Route,
  RSVP
} = Ember;

import {
  COMMENT_LOAD_SIZE
}
from 'action-chat-client/stream/index/chat/controller';

export default Route.extend(AuthenticatedRouteMixin, {
  model(params) {

    let stream = this.store.peekRecord('stream', params.stream_id);

    return RSVP.hash({
      stream,
      comments: this.store.query('comment', {
        limit: COMMENT_LOAD_SIZE,
        offset: 0,
        stream_id: params.stream_id
      }),
      members: this.store.query('member', {
        stream_id: params.stream_id
      })
    });
  }
});